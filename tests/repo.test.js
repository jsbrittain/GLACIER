import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import * as repo from '../src/main/repo.js';

const TEST_DIR = path.resolve('./tmp/test-clone');

describe('repo.cloneRepo', () => {
  it('fails on invalid URL', async () => {
    await expect(repo.cloneRepo('bad-url', TEST_DIR)).rejects.toThrow();
  });

  it('successfully clones a real repo', async () => {
    if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
    const result = await repo.cloneRepo(
      'https://github.com/jsbrittain/workflow-runner-testworkflow',
      TEST_DIR
    );
    expect(result).toContain('Cloned');
    expect(fs.existsSync(path.join(TEST_DIR, '.git'))).toBe(true);
    if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });
});
