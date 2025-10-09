import * as path from 'path';
import * as fs_sync from 'fs';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { IWorkflowInstance } from '../../main/collection.js'; // should not be linking directly to main from here

type paramsT = { [key: string]: any };

export interface IRunWorkflowOpts {
  resume?: boolean;
  restart?: boolean;
  profile?: string;
}

export async function runWorkflow(
  instance: IWorkflowInstance,
  params: paramsT,
  { resume = false, restart = false, profile = 'standard' }: IRunWorkflowOpts = {}
) {
  // Launch nextflow natively on host system
  const name = instance.name;
  const instancePath = instance.path;
  const workPath = path.resolve(instancePath, 'work');
  await fs.mkdir(workPath, { recursive: true });
  const projectPath = instance.workflow_version?.path || instancePath;

  // Save parameters to a file in the instance folder
  const paramsFile = path.resolve(instancePath, 'params.json');
  if (!resume && !restart) {
    fs.writeFile(paramsFile, JSON.stringify(params, null, 2), 'utf8');
  }

  // Clear logs and set to append
  if (!fs_sync.existsSync(instancePath)) {
    fs_sync.mkdirSync(instancePath, { recursive: true });
  }
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

  const cmd = [
    'run',
    path.resolve(projectPath, 'main.nf'),
    '-work-dir',
    workPath,
    '-profile',
    profile,
    '-params-file',
    paramsFile
  ];
  if (resume) {
    cmd.push('-resume');
  }

  console.log(`Spawning nextflow with command: nextflow ${cmd.join(' ')} from ${instancePath}`);
  const p = spawn('nextflow', cmd, {
    cwd: instancePath,
    stdio: ['ignore', stdout, stderr], // stdin ignored
    detached: true
  });

  p.unref(); // allow the parent to exit independently

  return p.pid;
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
    const profileNameRe = /(?:"([^"]+)"|'([^']+)'|([A-Za-z0-9_\-]+))\s*\{/g;
    const profiles = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = profileNameRe.exec(profilesBlock)) !== null) {
      const name = m[1] ?? m[2] ?? m[3];
      if (name && name.trim().length > 0) profiles.add(name.trim());
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
