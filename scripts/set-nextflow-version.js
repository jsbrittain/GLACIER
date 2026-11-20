#!/usr/bin/env node
/**
 * Set the bundled Nextflow version in scripts/nextflow-version.json.
 *
 * Usage:
 *   node scripts/set-nextflow-version.js <version>
 *   node scripts/set-nextflow-version.js --check <version>
 *
 * --check exits 0 only when <version> is newer than the pinned version.
 */

import fs from 'fs';
import { VERSION_FILE, compareVersions, isStableVersion } from './nextflow-version.js';

const args = process.argv.slice(2);
const check = args.includes('--check');
const version = args.find((arg) => !arg.startsWith('--'));

if (!version) {
  console.error('Usage: node scripts/set-nextflow-version.js [--check] <version>');
  process.exit(1);
}

if (!isStableVersion(version)) {
  console.error(
    `Invalid Nextflow version "${version}". Expected a stable <year>.<month>.<patch> ` +
      'version such as 26.10.6 (stable lines are released in months 04 and 10).'
  );
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8'));
const current = data.version;

let comparison;
try {
  comparison = compareVersions(version, current);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

if (check) {
  if (comparison > 0) {
    console.log(`${current} -> ${version} is an update`);
    process.exit(0);
  }
  console.error(`No update: ${version} is not newer than ${current}`);
  process.exit(1);
}

if (comparison === 0) {
  console.log(`Nextflow is already ${version}.`);
  process.exit(0);
}

data.version = version;
fs.writeFileSync(VERSION_FILE, `${JSON.stringify(data, null, 2)}\n`);
console.log(`Nextflow ${current} -> ${version}`);
