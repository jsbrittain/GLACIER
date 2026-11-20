import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const VERSION_FILE = path.join(__dirname, 'nextflow-version.json');
export const NEXTFLOW_VERSION = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8')).version;

export function nxfJarUrl(version = NEXTFLOW_VERSION) {
  return `https://www.nextflow.io/releases/v${version}/nextflow-${version}-one.jar`;
}

export function nxfLauncherUrl(version = NEXTFLOW_VERSION) {
  return `https://www.nextflow.io/releases/v${version}/nextflow`;
}

export function isValidVersion(version) {
  return typeof version === 'string' && /^\d+\.\d+\.\d+$/.test(version);
}

export function isStableVersion(version) {
  return isValidVersion(version) && isStableTag(version);
}

export function parseVersion(version) {
  if (!isValidVersion(version)) return null;
  const [year, month, patch] = version.split('.').map(Number);
  return { year, month, patch };
}

const COMPONENTS = ['year', 'month', 'patch'];

/**
 * Compare two Nextflow CalVer versions numerically. Zero-padded components
 * (e.g. the "04" in 26.04.9) are parsed as numbers, never compared as strings.
 */
export function compareVersions(a, b) {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left) throw new Error(`Invalid Nextflow version: ${a}`);
  if (!right) throw new Error(`Invalid Nextflow version: ${b}`);
  for (const component of COMPONENTS) {
    if (left[component] !== right[component]) return left[component] - right[component];
  }
  return 0;
}

/**
 * Stable Nextflow releases are published in April (04) and October (10).
 * Edge releases are published monthly and carry an "-edge" suffix.
 */
export function isStableTag(tag) {
  if (typeof tag !== 'string') return false;
  const match = tag.match(/^v?(\d{2})\.(\d{2})\.(\d+)$/);
  if (!match) return false;
  return match[2] === '04' || match[2] === '10';
}

export function tagToVersion(tag) {
  if (typeof tag !== 'string') return null;
  const match = tag.match(/^v?(\d{2}\.\d{2}\.\d+)$/);
  return match ? match[1] : null;
}

export function classifyUpdate(current, target) {
  const difference = compareVersions(target, current);
  if (difference <= 0) return 'none';
  const left = parseVersion(current);
  const right = parseVersion(target);
  return left.year === right.year && left.month === right.month ? 'patch' : 'release';
}

/**
 * Select the newest stable Nextflow release and classify it against the
 * currently pinned version. Drafts, prereleases, edge releases and release
 * lines other than 04/10 are reported as rejected candidates.
 */
export function evaluateReleases(releases, current = NEXTFLOW_VERSION) {
  if (!isValidVersion(current)) {
    throw new Error(`Invalid current Nextflow version: ${current}`);
  }

  const rejected = [];
  const stable = [];

  for (const release of Array.isArray(releases) ? releases : []) {
    const tag = typeof release?.tagName === 'string' ? release.tagName : '';
    let version = null;
    let reason = null;

    if (!tag) {
      reason = 'missing tag';
    } else if (/-edge$/i.test(tag)) {
      reason = 'edge release';
    } else {
      version = tagToVersion(tag);
      if (!version) reason = 'not a version tag';
      else if (!isStableTag(tag)) reason = 'unsupported release line';
      else if (release.isDraft) reason = 'draft';
      else if (release.isPrerelease) reason = 'prerelease';
    }

    if (reason) {
      rejected.push({ tag, reason });
      continue;
    }

    stable.push({ version, release });
  }

  let latest = null;
  for (const entry of stable) {
    if (!latest || compareVersions(entry.version, latest.version) > 0) {
      latest = entry;
    }
  }

  const currentParsed = parseVersion(current);
  let sameLineLatest = null;
  for (const { version } of stable) {
    const parsed = parseVersion(version);
    if (parsed.year !== currentParsed.year || parsed.month !== currentParsed.month) continue;
    if (!sameLineLatest || compareVersions(version, sameLineLatest) > 0) {
      sameLineLatest = version;
    }
  }

  return {
    current,
    target: latest ? latest.version : null,
    type: latest ? classifyUpdate(current, latest.version) : 'none',
    sameLineLatest,
    rejected
  };
}
