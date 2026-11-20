#!/usr/bin/env node
/**
 * Evaluate Nextflow releases against the pinned version.
 *
 * Usage:
 *   gh release list -R nextflow-io/nextflow --limit 200 \
 *     --json tagName,isDraft,isPrerelease,publishedAt,name \
 *     | node scripts/check-nextflow-release.js
 *
 *   node scripts/check-nextflow-release.js --releases releases.json
 *   node scripts/check-nextflow-release.js --compare <a> <b>
 *
 * Prints { current, target, type, sameLineLatest, rejected } as JSON.
 * --compare prints a negative number, zero or a positive number.
 */

import fs from 'fs';
import { NEXTFLOW_VERSION, compareVersions, evaluateReleases } from './nextflow-version.js';

const args = process.argv.slice(2);

if (args[0] === '--compare') {
  const [, left, right] = args;
  if (!left || !right) {
    console.error('Usage: node scripts/check-nextflow-release.js --compare <a> <b>');
    process.exit(1);
  }
  try {
    console.log(compareVersions(left, right));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
  process.exit(0);
}

let raw;
try {
  const releasesIndex = args.indexOf('--releases');
  if (releasesIndex !== -1) {
    const file = args[releasesIndex + 1];
    if (!file) throw new Error('--releases requires a file path');
    raw = fs.readFileSync(file, 'utf8');
  } else {
    raw = fs.readFileSync(0, 'utf8');
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

let releases;
try {
  releases = JSON.parse(raw);
} catch (error) {
  console.error(`Could not parse releases JSON: ${error.message}`);
  process.exit(1);
}

if (!Array.isArray(releases)) {
  console.error('Releases JSON must be an array.');
  process.exit(1);
}

try {
  const result = evaluateReleases(releases, NEXTFLOW_VERSION);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
