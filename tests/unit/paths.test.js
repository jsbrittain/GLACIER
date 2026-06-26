import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDefaultCollectionsDir, getDefaultConfigDir, getCollectionsPath, getConfigPath, getDocumentsPath, getDefaultDocumentsDir, locateReports } from '../../src/main/paths.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('getDefaultConfigDir', () => {
  it('returns a string path', () => {
    const result = getDefaultConfigDir();
    expect(typeof result).toBe('string');
  });

  it('ends with GLACIER', () => {
    const result = getDefaultConfigDir();
    expect(result).toMatch(/GLACIER$/);
  });
});

describe('getDefaultDocumentsDir', () => {
  it('returns a string path', () => {
    const result = getDefaultDocumentsDir();
    expect(typeof result).toBe('string');
  });

  it('ends with GLACIER', () => {
    const result = getDefaultDocumentsDir();
    expect(result).toMatch(/GLACIER$/);
  });
});

describe('getConfigPath', () => {
  it('returns a string', () => {
    const result = getConfigPath();
    expect(typeof result).toBe('string');
  });
});

describe('getDocumentsPath', () => {
  it('returns a string', () => {
    const result = getDocumentsPath();
    expect(typeof result).toBe('string');
  });
});

// Backward compat aliases
describe('getDefaultCollectionsDir (alias)', () => {
  it('returns same as getDefaultConfigDir', () => {
    expect(getDefaultCollectionsDir()).toBe(getDefaultConfigDir());
  });
});

describe('getCollectionsPath (alias)', () => {
  it('returns same as getConfigPath', () => {
    expect(getCollectionsPath()).toBe(getConfigPath());
  });
});

describe('locateReports', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'locate-reports-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns empty array when directory has no HTML files', () => {
    fs.writeFileSync(path.join(tmpDir, 'data.txt'), 'content');
    const result = locateReports(tmpDir);
    expect(result).toEqual([]);
  });

  it('finds HTML files at root level', () => {
    fs.writeFileSync(path.join(tmpDir, 'report.html'), '<html></html>');
    const result = locateReports(tmpDir);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('report');
    expect(result[0].shortPath).toBe('report.html');
  });

  it('finds HTML files in subdirectories recursively', () => {
    fs.mkdirSync(path.join(tmpDir, 'subdir'));
    fs.writeFileSync(path.join(tmpDir, 'report.html'), '<html></html>');
    fs.writeFileSync(path.join(tmpDir, 'subdir', 'deep.html'), '<html></html>');
    const result = locateReports(tmpDir);
    expect(result).toHaveLength(2);
    expect(result[0].shortPath).toBe('report.html');
    expect(result[1].shortPath).toBe('subdir/deep.html');
  });

  it('skips the work directory', () => {
    fs.mkdirSync(path.join(tmpDir, 'work'));
    fs.writeFileSync(path.join(tmpDir, 'report.html'), '<html></html>');
    fs.writeFileSync(path.join(tmpDir, 'work', 'skipped.html'), '<html></html>');
    const result = locateReports(tmpDir);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('report');
  });

  it('does not skip nested work directories inside subdirectories', () => {
    fs.mkdirSync(path.join(tmpDir, 'results', 'work'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'results', 'work', 'nested.html'), '<html></html>');
    const result = locateReports(tmpDir);
    expect(result).toHaveLength(1);
    expect(result[0].shortPath).toBe('results/work/nested.html');
  });

  it('ignores non-HTML files', () => {
    fs.mkdirSync(path.join(tmpDir, 'subdir'));
    fs.writeFileSync(path.join(tmpDir, 'data.txt'), 'content');
    fs.writeFileSync(path.join(tmpDir, 'subdir', 'results.csv'), 'a,b,c');
    fs.writeFileSync(path.join(tmpDir, 'subdir', 'output.html'), '<html></html>');
    const result = locateReports(tmpDir);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('output');
  });

  it('assigns sequential ids starting from 1', () => {
    fs.writeFileSync(path.join(tmpDir, 'a.html'), '<html></html>');
    fs.writeFileSync(path.join(tmpDir, 'b.html'), '<html></html>');
    fs.writeFileSync(path.join(tmpDir, 'c.html'), '<html></html>');
    const result = locateReports(tmpDir);
    expect(result[0].id).toBe('1');
    expect(result[1].id).toBe('2');
    expect(result[2].id).toBe('3');
  });

  it('contains the full path for each report', () => {
    fs.writeFileSync(path.join(tmpDir, 'report.html'), '<html></html>');
    const result = locateReports(tmpDir);
    expect(result[0].path).toBe(path.join(tmpDir, 'report.html'));
  });

  it('throws when directory does not exist', () => {
    expect(() => locateReports(path.join(tmpDir, 'nonexistent'))).toThrow(
      'Reports directory does not exist'
    );
  });
});
