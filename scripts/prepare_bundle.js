#!/usr/bin/env node
/**
 * Steps:
 * - Exits early on Windows (no bundle required)
 * - Creates ./bundle
 * - Downloads Nextflow jar if missing
 * - Uses jdeps to determine required Java modules and jlink to create a minimal JRE
 * - Runs a smoke test: jre/bin/java -jar nextflow.jar info
 *
 * Note: This script shells out to `jdeps`, `jlink`, and `java`. Ensure a JDK that
 * includes jdeps/jlink is installed and available in PATH on non-Windows systems.
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
  process.env.NXF_URL || 'https://www.nextflow.io/releases/v25.10.2/nextflow-25.10.2-one.jar';

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

    // Check input arguments for --variant {variant} and include build config is specified
    const args = process.argv.slice(2);
    if (args.length >= 2 && args[0] === '--variant') {
      const variant = args[1];
      const configPath = path.join(repoRoot, 'build_config', `${variant}.json`);
      if (fileExists(configPath)) {
        fs.copyFileSync(configPath, path.join(bundleDir, 'manifest.json'));
        log(`Using build config for variant "${variant}".`);
      } else {
        err(`Build config for variant "${variant}" not found at ${configPath}. Using default.`);
        return 1;
      }
    } else {
      log('No variant specified. Using empty build config.');
    }

    // Detect OS; match original behavior: check RUNNER_OS env or uname
    const RUNNER_OS = process.env.RUNNER_OS || os.type(); // e.g. 'Linux', 'Darwin', or 'Windows_NT'
    if (/windows/i.test(RUNNER_OS) || process.platform === 'win32') {
      log('Windows OS detected. No bundle preparation required.');
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

    const s = runOutput('which java'); // log java version
    console.log('Using java at:', s.trim());

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

        // Ensure jdeps exists
        try {
          execSync('jdeps --version', { stdio: 'ignore' });
        } catch (e) {
          throw new Error(
            'jdeps not found in PATH. Please install a JDK that includes jdeps and jlink.'
          );
        }

        log('Determining Java dependencies (jdeps)...');

        // Run jdeps similar to: jdeps --multi-release $JAVA_VERSION -summary nextflow.jar | awk '/->/ {print $NF}' | grep -E '^(java\.|jdk\.)' | sort -u | paste -sd, -
        const jdepsCmd = `jdeps --multi-release ${JAVA_VERSION} -summary "${nextflowJar}"`;
        const jdepsOut = runOutput(jdepsCmd);
        // Parse lines containing '->' and extract right-most token, then filter java./jdk.
        const modules = jdepsOut
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter((l) => l.includes('->'))
          .map((l) => {
            // take last token
            const parts = l.split(/\s+/);
            return parts[parts.length - 1];
          })
          .filter((m) => /^java\.|^jdk\./.test(m))
          .filter(Boolean);

        modules.push('java.base');
        modules.push('java.net.http');
        modules.push('jdk.crypto.ec');
        modules.push('jdk.crypto.cryptoki');
        modules.push('java.security.jgss');
        modules.push('java.naming');
        modules.push('java.xml');

        const uniqueModules = Array.from(new Set(modules)).sort();
        if (uniqueModules.length === 0) {
          log('Warning: no java/jdk modules found by jdeps. Falling back to "java.base".');
        }
        const MODULES = uniqueModules.length > 0 ? uniqueModules.join(',') : 'java.base';
        log('Required modules:', MODULES);

        // Ensure jlink exists
        try {
          execSync('jlink --version', { stdio: 'ignore' });
        } catch (e) {
          throw new Error('jlink not found in PATH. Please install a JDK that includes jlink.');
        }

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
