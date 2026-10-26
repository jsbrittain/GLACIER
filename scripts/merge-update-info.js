#!/usr/bin/env node
/**
 * Merge per-architecture update-info files emitted by electron-builder.
 *
 * electron-builder names the macOS update metadata `latest-mac.yml` for every
 * architecture (only Linux gets an `-<arch>` suffix) and only merges multiple
 * architectures when they are packaged in a single run. GLACIER builds each
 * architecture on a native runner because `scripts/prepare_bundle.js` creates
 * the bundled JRE with jlink from the host JDK, so the per-architecture files
 * have to be merged into the release metadata here instead.
 *
 * Usage: node scripts/merge-update-info.js <output.yml> <input.yml> [input.yml ...]
 */

import fs from 'fs';
import yaml from 'js-yaml';

const [output, ...inputs] = process.argv.slice(2);

if (!output || inputs.length === 0) {
  console.error(
    'Usage: node scripts/merge-update-info.js <output.yml> <input.yml> [input.yml ...]'
  );
  process.exit(1);
}

const infos = inputs.map((file) => {
  const info = yaml.load(fs.readFileSync(file, 'utf8'));
  if (info == null || typeof info !== 'object') {
    throw new Error(`Could not parse update info from ${file}`);
  }
  return info;
});

// Mixing versions would silently point clients at the wrong download.
const versions = new Set(infos.map((info) => info.version));
if (versions.size !== 1) {
  throw new Error(`Cannot merge update info files with different versions: ${[...versions]}`);
}

// Keep the order of the inputs (arm64 first, then x64) and de-duplicate by URL.
const files = [];
for (const info of infos) {
  for (const entry of info.files || []) {
    if (!files.some((existing) => existing.url === entry.url)) {
      files.push(entry);
    }
  }
}

const primary = infos[0];
const releaseDate =
  infos
    .map((info) => info.releaseDate)
    .filter(Boolean)
    .sort()
    .pop() || new Date().toISOString();

// `path`/`sha512` mirror what electron-builder writes for a multi-architecture
// build: the first artifact is used for the legacy single-file fields.
const merged = {
  version: primary.version,
  files,
  path: primary.path,
  sha512: primary.sha512,
  releaseDate
};

fs.writeFileSync(output, yaml.dump(merged, { lineWidth: -1, noRefs: true, sortKeys: false }));

console.log(`Wrote ${output} with ${files.length} file(s): ${files.map((f) => f.url).join(', ')}`);
