#!/usr/bin/env node
/**
 * Builds a pre-configured WSL image for GLACIER on Windows.
 *
 * Steps:
 *  - Skips if bundle/wsl/glacier-wsl.tar already exists (idempotent)
 *  - Fails hard on non-Windows (image required for Windows builds)
 *  - Downloads Ubuntu 24.04 rootfs
 *  - Creates a temporary WSL distro (glacier-build)
 *  - Installs Docker, Java 21, Nextflow inside it
 *  - Exports the configured distro to bundle/wsl/glacier-wsl.tar
 *  - Cleans up the temporary distro
 *
 * Usage: node scripts/build-wsl-image.js [bundleDir]
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import https from 'https';
import { execSync, execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UBUNTU_ROOTFS_URL =
  'https://cloud-images.ubuntu.com/releases/noble/release/ubuntu-24.04-server-cloudimg-amd64-root.tar.xz';

const DISTRO_NAME = 'glacier-build';

function log(...args) {
  console.log(...args);
}

function err(...args) {
  console.error(...args);
}

function run(cmd, opts = {}) {
  log('>', cmd);
  execSync(cmd, { stdio: 'inherit', ...opts });
}

function runOutput(cmd) {
  return execSync(cmd, { encoding: 'utf8' }).toString();
}

function fileExists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const tempPath = destPath + '.part';
    const file = fs.createWriteStream(tempPath);
    const makeRequest = (u) => {
      https
        .get(u, (res) => {
          if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
            const loc = res.headers.location;
            if (!loc) return reject(new Error('Redirect without location'));
            return makeRequest(loc);
          }
          if (res.statusCode !== 200) {
            return reject(new Error(`Request failed. Status code: ${res.statusCode}`));
          }
          res.pipe(file);
          file.on('finish', () => {
            file.close(() => {
              fs.renameSync(tempPath, destPath);
              resolve();
            });
          });
        })
        .on('error', (e) => {
          try {
            fs.unlinkSync(tempPath);
          } catch {}
          reject(e);
        });
    };
    makeRequest(url);
  });
}

async function main() {
  const bundleDir = path.resolve(process.argv[2] || path.join(__dirname, '..', 'bundle'));
  const wslDir = path.join(bundleDir, 'wsl');
  const imagePath = path.join(wslDir, 'glacier-wsl.tar');
  const cacheDir = path.join(bundleDir, '..', '.cache', 'wsl');

  if (fileExists(imagePath)) {
    log(`WSL image already exists at ${imagePath}. Skipping.`);
    return;
  }

  // Remove any stale build distro from a previous run
  try {
    execFileSync('wsl', ['--terminate', DISTRO_NAME], { stdio: 'ignore' });
  } catch {}
  try {
    execFileSync('wsl', ['--unregister', DISTRO_NAME], { stdio: 'ignore' });
  } catch {}

  if (process.platform !== 'win32') {
    throw new Error(
      'WSL image can only be built on Windows. ' +
        'Supply a pre-built glacier-wsl.tar at bundle/wsl/glacier-wsl.tar when cross-compiling.'
    );
  }

  fs.mkdirSync(wslDir, { recursive: true });
  fs.mkdirSync(cacheDir, { recursive: true });

  // Download Ubuntu rootfs (outside bundle/, never shipped)
  const rootfsPath = path.join(cacheDir, 'ubuntu-24.04.tar.xz');
  if (!fileExists(rootfsPath)) {
    log('Downloading Ubuntu 24.04 rootfs...');
    await downloadFile(UBUNTU_ROOTFS_URL, rootfsPath);
    log('Rootfs downloaded.');
  } else {
    log('Rootfs already exists. Skipping download.');
  }

  // Create temporary build distro (filesystem lives in cacheDir, not bundle/)
  log('Creating temporary WSL distro...');
  run(`wsl --import "${DISTRO_NAME}" "${cacheDir}" "${rootfsPath}"`);

  // Rootfs no longer needed after import
  try {
    fs.unlinkSync(rootfsPath);
  } catch {}

  // Install packages and configure
  log('Installing packages and configuring...');
  run(`wsl -d ${DISTRO_NAME} -u root -- apt update -y`);
  run(`wsl -d ${DISTRO_NAME} -u root -- apt install -y docker.io openjdk-21-jre-headless`);
  run(`wsl -d ${DISTRO_NAME} -u root -- useradd -m -s /bin/bash user`);
  run(`wsl -d ${DISTRO_NAME} -u root -- bash -c "echo 'user:user' | chpasswd"`);
  run(
    `wsl -d ${DISTRO_NAME} -u root -- bash -c "printf '[user]\\ndefault=user\\n[boot]\\nsystemd=true\\n' > /etc/wsl.conf"`
  );
  run(
    `wsl -d ${DISTRO_NAME} -u root -- bash -c "sed -i 's/127.0.1.1.*/127.0.1.1 glacier/' /etc/hosts"`
  );
  run(`wsl -d ${DISTRO_NAME} -u root -- usermod -aG docker user`);

  run(`wsl -d ${DISTRO_NAME} -u root -- java -version`);
  run(`wsl -d ${DISTRO_NAME} -- docker --version`);

  // Install Nextflow
  log('Installing Nextflow...');
  run(
    `wsl -d ${DISTRO_NAME} -u user -- bash -c "curl -s https://www.nextflow.io/releases/v26.04.4/nextflow -o ~/nextflow && chmod +x ~/nextflow"`
  );
  run(`wsl -d ${DISTRO_NAME} -u root -- mv /home/user/nextflow /usr/local/bin/`);

  // Verify Nextflow
  run(`wsl --shutdown`);
  run(`wsl -d ${DISTRO_NAME} -- nextflow -version`);

  // Export the configured distro
  log('Exporting WSL image...');
  run(`wsl --export "${DISTRO_NAME}" "${imagePath}"`);

  // Clean up temporary distro
  log('Cleaning up...');
  await new Promise((r) => setTimeout(r, 2000));
  try {
    execFileSync('wsl', ['--terminate', DISTRO_NAME], { stdio: 'ignore' });
  } catch {}
  try {
    execFileSync('wsl', ['--unregister', DISTRO_NAME], { stdio: 'ignore' });
  } catch {}
  log(`WSL image built at ${imagePath}`);
}

main().catch((e) => {
  err('Error:', e.message);
  if (e.stack) err(e.stack);
  process.exit(1);
});
