import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  NEXTFLOW_VERSION,
  nxfJarUrl,
  nxfLauncherUrl,
  isValidVersion,
  isStableVersion,
  compareVersions,
  isStableTag,
  classifyUpdate,
  evaluateReleases
} from '../../scripts/nextflow-version.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(__dirname, 'fixtures', 'nextflow-releases.json');
const releases = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

describe('nextflow version helpers', () => {
  it('preserves zero-padded components in URLs', () => {
    expect(nxfJarUrl('26.04.9')).toBe(
      'https://www.nextflow.io/releases/v26.04.9/nextflow-26.04.9-one.jar'
    );
    expect(nxfLauncherUrl('26.04.9')).toBe('https://www.nextflow.io/releases/v26.04.9/nextflow');
    expect(nxfJarUrl()).toBe(
      `https://www.nextflow.io/releases/v${NEXTFLOW_VERSION}/nextflow-${NEXTFLOW_VERSION}-one.jar`
    );
  });

  it('validates CalVer strings', () => {
    expect(isValidVersion('26.04.9')).toBe(true);
    expect(isValidVersion('26.4.9')).toBe(true);
    expect(isValidVersion('26.04')).toBe(false);
    expect(isValidVersion('v26.04.9')).toBe(false);
    expect(isValidVersion(undefined)).toBe(false);
  });

  it('compares versions numerically, including zero-padded months', () => {
    expect(compareVersions('26.04.4', '26.04.9')).toBeLessThan(0);
    expect(compareVersions('26.04.9', '26.04.10')).toBeLessThan(0);
    expect(compareVersions('26.04.9', '26.10.6')).toBeLessThan(0);
    expect(compareVersions('26.10.6', '27.04.0')).toBeLessThan(0);
    expect(compareVersions('26.10.6', '26.10.6')).toBe(0);
    expect(compareVersions('26.10.6', '26.04.9')).toBeGreaterThan(0);
  });

  it('classifies patch and stable-line updates', () => {
    expect(classifyUpdate('26.04.4', '26.04.9')).toBe('patch');
    expect(classifyUpdate('26.04.9', '26.10.6')).toBe('release');
    expect(classifyUpdate('26.10.6', '27.04.0')).toBe('release');
    expect(classifyUpdate('26.10.6', '26.10.6')).toBe('none');
    expect(classifyUpdate('26.10.6', '26.04.9')).toBe('none');
  });

  it('only accepts stable April/October CalVer tags', () => {
    expect(isStableTag('v26.04.9')).toBe(true);
    expect(isStableTag('26.10.6')).toBe(true);
    expect(isStableTag('v26.11.0-edge')).toBe(false);
    expect(isStableTag('v26.06.0')).toBe(false);
    expect(isStableTag('v26.4.9')).toBe(false);
    expect(isStableTag('release-26.10.6')).toBe(false);
    expect(isStableTag(undefined)).toBe(false);
  });

  it('requires a stable, zero-padded version for manual updates', () => {
    expect(isStableVersion('26.04.9')).toBe(true);
    expect(isStableVersion('26.10.6')).toBe(true);
    expect(isStableVersion('26.4.9')).toBe(false);
    expect(isStableVersion('v26.04.9')).toBe(false);
    expect(isStableVersion('26.06.0')).toBe(false);
    expect(isStableVersion('26.11.0-edge')).toBe(false);
  });
});

describe('nextflow release selection', () => {
  it('selects the latest stable release and reports the current-line patch', () => {
    const result = evaluateReleases(releases, '26.04.4');

    expect(result.current).toBe('26.04.4');
    expect(result.target).toBe('26.10.6');
    expect(result.type).toBe('release');
    expect(result.sameLineLatest).toBe('26.04.9');
    expect(result.rejected).toEqual(
      expect.arrayContaining([
        { tag: 'v26.11.0-edge', reason: 'edge release' },
        { tag: 'v26.10.7', reason: 'draft' },
        { tag: 'v26.04.8', reason: 'prerelease' },
        { tag: 'v26.06.0', reason: 'unsupported release line' },
        { tag: 'release-26.10.6', reason: 'not a version tag' }
      ])
    );
  });

  it('ignores backports to older lines when a newer line exists', () => {
    const result = evaluateReleases(releases, '25.10.5');

    expect(result.target).toBe('26.10.6');
    expect(result.type).toBe('release');
    expect(result.sameLineLatest).toBe('25.10.9');
  });

  it('detects a patch within the current stable line', () => {
    const result = evaluateReleases(releases, '26.10.5');

    expect(result.target).toBe('26.10.6');
    expect(result.type).toBe('patch');
    expect(result.sameLineLatest).toBe('26.10.6');
  });

  it('returns none when the pinned version is already latest', () => {
    const result = evaluateReleases(releases, '26.10.6');

    expect(result.target).toBe('26.10.6');
    expect(result.type).toBe('none');
    expect(result.sameLineLatest).toBe('26.10.6');
  });

  it('detects a new stable release line', () => {
    const withNextLine = [
      ...releases,
      {
        tagName: 'v27.04.0',
        isDraft: false,
        isPrerelease: false,
        publishedAt: '2027-04-10T10:00:00Z',
        name: 'Version 27.04.0'
      }
    ];
    const result = evaluateReleases(withNextLine, '26.10.6');

    expect(result.target).toBe('27.04.0');
    expect(result.type).toBe('release');
    expect(result.sameLineLatest).toBe('26.10.6');
  });

  it('returns no target when there are no stable releases', () => {
    const result = evaluateReleases(
      [
        {
          tagName: 'v26.11.0-edge',
          isDraft: false,
          isPrerelease: true,
          publishedAt: '2026-11-17T17:19:49Z'
        }
      ],
      '26.04.4'
    );

    expect(result.target).toBeNull();
    expect(result.type).toBe('none');
    expect(result.sameLineLatest).toBeNull();
  });
});
