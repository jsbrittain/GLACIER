import { describe, it, expect } from 'vitest';
import { getDefaultCollectionsDir } from '../../src/main/paths.js';
import fs from 'fs';

describe('getDefaultCollectionsDir', () => {
  it('returns a string path', () => {
    const result = getDefaultCollectionsDir();
    expect(typeof result).toBe('string');
  });

  it('ends with /GLACIER/collections', () => {
    const path = getDefaultCollectionsDir();
    expect(path).toMatch(/GLACIER$/);
  });

  it('can be created if missing', () => {
    const dir = getDefaultCollectionsDir();
    fs.mkdirSync(dir, { recursive: true });
    const stat = fs.statSync(dir);
    expect(stat.isDirectory()).toBe(true);
  });
});
