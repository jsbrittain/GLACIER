#!/usr/bin/env node
/**
 * Steps:
 * - Exits early on Windows (no bundle required)
 * - Creates ./bundle
 * - Downloads Nextflow jar if missing
 * - Uses jdeps to determine required Java modules and jlink to create a minimal JRE
 * - Runs a smoke test: jre/bin/java -jar nextflow.jar info
 *
 * Requires a Temurin JDK for jlink (OpenJDK jlink uses incompatible flags).
 * On first run, Temurin is auto-downloaded to .temurin/ if a system Temurin is
 * not detected. On subsequent runs, the cached .temurin/ install is reused.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import https from 'https';
import { execSync, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const bundle_full_jre = false;
const JAVA_VERSION = process.env.JAVA_VERSION || '21';
const NXF_URL =
  process.env.NXF_URL || 'https://www.nextflow.io/releases/v26.04.4/nextflow-26.04.4-one.jar';

const log = (...args) => console.log(...args);
const err = (...args) => console.error(...args);

function run(cmd, opts = {}) {
  log('>', cmd);
  execSync(cmd, { stdio: 'inherit', ...opts });
}

function runOutput(cmd) {
  // returns stdout as string
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
            // follow redirect
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

function detectJavaHome(javaCmd = 'java') {
  try {
    // java -XshowSettings:properties prints "    java.home = /path"
    const out = runOutput(`${javaCmd} -XshowSettings:properties -version 2>&1`);
    const m = out.match(/^\s*java\.home = (.+)$/m);
    if (m && m[1]) return m[1].trim();
  } catch (e) {
    // fallback: try `which java` -> resolve path -> go up two directories
    try {
      const whichJava = runOutput('which java').trim();
      if (whichJava) {
        // On many systems 'which java' returns the wrapper; try readlink -f
        try {
          const resolved = runOutput(`readlink -f ${whichJava}`).trim();
          if (resolved) {
            // java binary lives in .../bin/java -> java.home is parent dir
            return path.dirname(path.dirname(resolved));
          }
        } catch (e2) {
          // fallback to dirname(dirname(whichJava))
          return path.dirname(path.dirname(whichJava));
        }
      }
    } catch {}
  }
  return null;
}

function getTemurinDownloadUrl(version) {
  const osMap = {
    Darwin: 'mac',
    Linux: 'linux',
    Windows_NT: 'windows'
  };
  const archMap = {
    x64: 'x64',
    arm64: 'aarch64'
  };
  const os = osMap[os.type()];
  const arch = archMap[process.arch];
  if (!os || !arch) return null;
  return `https://api.adoptium.net/v3/binary/latest/${version}/ga/${os}/${arch}/jdk/hotspot/normal/eclipse`;
}

async function ensureJdk(version, jdkDir) {
  try {
    const jlinkPath = execSync('which jlink', { encoding: 'utf8' }).toString().trim();
    if (jlinkPath) {
      const jdkBin = path.dirname(jlinkPath);
      const javaVer = execSync(`"${path.join(jdkBin, 'java')}" -version 2>&1`, {
        encoding: 'utf8'
      }).toString();
      if (javaVer.includes('Temurin')) {
        log('System jlink is from Temurin -- using system JDK.');
        return null;
      }
    }
  } catch {}

  if (fileExists(path.join(jdkDir, 'bin', 'jlink'))) {
    log(`Using cached Temurin JDK from ${jdkDir}`);
    return jdkDir;
  }

  log('jlink not found or not Temurin. Downloading Temurin JDK...');
  const url = getTemurinDownloadUrl(version);
  if (!url) {
    throw new Error(
      `Unsupported platform: ${os.type()} ${process.arch}. ` +
        'Please install Temurin JDK 21+ manually and ensure it is on PATH.'
    );
  }

  fs.mkdirSync(path.dirname(jdkDir), { recursive: true });
  const archive = path.join(path.dirname(jdkDir), `temurin-jdk${version}.tar.gz`);
  await downloadFile(url, archive);

  log('Extracting Temurin JDK...');
  fs.mkdirSync(jdkDir, { recursive: true });
  run(`tar xzf "${archive}" --strip-components=1 -C "${jdkDir}"`);

  try {
    fs.unlinkSync(archive);
  } catch {}

  log(`Temurin JDK ${version} installed at ${jdkDir}`);
  return jdkDir;
}

async function main() {
  try {
    // SCRIPT_DIR logic: assume script is at scripts/prepare_bundle.js
    const scriptDir = __dirname;
    const repoRoot = path.resolve(scriptDir, '..');
    process.chdir(repoRoot);

    // Create bundle directory
    const bundleDir = path.resolve(repoRoot, 'bundle');
    if (!fileExists(bundleDir)) {
      fs.mkdirSync(bundleDir, { recursive: true });
    }
    process.chdir(bundleDir);

    // Move build config to bundle folder (pre-configures catalogue list)

    // Load default theme
    let manifestData = {};
    const defaultThemePath = path.join(repoRoot, 'build-configs', 'default-theme.json');
    if (fileExists(defaultThemePath)) {
      const themeRaw = fs.readFileSync(defaultThemePath, 'utf-8');
      manifestData.theme = JSON.parse(themeRaw);
    } else {
      log('Warning: default theme file not found at', defaultThemePath);
    }

    // Check environment variable GLACIER_MANIFEST and merge build config if specified
    const manifest = process.env.GLACIER_MANIFEST || null;
    if (manifest) {
      const configPath = path.join(repoRoot, 'build-configs', `${manifest}.json`);
      if (fileExists(configPath)) {
        const configRaw = fs.readFileSync(configPath, 'utf-8');
        const configData = JSON.parse(configRaw);
        manifestData = { ...configData, theme: manifestData.theme };
        log(`Using build config for manifest "${manifest}".`);
      } else {
        err(`Build config for manifest "${manifest}" not found at ${configPath}.`);
        return 1;
      }
    } else {
      log('No manifest specified. Using default theme only.');
    }

    // Write manifest (always includes theme, optionally catalogues)
    const existingManifest = path.join(bundleDir, 'manifest.json');
    fs.writeFileSync(existingManifest, JSON.stringify(manifestData, null, 2));
    log('Manifest written to', existingManifest);

    // On Windows, build the pre-configured WSL image instead of JRE+Nextflow
    if (process.platform === 'win32') {
      log('Windows OS detected. Building WSL image...');
      const buildWslScript = path.join(scriptDir, 'build-wsl-image.js');
      run(`node "${buildWslScript}" "${bundleDir}"`);
      log('WSL image built successfully.');
      process.exit(0);
    }

    // Download Nextflow if missing
    const nextflowJar = path.join(bundleDir, 'nextflow.jar');
    if (!fileExists(nextflowJar)) {
      log('Downloading Nextflow...');
      await downloadFile(NXF_URL, nextflowJar);
      log('Nextflow downloaded to', nextflowJar);
    } else {
      log('Nextflow jar already exists. Skipping download.');
    }

    // Prepare Java runtime
    const jreDir = path.join(bundleDir, 'jre');
    if (!fileExists(jreDir)) {
      if (bundle_full_jre) {
        // --- Copy full JRE ---

        log('Bundling full system JRE into the app...');

        // allow an override for reproducible packaging
        const JAVA_CMD = process.env.SYSTEM_JAVA || 'java';
        const javaHome = detectJavaHome(JAVA_CMD);
        if (!javaHome) {
          throw new Error(
            'Could not detect system JAVA_HOME. Set SYSTEM_JAVA env or ensure `java` is on PATH.'
          );
        }
        log('Detected java.home:', javaHome);

        // Copy the full JRE/JDK directory into bundle/jre
        // Prefer Node's fs.cpSync (Node 16+). Fallback to system 'cp -a' or rsync.
        try {
          // Ensure destination parent exists
          fs.mkdirSync(jreDir, { recursive: true });
          try {
            // Node >= 16: use fs.cpSync for recursive copy
            if (fs.cpSync) {
              log('Copying JRE using fs.cpSync (fast)...');
              fs.cpSync(javaHome, jreDir, { recursive: true });
            } else {
              throw new Error('fs.cpSync not available');
            }
          } catch (copyErr) {
            log('fs.cpSync failed or not available, falling back to system copy (cp -a)...');
            // Use POSIX cp -a (works on macOS/Linux)
            run(`cp -a "${javaHome}" "${jreDir}"`);
          }
        } catch (copyError) {
          err(
            'Failed to copy JRE into bundle:',
            copyError && copyError.message ? copyError.message : copyError
          );
          throw copyError;
        }

        // Normalize: in some JDKs javaHome may be the JDK root (e.g. .../Contents/Home).
        // Ensure bin/java exists.
        let javaBin = path.join(jreDir, 'bin', 'java');
        if (!fileExists(javaBin)) {
          // If the copied tree contains 'jre' inside, try that
          const alt = path.join(jreDir, 'jre', 'bin', 'java');
          if (fileExists(alt)) {
            javaBin = alt;
          } else {
            // sometimes JDK home has 'bin/java' but copy created nested structure; search
            const found = runOutput(
              `find "${jreDir}" -type f -name java -print -quit 2>/dev/null`
            ).trim();
            if (found) javaBin = found;
          }
        }

        if (!fileExists(javaBin)) {
          throw new Error(`Expected java executable not found in copied JRE. Searched: ${javaBin}`);
        }

        // Make sure java binary is executable
        try {
          fs.chmodSync(javaBin, 0o755);
        } catch (e) {
          // ignore if chmod fails due to permissions on packaging system
        }

        log('Bundled java binary at:', javaBin);
        log('Running smoke test with bundled JRE...');
        run(`"${javaBin}" -jar "${nextflowJar}" info`);
        log('Smoke test completed successfully (full JRE).');
      } else {
        // --- Minimal JRE ---

        log('Preparing minimal Java runtime...');

        const jdkDir = await ensureJdk(
          JAVA_VERSION,
          path.join(repoRoot, '.temurin', `jdk${JAVA_VERSION}`)
        );
        if (jdkDir) {
          process.env.PATH = `${path.join(jdkDir, 'bin')}:${process.env.PATH}`;
        }
        console.log('Using java at:', runOutput('which java').trim());

        log('Using ALL-MODULE-PATH (include all JDK modules)...');
        const MODULES = 'ALL-MODULE-PATH';

        log('Creating minimal Java runtime (jlink)...');
        // Build jlink command: jlink --add-modules "$MODULES" --strip-debug --compress zip-6 --no-header-files --no-man-pages --output ./jre
        const jlinkCmd = [
          'jlink',
          `--add-modules "${MODULES}"`,
          '--strip-debug',
          '--compress',
          'zip-6',
          '--no-header-files',
          '--no-man-pages',
          `--output "${jreDir}"`
        ].join(' ');

        run(jlinkCmd);

        log('Minimal Java runtime created.');

        // Smoke test: run jre/bin/java -jar nextflow.jar info
        const javaBin = path.join(jreDir, 'bin', 'java');
        if (!fileExists(javaBin)) {
          throw new Error(`Expected java executable not found at ${javaBin}`);
        }

        log('Running smoke test...');
        run(`"${javaBin}" -jar "${nextflowJar}" info`);
        log('Smoke test completed successfully.');
      }
    } else {
      log('Java runtime already exists. Skipping preparation.');
    }

    log('Bundle preparation completed.');
    process.exit(0);
  } catch (e) {
    err('Error:', e && e.message ? e.message : e);
    // show stack for debugging
    if (e && e.stack) {
      err(e.stack);
    }
    process.exit(1);
  }
}

main();
