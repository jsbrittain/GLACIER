import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import * as repo from '../../src/main/repo.js';

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
    expect(result).toBeTypeOf('object');
    expect(typeof result.path).toBe('string');
    expect(result.path).toMatch(/jsbrittain[\\/]+workflow-runner-testworkflow$/);
    expect(fs.existsSync(path.join(result.path, '.git'))).toBe(true);
    if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });
});

describe('getWorkflowParams', () => {
  const testRepoDir = path.resolve(__dirname, 'fixtures/test-repo');

  // delete workflow.yaml if it exists
  if (fs.existsSync(path.join(testRepoDir, 'workflow.yaml'))) {
    fs.unlinkSync(path.join(testRepoDir, 'workflow.yaml'));
  }

  it('returns empty object if workflow.yaml is missing', async () => {
    const params = await repo.getWorkflowParams(testRepoDir);
    expect(params).toEqual({});
  });

  it('correctly parses parameters from workflow.yaml', async () => {
    // Setup: create test-repo/workflow.yaml with sample content
    const yamlContent = `
parameters:
  input_path:
    description: Input directory
    default: /data/in
    type: string
  threads:
    description: Number of threads
    default: 4
    type: integer
`;
    const yamlPath = path.join(testRepoDir, 'workflow.yaml');
    fs.mkdirSync(testRepoDir, { recursive: true });
    fs.writeFileSync(yamlPath, yamlContent, 'utf8');

    const params = await repo.getWorkflowParams(testRepoDir);

    expect(params).toEqual({
      input_path: '/data/in',
      threads: 4
    });

    // Cleanup
    fs.unlinkSync(yamlPath);
    fs.rmdirSync(testRepoDir);
  });
});
