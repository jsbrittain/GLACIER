import https from 'https';
import { mkdirSync, chmodSync, createWriteStream } from 'fs';
import { execFileSync, spawn } from 'child_process';
import path from 'path';

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

function getDistroPath(): string {
  return path.join(getGlacierDir(), 'wsl', 'ubuntu-22.04.tar.xz');
}

export async function nextflowStatus() {
  if (is_windows) {
    return nextflowStatus_win();
  } else {
    return nextflowStatus_unix();
  }
}

export async function nextflowAction(action: string) {
  switch (action) {
    case 'install.nextflow':
      return installNextflow();
    case 'install.wsl2':
      return installWSL2();
    case 'install.wsl2.distro':
      return installWSL2distro();
    case 'install.docker':
      return installDocker();
    default:
      throw new Error(`Unknown Nextflow action: ${action}`);
  }
}

function nextflowStatus_win() {
  // Windows Nextflow installation process
  if (!wslCheck()) {
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
  // WSL is installed, check for glacier distribution
  if (!wslCheckDistro()) {
    return [
      {
        title: 'Windows Subsystem for Linux (Configuration)',
        description:
          'Window Subsystem for Linux is installed but has not been configured. Configuring will install and configure an appropriate distribution.',
        status: 'warning',
        actions: [
          {
            action: 'install.wsl2.distro',
            label: 'Configure WSL2'
          }
        ]
      }
    ];
  }
  return [
    {
      title: 'Nextflow',
      description: 'A GLACIER managed version of Nextflow is installed and accessible.',
      status: 'info',
      actions: []
    }
  ];
}

function wslCheck() {
  return checkExecutable('wsl', ['--version']);
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

  if (!checkExecutable('docker', ['--version'])) {
    if (is_electron) {
      status_list.push({
        title: 'Docker',
        description: 'It is recommended to have Docker installed for launching workflows.',
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

function checkExecutable(filePath: string, args: string[] = []) {
  try {
    execFileSync(filePath, args, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function callExecutable(filePath: string, args: string[] = []) {
  try {
    return execFileSync(filePath, args, { encoding: 'utf8' });
  } catch {
    return '';
  }
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

function installWSL2distro() {
  // Ensure old / broken distribution is removed
  callExecutable('wsl', ['--unregister', 'glacier']);
  // Download base distribution tarball
  return new Promise((resolve, reject) => {
    mkdirSync(path.dirname(getDistroPath()), { recursive: true });
    https
      .get(
        'https://cloud-images.ubuntu.com/releases/jammy/release/ubuntu-22.04-server-cloudimg-amd64-root.tar.xz',
        (res) => {
          if (res.statusCode !== 200) return reject({ ok: false });
          const file = createWriteStream(getDistroPath());
          res.pipe(file);
          file.on('finish', () => {
            // Import distribution into WSL
            callExecutable('wsl', [
              '--import',
              'glacier',
              path.dirname(getDistroPath()),
              getDistroPath()
            ]);
            // Configure user account
            callExecutable('wsl', [
              '-d',
              'glacier',
              '-u',
              'root',
              '--',
              'useradd',
              '-m',
              '-s',
              '/bin/bash',
              'user'
            ]);
            callExecutable('wsl', [
              '-d',
              'glacier',
              '-u',
              'root',
              '--',
              'bash',
              '-c',
              'echo "user:user" | chpasswd'
            ]);
            callExecutable('wsl', [
              '-d',
              'glacier',
              '-u',
              'root',
              '--',
              'bash',
              '-c',
              'echo -e "[user]\ndefault=user" > /etc/wsl.conf'
            ]);
            callExecutable('wsl', [
              '-d',
              'glacier',
              '-u',
              'root',
              '--',
              'bash',
              '-c',
              "sed -i 's/127.0.1.1.*/127.0.1.1 glacier/' /etc/hosts"
            ]);
            callExecutable('wsl', ['-t', 'glacier']);
            // Install JAVA
            callExecutable('wsl', ['-d', 'glacier', '-u', 'root', '--', 'apt', 'update', '-y']);
            callExecutable('wsl', [
              '-d',
              'glacier',
              '-u',
              'root',
              '--',
              'apt',
              'install',
              '-y',
              'openjdk-17-jre-headless'
            ]);
            callExecutable('wsl', ['-d', 'glacier', '-u', 'root', '--', 'java', '-version']);
            // Install Docker
            callExecutable('wsl', [
              '-d',
              'glacier',
              '-u',
              'root',
              '--',
              'apt',
              'install',
              '-y',
              'docker.io'
            ]);
            callExecutable('wsl', [
              '-d',
              'glacier',
              '-u',
              'root',
              '--',
              'usermod',
              '-aG',
              'docker',
              'user'
            ]);
            // Install nextflow
            callExecutable('wsl', [
              '-d',
              'glacier',
              '-u',
              'user',
              '--',
              'bash',
              '-c',
              'curl -s https://get.nextflow.io -o ~/nextflow && chmod +x ~/nextflow'
            ]);
            callExecutable('wsl', [
              '-d',
              'glacier',
              '-u',
              'root',
              '--',
              'mv',
              '/home/user/nextflow',
              '/usr/local/bin/'
            ]);
            callExecutable('wsl', ['-d', 'glacier', '--', 'nextflow', '-version']); // init
            resolve({ ok: true });
          });
        }
      )
      .on('error', () => reject({ ok: false }));
  });
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
