import * as path from 'path';
import * as fs_sync from 'fs';
import slash from 'slash';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';

import { IWorkflowInstance } from '../../main/collection.js';
import { getConfigPath } from '../../main/paths.js';
import { settings } from '../../main/settings.js';
import { defaultProfileFrom } from '../../types/profile.js';
import { ProcessDescriptor } from '../../types/types.js';

type paramsT = { [key: string]: any };

export interface IRunWorkflowOpts {
  resume?: boolean;
  restart?: boolean;
  profile?: string;
}

const is_windows = process.platform === 'win32';

const toPosixPath = (base: string) => {
  return slash(base.replace(/^([A-Za-z]):\\/, (_, drive) => `/mnt/${drive.toLowerCase()}/`));
};

const resolvePath = (base: string, name: string) => {
  const rtn = toPosixPath(path.resolve(base, name));
  return rtn;
};

// Read the profile saved at launch (glacier-profile.json). Returns undefined
// when the file is missing or unreadable so callers can fall back gracefully.
const readStoredProfile = async (file: string): Promise<string | undefined> => {
  try {
    const raw = await fs.readFile(file, 'utf8');
    const parsed = JSON.parse(raw);
    const profile = parsed?.profile;
    if (typeof profile === 'string' && profile) return profile;
    if (Array.isArray(profile) && profile.length > 0) return profile.join(',');
  } catch {
    /* missing or corrupt profile file */
  }
  return undefined;
};

// Resolve the default profile for a workflow from its nextflow.config
// (docker if defined, else standard/first available).
const resolveDefaultProfile = async (instance: IWorkflowInstance): Promise<string> => {
  const profiles = await getAvailableProfiles(instance);
  return defaultProfileFrom(profiles);
};

const looksLikePath = (s: string): boolean => {
  return /^[a-zA-Z]:\\/.test(s) || /[\\/]/.test(s);
};

const paramsToPosix = (params: any): any => {
  if (Array.isArray(params)) {
    return params.map(paramsToPosix);
  } else if (params && typeof params === 'object') {
    for (const [key, value] of Object.entries(params)) {
      params[key] = paramsToPosix(value);
    }
    return params;
  } else if (typeof params === 'string') {
    if (looksLikePath(params)) {
      return toPosixPath(params);
    }
    return params;
  }
  return params;
};

// Electron check
const get_electron_paths = async () => {
  const is_electron = process.versions?.electron !== undefined;

  let java_binary = '';
  let jar_file = '';
  let env: Record<string, string> = {};

  if (is_electron) {
    const { app } = await import('electron');

    // Resource paths
    const resource_root = path.join(
      app.isPackaged ? process.resourcesPath : app.getAppPath(),
      'bundle'
    );
    java_binary = path.join(
      resource_root,
      'jre',
      'bin',
      process.platform === 'win32' ? 'java.exe' : 'java'
    );
    jar_file = path.join(resource_root, 'nextflow.jar');

    // Nextflow runtime environment
    const userNextflowDir = path.join(app.getPath('userData'), 'nextflow');
    try {
      fs_sync.mkdirSync(userNextflowDir, { recursive: true });
    } catch (e) {
      /* ignore */
    }

    env = {
      ...process.env,
      NXF_HOME: userNextflowDir,
      NXF_JAVA_HOME: path.join(resource_root, 'jre')
    };
  }

  const syntaxParser = settings.get('nextflowSyntaxParser');
  if (syntaxParser) {
    env.NXF_SYNTAX_PARSER = `v${syntaxParser}`;
  }

  try {
    const extraPaths = (settings.get('extraPaths') || '').trim();
    if (extraPaths) {
      const currentPath = env.PATH || process.env.PATH || '';
      env.PATH = `${extraPaths}:${currentPath}`;
    }
  } catch {}

  return { is_electron, java_binary, jar_file, env };
};

export async function runWorkflow(
  instance: IWorkflowInstance,
  params: paramsT,
  { resume = false, restart = false, profile }: IRunWorkflowOpts = {}
): Promise<ProcessDescriptor | null> {
  const { is_electron, java_binary, jar_file, env } = await get_electron_paths();

  // Launch nextflow natively on host system
  // Append a timestamp suffix so each run has a unique Nextflow name (avoids
  // "Run name <name> has been already used" collisions across restarts).
  const name = `${instance.name}-${Date.now().toString(36)}`;
  const instancePath = instance.path; // launch from Windows path (on win32)
  const workPath = resolvePath(instancePath, 'work');
  await fs.mkdir(path.resolve(instancePath, 'work'), { recursive: true });
  const projectPath = instance.workflow_version?.path || instancePath;
  const collectionsPath = getConfigPath();

  if (is_windows) {
    // Convert all file and folder paths in params to posix and redirect
    params = paramsToPosix(params);
  }

  // Ensure instance directory exists before any file writes
  if (!fs_sync.existsSync(instancePath)) {
    fs_sync.mkdirSync(instancePath, { recursive: true });
  }

  // Save parameters to a file in the instance folder
  const paramsFile = path.resolve(instancePath, 'glacier-params.json');
  if (!resume && !restart) {
    await fs.writeFile(paramsFile, JSON.stringify(params, null, 2), 'utf8');
  }

  // Resolve the execution profile: an explicit profile wins; on resume/restart
  // reuse the profile saved at launch; otherwise fall back to the workflow's
  // default (docker if defined, else standard). Persist it so resume remembers it.
  const profileFile = path.resolve(instancePath, 'glacier-profile.json');
  let effectiveProfile = profile;
  if (effectiveProfile === undefined) {
    if (resume || restart) {
      effectiveProfile = await readStoredProfile(profileFile);
    }
    if (effectiveProfile === undefined) {
      effectiveProfile = await resolveDefaultProfile(instance);
    }
  }
  if (!resume && !restart) {
    await fs.writeFile(profileFile, JSON.stringify({ profile: effectiveProfile }), 'utf8');
  }

  // Write resource limits nextflow.config if configured
  const limitsCpu = settings.get('resourceLimitsCpu');
  const limitsMem = settings.get('resourceLimitsMemory');
  if (limitsCpu || limitsMem) {
    const lines: string[] = ['process {', '    resourceLimits = ['];
    if (limitsCpu) lines.push(`        cpus: ${limitsCpu},`);
    if (limitsMem) lines.push(`        memory: '${limitsMem}.GB',`);
    lines.push('    ]', '}');
    await fs.writeFile(path.resolve(instancePath, 'nextflow.config'), lines.join('\n'), 'utf8');
  }

  // Write custom user config if provided
  const customConfig = settings.get('customNextflowConfig');
  if (customConfig) {
    await fs.writeFile(path.resolve(instancePath, 'user.config'), customConfig, 'utf8');
  }

  // Clear logs and set to append
  if (!fs_sync.existsSync(path.resolve(instancePath, 'stdout.log'))) {
    fs_sync.writeFileSync(path.resolve(instancePath, 'stdout.log'), '');
  }
  fs_sync.truncateSync(path.resolve(instancePath, 'stdout.log'), 0);
  const stdout = fs_sync.openSync(path.resolve(instancePath, 'stdout.log'), 'a');
  if (!fs_sync.existsSync(path.resolve(instancePath, 'stderr.log'))) {
    fs_sync.writeFileSync(path.resolve(instancePath, 'stderr.log'), '');
  }
  fs_sync.truncateSync(path.resolve(instancePath, 'stderr.log'), 0);
  const stderr = fs_sync.openSync(path.resolve(instancePath, 'stderr.log'), 'a');

  if (is_windows) {
    const args = [
      'nextflow',
      '-log',
      toPosixPath(path.join(instancePath, 'nextflow.log')),
      'run',
      toPosixPath(path.resolve(projectPath)),
      '-work-dir',
      toPosixPath(workPath),
      '-profile',
      effectiveProfile,
      '-params-file',
      toPosixPath(paramsFile),
      '-name',
      name
    ];
    if (resume) {
      args.push('-resume');
    }
    const cmd = args.join(' ');

    const bashArgs = [
      cmd,
      '>',
      resolvePath(instancePath, 'stdout.log'),
      '2>',
      resolvePath(instancePath, 'stderr.log'),
      '<',
      '/dev/null'
    ];
    const bashCmd = bashArgs.join(' ');

    console.log(`Spawning nextflow with command: ${cmd} from ${instancePath}`);

    // Show the run name in the minimized WSL console so the user can identify it
    const titledBashCmd = `echo "GLACIER run: ${name}" && ${bashCmd}`;

    const p = spawn(
      'cmd.exe',
      [
        '/c',
        'start',
        '/MIN',
        '/WAIT',
        'wsl.exe',
        '-d',
        'glacier',
        '-e',
        'bash',
        '-lc',
        titledBashCmd
      ],
      {
        cwd: instancePath,
        stdio: 'ignore',
        detached: true,
        windowsHide: true
      }
    );

    // Catch asynchronous child process failures (includes nextflow not found)
    p.on('error', (err) => {
      if (err) {
        return null;
      }
    });

    if (!p?.pid) {
      throw new Error('Failed to spawn nextflow process');
    }
    p.unref();

    return {
      pid: p.pid,
      cmd: cmd,
      startTime: new Date().toISOString()
    };
  }

  // Unix / macOS launcher
  const cmd = [
    '-log',
    resolvePath(instancePath, 'nextflow.log'),
    'run',
    toPosixPath(path.resolve(projectPath)),
    '-work-dir',
    toPosixPath(workPath),
    '-profile',
    effectiveProfile,
    '-params-file',
    toPosixPath(paramsFile),
    '-name',
    name
  ];
  if (resume) {
    cmd.push('-resume');
  }
  if (customConfig) {
    cmd.push('-c', 'user.config');
  }

  const java_flags = [
    '-Dfile.encoding=UTF-8',
    '-Dcapsule.trampoline',
    '-Dcom.sun.security.enableAIAcaIssuers=true',
    '-Djava.awt.headless=true',

    // performance
    '-XX:+TieredCompilation',
    '-XX:TieredStopAtLevel=1',

    // Native access
    '--enable-native-access=ALL-UNNAMED',

    // Core reflection (Groovy / Nextflow)
    '--add-opens=java.base/java.lang=ALL-UNNAMED',
    '--add-opens=java.base/java.lang.reflect=ALL-UNNAMED',
    '--add-opens=java.base/java.io=ALL-UNNAMED',

    // Collections / Kryo serializers
    '--add-opens=java.base/java.util=ALL-UNNAMED',
    '--add-opens=java.base/java.util.concurrent=ALL-UNNAMED',

    // FileSystemProvider injection
    '--add-opens=java.base/java.nio.file.spi=ALL-UNNAMED',
    '--add-exports=java.base/java.nio.file.spi=ALL-UNNAMED',

    // FTP support (Nextflow HTTP/FTP provider)
    '--add-exports=java.base/sun.net.www.protocol.ftp=ALL-UNNAMED',
    '--add-opens=java.base/sun.net.www.protocol.ftp=ALL-UNNAMED',

    // Internal memory access
    '--add-exports=java.base/jdk.internal.misc=ALL-UNNAMED',
    '--add-opens=java.base/jdk.internal.misc=ALL-UNNAMED'
  ];

  const cmdLine = is_electron
    ? [java_binary, ...java_flags, '-jar', jar_file, ...cmd].join(' ')
    : ['nextflow', ...cmd].join(' ');
  console.log(`Spawning nextflow with command: nextflow ${cmd.join(' ')} from ${instancePath}`);
  try {
    let p;
    if (is_electron) {
      p = spawn(java_binary, [...java_flags, '-jar', jar_file, ...cmd], {
        cwd: instancePath,
        env,
        stdio: ['ignore', stdout, stderr], // stdin ignored
        detached: true
      });
    } else {
      // Client-server (assume nextflow on path for now)
      const nxfEnv = { ...process.env };
      const parserVal = settings.get('nextflowSyntaxParser');
      if (parserVal) nxfEnv.NXF_SYNTAX_PARSER = `v${parserVal}`;
      try {
        const extraPaths = (settings.get('extraPaths') || '').trim();
        if (extraPaths) {
          nxfEnv.PATH = `${extraPaths}:${nxfEnv.PATH || ''}`;
        }
      } catch {}
      p = spawn('nextflow', cmd, {
        cwd: instancePath,
        env: nxfEnv,
        stdio: ['ignore', stdout, stderr], // stdin ignored
        detached: true
      });
    }

    // Catch asynchronous child process failures (includes nextflow not found)
    p.on('error', (err) => {
      if (err) {
        return null;
      }
    });

    if (!p?.pid) {
      throw new Error('Failed to spawn nextflow process');
    }
    p.unref(); // allow the parent to exit independently
    return {
      pid: p.pid,
      cmd: cmdLine,
      startTime: new Date().toISOString()
    };
  } catch (err) {
    return null;
  }
}

export async function getAvailableProfiles(instance: IWorkflowInstance): Promise<string[]> {
  const nextflow_config_file = path.join(instance.workflow_version.path, 'nextflow.config');
  if (!fs_sync.existsSync(nextflow_config_file)) {
    console.log(`Nextflow config file ${nextflow_config_file} does not exist.`);
    return ['standard'];
  }

  async function readFileUtf8(p: string): Promise<string> {
    return fs_sync.promises.readFile(p, { encoding: 'utf8' });
  }

  try {
    const txt = await readFileUtf8(nextflow_config_file);

    // Find the "profiles { ... }" block and extract its content while respecting nested braces.
    const profilesStartMatch = txt.match(/profiles\s*\{/);
    if (!profilesStartMatch) {
      // no profiles block -> default 'standard'
      return ['standard'];
    }

    const startIdx = txt.indexOf(profilesStartMatch[0]);
    // find the opening brace position
    const openBraceIdx = txt.indexOf('{', startIdx);
    if (openBraceIdx === -1) {
      return ['standard'];
    }

    // walk forward to find matching closing brace (handle nested braces)
    let depth = 0;
    let endIdx = -1;
    for (let i = openBraceIdx; i < txt.length; i++) {
      const ch = txt[i];
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          endIdx = i;
          break;
        }
      }
    }

    if (endIdx === -1) {
      // malformed config; fall back to default
      console.warn(
        'Could not find end of profiles block in nextflow.config; returning default profile.'
      );
      return ['standard'];
    }

    const profilesBlock = txt.slice(openBraceIdx + 1, endIdx);

    // Match profile names: support unquoted (name {) and quoted ('name' { or "name" {)
    const profiles = new Set<string>();

    depth = 0;
    let token = '';
    let inLineComment = false;

    for (let i = 0; i < profilesBlock.length; i++) {
      const ch = profilesBlock[i];
      const next = profilesBlock[i + 1];

      // detect // comment start
      if (!inLineComment && ch === '/' && next === '/') {
        inLineComment = true;
        i++; // skip second '/'
        continue;
      }

      // end comment at newline
      if (inLineComment) {
        if (ch === '\n') {
          inLineComment = false;
        }
        continue;
      }

      if (ch === '{') {
        if (depth === 0) {
          const name = token.trim().replace(/^['"]|['"]$/g, '');

          if (name.length > 0) {
            profiles.add(name);
          }
        }
        depth++;
        token = '';
      } else if (ch === '}') {
        depth--;
        token = '';
      } else if (depth === 0) {
        token += ch;
      }
    }
    // Always include 'standard' if it's not present (Nextflow assumes it as default profile)
    if (!profiles.has('standard')) {
      profiles.add('standard');
    }

    // return as array (sorted for predictable order)
    return Array.from(profiles).sort();
  } catch (err) {
    console.error('Error reading/parsing nextflow.config:', err);
    return ['standard'];
  }
}
