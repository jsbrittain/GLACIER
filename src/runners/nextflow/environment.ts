import https from 'https';
import { existsSync, mkdirSync, chmodSync, createWriteStream } from 'fs';
import { execFileSync, execFile, spawn } from 'child_process';
import path from 'path';
import { settings } from '../../main/settings.js';

const is_windows = process.platform === 'win32';
const is_electron = process.versions?.electron !== undefined;

function getGlacierDir(): string {
  try {
    const { getConfigPath } = require('../../main/paths.js');
    return getConfigPath();
  } catch {
    // Fallback for when paths module is not available
    return path.join(process.env.HOME || process.env.USERPROFILE || '', 'GLACIER');
  }
}

function getNextflowPath(): string {
  return path.join(getGlacierDir(), 'bin', 'nextflow');
}

function getWslDistroDir(): string {
  return path.join(getGlacierDir(), 'wsl');
}

async function getBundledWslImage(): Promise<{
  imagePath: string | null;
  searchedPaths: string[];
}> {
  const candidates: string[] = [];

  try {
    const { Collection } = await import('../../main/collection.js');
    const root = Collection.getInstance().resourceRoot;
    if (root) candidates.push(path.join(root, 'wsl', 'glacier-wsl.tar'));
  } catch {
    // Collection is not always available in non-Electron contexts.
  }

  try {
    const electron = await import('electron');
    const app = (electron as any).app;
    if (app) {
      const root = path.join(app.isPackaged ? process.resourcesPath : app.getAppPath(), 'bundle');
      candidates.push(path.join(root, 'wsl', 'glacier-wsl.tar'));
    }
  } catch {
    // Electron is not available in web/server contexts.
  }

  const searchedPaths = [...new Set(candidates)];
  for (const img of searchedPaths) {
    if (existsSync(img)) return { imagePath: img, searchedPaths };
  }
  return { imagePath: null, searchedPaths };
}

export async function nextflowStatus() {
  if (is_windows) {
    return nextflowStatus_win();
  } else {
    return nextflowStatus_unix();
  }
}

export async function nextflowAction(action: string, onProgress?: (msg: string) => void) {
  switch (action) {
    case 'install.nextflow':
      return installNextflow();
    case 'install.wsl2':
      return installWSL2();
    case 'update.wsl2':
      return updateWSL2();
    case 'install.wsl2.distro':
      return installWSL2distro(onProgress);
    case 'install.docker':
      return installDocker();
    case 'detect.docker':
      return detectDocker();
    default:
      throw new Error(`Unknown Nextflow action: ${action}`);
  }
}

async function nextflowStatus_win() {
  const wslInfo = await checkWslVersion();
  if (!wslInfo.exists) {
    return [
      {
        title: 'Windows Subsystem for Linux (v2)',
        description:
          'Windows Subsystem for Linux (WSL) version 2 must be installed for nextflow. This requires administrative rights. After install, restart GLACIER.',
        status: 'warning',
        actions: [
          {
            action: 'install.wsl2',
            label: 'Install WSL2'
          }
        ]
      }
    ];
  }
  if (!wslInfo.supportsSystemd) {
    const versionStr = wslInfo.version ? ` (version ${wslInfo.version})` : '';
    return [
      {
        title: 'Windows Subsystem for Linux (Update Required)',
        description: `WSL${versionStr} is installed but does not support systemd. GLACIER requires WSL ${MIN_WSL_SYSTEMD_VERSION} or higher. Run 'wsl --update' or click Update WSL below.`,
        status: 'warning',
        actions: [
          {
            action: 'update.wsl2',
            label: 'Update WSL'
          }
        ]
      }
    ];
  }
  if (!(await wslCheckDistroAsync())) {
    return [
      {
        title: 'Windows Subsystem for Linux (Configuration)',
        description:
          'Window Subsystem for Linux is installed but has not been configured. Configuring will install and configure an appropriate distribution.',
        status: 'warning',
        actions: [
          {
            action: 'install.wsl2.distro',
            label: 'Install Distro'
          }
        ]
      }
    ];
  }
  const status = [
    {
      title: 'Windows Subsystem for Linux',
      description: 'A GLACIER managed WSL distribution is installed.',
      status: 'info',
      actions: [
        {
          action: 'install.wsl2.distro',
          label: 'Reinstall'
        }
      ]
    },
    {
      title: 'Nextflow',
      description: 'A GLACIER managed version of Nextflow is installed and accessible.',
      status: 'info',
      actions: []
    }
  ];
  if (await wslCheckDockerAsync()) {
    status.push({
      title: 'Docker',
      description: 'Docker is accessible inside the GLACIER WSL distribution.',
      status: 'info',
      actions: []
    });
  } else {
    status.push({
      title: 'Docker',
      description:
        'Docker is not currently accessible inside the GLACIER WSL distribution. Workflows that use Docker containers may fail, but workflows that do not need Docker can still run.',
      status: 'warning',
      actions: []
    });
  }
  return status;
}

const MIN_WSL_SYSTEMD_VERSION = '0.67.6';

function wslCheck() {
  return checkExecutable('wsl', ['--version']);
}

function wslVersionCheck(): { version: string; supportsSystemd: boolean } {
  try {
    const output = execFileSync('wsl', ['--version'], { encoding: 'utf8' });
    const clean = output.replace(/\0/g, '');
    const match = clean.match(/WSL\s+version:\s*(\d+\.\d+\.\d+)/);
    if (!match) return { version: '', supportsSystemd: false };
    const version = match[1];
    const supportsSystemd = compareSemver(version, MIN_WSL_SYSTEMD_VERSION) >= 0;
    return { version, supportsSystemd };
  } catch {
    return { version: '', supportsSystemd: false };
  }
}

async function checkWslVersion(): Promise<{
  exists: boolean;
  version: string;
  supportsSystemd: boolean;
}> {
  try {
    const output = await execFileAsync('wsl', ['--version']);
    const match = output.match(/WSL\s+version:\s*(\d+\.\d+\.\d+)/);
    if (!match) return { exists: true, version: '', supportsSystemd: false };
    const version = match[1];
    const supportsSystemd = compareSemver(version, MIN_WSL_SYSTEMD_VERSION) >= 0;
    return { exists: true, version, supportsSystemd };
  } catch {
    return { exists: false, version: '', supportsSystemd: false };
  }
}

function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const va = pa[i] || 0;
    const vb = pb[i] || 0;
    if (va !== vb) return va - vb;
  }
  return 0;
}

function wslCheckDistro() {
  // Check if glacier distribution can launch nextflow
  if (!callExecutable('wsl', ['-d', 'glacier', '--', 'nextflow', '-version'])) {
    return false;
  }
  return true;
}

function nextflowStatus_unix() {
  // Non-Windows Nextflow installation process (MacOS, Linux)

  interface Action {
    action: string;
    label: string;
  }

  // MacOS / Linux install is bundled
  const status_list = [
    {
      title: 'Nextflow',
      description: 'GLACIER provides a managed version of Nextflow. No further action is required.',
      status: 'info',
      actions: [] as Action[]
    }
  ];

  let dockerFound = checkExecutable('docker', ['--version']);

  if (!dockerFound) {
    let extraPaths = '';
    try {
      extraPaths = (settings.get('extraPaths') || '').trim();
    } catch {}
    if (extraPaths) {
      dockerFound = checkExecutable('docker', ['--version'], {
        PATH: `${extraPaths}:${process.env.PATH || ''}`
      });
    }
  }

  if (!dockerFound) {
    // Auto-detect common Docker locations
    const detected = detectDockerPath();
    if (detected) {
      try {
        settings.set('extraPaths', detected);
      } catch {}
      dockerFound = checkExecutable('docker', ['--version'], {
        PATH: `${detected}:${process.env.PATH || ''}`
      });
    }
  }

  if (!dockerFound) {
    if (is_electron) {
      status_list.push({
        title: 'Docker',
        description:
          'Docker was not found. If Docker is already installed, go to Settings > Environment and add its location. Otherwise, install Docker Desktop.',
        status: 'warning',
        actions: [
          {
            action: 'install.docker',
            label: 'Download Docker Desktop'
          }
        ]
      });
    } else {
      status_list.push({
        title: 'Docker',
        description:
          'Docker not found. It is recommended to have Docker installed for launching workflows. Please contact your system administrator to request installation.',
        status: 'warning',
        actions: []
      });
    }
  } else {
    status_list.push({
      title: 'Docker',
      description: 'A Docker installation is accessible. No further action is required.',
      status: 'info',
      actions: []
    });
  }

  return status_list;
}

function isNextflowInstalled(nextflowPath: string = 'nextflow'): boolean {
  return checkExecutable(nextflowPath, ['-version']);
}

function checkExecutable(filePath: string, args: string[] = [], env?: Record<string, string>) {
  try {
    execFileSync(filePath, args, {
      stdio: 'ignore',
      ...(env ? { env: { ...process.env, ...env } } : {})
    });
    return true;
  } catch {
    return false;
  }
}

function callExecutable(filePath: string, args: string[] = []) {
  try {
    return execFileSync(filePath, args, { encoding: 'utf8' }).replace(/\0/g, '');
  } catch {
    return '';
  }
}

function commandText(filePath: string, args: string[] = []) {
  return [filePath, ...args].join(' ');
}

function execErrorMessage(err: any): string {
  const stderr = err?.stderr?.toString?.().trim?.().replace(/\0/g, '');
  const stdout = err?.stdout?.toString?.().trim?.().replace(/\0/g, '');
  return stderr || stdout || err?.message || String(err);
}

function execFileAsync(filePath: string, args: string[] = []): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(filePath, args, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }, (error, stdout) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout ? stdout.replace(/\0/g, '') : '');
      }
    });
  });
}

async function checkExecutableAsync(filePath: string, args: string[] = []): Promise<boolean> {
  try {
    await execFileAsync(filePath, args);
    return true;
  } catch {
    return false;
  }
}

async function callExecutableAsync(filePath: string, args: string[] = []): Promise<string> {
  try {
    return await execFileAsync(filePath, args);
  } catch {
    return '';
  }
}

function runExecutable(filePath: string, args: string[] = [], timeout?: number) {
  const options: any = { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 };
  if (timeout !== undefined) options.timeout = timeout;
  try {
    return execFileSync(filePath, args, options);
  } catch (err) {
    throw new Error(`${commandText(filePath, args)} failed: ${execErrorMessage(err)}`);
  }
}

function wslCheckDocker() {
  return checkExecutable('wsl', [
    '-d',
    'glacier',
    '-u',
    'root',
    '--',
    'sh',
    '-lc',
    wslDockerScript()
  ]);
}

function wslDockerScript() {
  const script = [
    'service docker start >/dev/null 2>&1 || true',
    'for i in 1 2 3 4 5 6 7 8 9 10; do docker info >/dev/null 2>&1 && exit 0; sleep 1; done',
    'exit 1'
  ].join('\n');
  return script;
}

async function wslCheckDistroAsync(): Promise<boolean> {
  return checkExecutableAsync('wsl', ['-d', 'glacier', '--', 'nextflow', '-version']);
}

async function wslCheckDockerAsync(): Promise<boolean> {
  return checkExecutableAsync('wsl', [
    '-d',
    'glacier',
    '-u',
    'root',
    '--',
    'sh',
    '-lc',
    wslDockerScript()
  ]);
}

function installNextflow() {
  return new Promise((resolve, reject) => {
    mkdirSync(path.dirname(getNextflowPath()), { recursive: true });
    https
      .get('https://get.nextflow.io', (res) => {
        if (res.statusCode !== 200) return reject({ ok: false });
        const file = createWriteStream(getNextflowPath());
        res.pipe(file);
        file.on('finish', () => {
          chmodSync(getNextflowPath(), 0o755);
          const p = spawn(getNextflowPath(), ['-version'], { stdio: 'ignore' });
          p.on('close', (code) => {
            code === 0 ? resolve({ ok: true }) : reject({ ok: false });
          });
        });
      })
      .on('error', () => reject({ ok: false }));
  });
}

function installWSL2() {
  return checkExecutable('wsl', []); // trigger installation
}

function updateWSL2() {
  try {
    execFileSync('wsl', ['--update'], { stdio: 'inherit' });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`WSL update failed: ${message}`);
  }
}

async function installWSL2distro(onProgress?: (msg: string) => void) {
  const { version, supportsSystemd } = wslVersionCheck();
  if (!supportsSystemd) {
    const versionStr = version ? ` (version ${version})` : '';
    throw new Error(
      `WSL${versionStr} does not support systemd. GLACIER requires WSL ${MIN_WSL_SYSTEMD_VERSION} or higher. Run 'wsl --update' first.`
    );
  }

  const { imagePath: bundledImage, searchedPaths } = await getBundledWslImage();
  if (!bundledImage) {
    const searched = searchedPaths.length ? ` Searched: ${searchedPaths.join(', ')}` : '';
    throw new Error(
      `Bundled GLACIER WSL image not found. Expected bundle/wsl/glacier-wsl.tar.${searched}`
    );
  }

  const distroDir = getWslDistroDir();
  mkdirSync(distroDir, { recursive: true });

  onProgress?.('Terminating old WSL distro...');
  callExecutable('wsl', ['--terminate', 'glacier']);
  callExecutable('wsl', ['--unregister', 'glacier']);

  onProgress?.('Importing WSL distro...');
  try {
    runExecutable('wsl', ['--import', 'glacier', distroDir, bundledImage], 600_000);

    onProgress?.('Verifying Nextflow installation...');
    runExecutable('wsl', ['-d', 'glacier', '--', 'nextflow', '-version']);

    onProgress?.('Checking Docker...');
    if (!wslCheckDocker()) {
      console.warn('Docker is not currently accessible inside the GLACIER WSL distribution.');
    }
    return { ok: true };
  } catch (err) {
    callExecutable('wsl', ['--terminate', 'glacier']);
    callExecutable('wsl', ['--unregister', 'glacier']);
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Bundled GLACIER WSL distro install failed: ${message}`);
  }
}

let _shell: any;
async function getShell() {
  if (!_shell) {
    try {
      const pkg = await import('electron');
      _shell = pkg.shell;
    } catch {
      _shell = { openExternal: () => Promise.resolve() };
    }
  }
  return _shell;
}

async function installDocker() {
  // open Docker download page
  const s = await getShell();
  await s.openExternal('https://www.docker.com/products/docker-desktop/');
  return { ok: true };
}

const COMMON_DOCKER_PATHS = [
  '/usr/local/bin/docker',
  '/opt/homebrew/bin/docker',
  '/usr/bin/docker',
  '/Applications/Docker.app/Contents/Resources/bin/docker'
];

function detectDockerPath(): string {
  for (const dp of COMMON_DOCKER_PATHS) {
    if (checkExecutable(dp, ['--version'])) {
      return path.dirname(dp);
    }
  }
  return '';
}

async function detectDocker() {
  const detected = detectDockerPath();
  if (detected) {
    try {
      const currentExtraPaths = (settings.get('extraPaths') || '').trim();
      const paths = currentExtraPaths ? currentExtraPaths.split(':') : [];
      if (!paths.includes(detected)) {
        paths.unshift(detected);
        settings.set('extraPaths', paths.join(':'));
      }
    } catch {}
    return { ok: true, path: detected };
  }
  throw new Error(
    'Could not find a Docker installation in common locations. Please install Docker Desktop or set the path manually.'
  );
}
