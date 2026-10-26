// scripts/staple.cjs
//
// electron-builder `afterSign` hook. electron-builder signs and notarizes the
// app bundle but never staples the ticket into it, which leaves Gatekeeper
// needing an online check on first launch.
//
// `afterSign` runs after notarization and before the DMG target builds
// (PlatformPackager.doSignAfterPack), so the disk image contains the stapled
// app and the update-info hashes, which are computed once the DMG is written,
// stay valid.

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 20000;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function staple(appPath) {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      await execFileAsync('xcrun', ['stapler', 'staple', appPath]);
      console.log(`Stapled notarization ticket into ${appPath}`);
      return;
    } catch (error) {
      lastError = error;
      console.warn(`stapler attempt ${attempt}/${MAX_ATTEMPTS} failed: ${error.message}`);
      // The notarization ticket can take a while to become available, so retry
      // before giving up.
      if (attempt < MAX_ATTEMPTS) {
        await delay(RETRY_DELAY_MS);
      }
    }
  }

  throw new Error(`Could not staple ${appPath}: ${lastError && lastError.message}`);
}

async function afterSign(context) {
  if (process.platform !== 'darwin') {
    return;
  }

  // Nothing to staple unless electron-builder notarized the app; the same
  // conditions it uses in MacPackager.getNotarizeOptions().
  const notarize = context.packager.platformSpecificBuildOptions.notarize;
  const credentials = process.env.APPLE_ID && process.env.APPLE_APP_SPECIFIC_PASSWORD;
  if (notarize === false || !credentials) {
    console.log('Skipping stapling: the app was not notarized.');
    return;
  }

  const applications = fs
    .readdirSync(context.appOutDir)
    .filter((entry) => entry.endsWith('.app'))
    .map((entry) => path.join(context.appOutDir, entry));

  if (applications.length === 0) {
    throw new Error(`No .app bundle found in ${context.appOutDir}`);
  }

  for (const application of applications) {
    await staple(application);
  }
}

module.exports.afterSign = afterSign;
module.exports.default = afterSign;
