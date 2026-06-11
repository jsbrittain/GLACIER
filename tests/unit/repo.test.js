import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

vi.mock('isomorphic-git', () => {
  const mockClone = vi.fn();
  const mockGetRemoteInfo = vi.fn();
  const mockPull = vi.fn();
  return {
    default: {
      clone: mockClone,
      getRemoteInfo: mockGetRemoteInfo,
      pull: mockPull
    },
    clone: mockClone,
    getRemoteInfo: mockGetRemoteInfo,
    pull: mockPull
  };
});

vi.mock('isomorphic-git/http/node', () => ({
  default: {}
}));

vi.mock('unique-names-generator', () => ({
  uniqueNamesGenerator: vi.fn(),
  adjectives: [],
  animals: []
}));

import * as repo from '../../src/main/repo.js';
import git from 'isomorphic-git';
import { uniqueNamesGenerator } from 'unique-names-generator';

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-test-'));
  vi.clearAllMocks();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const makeMockRemoteInfo = (overrides = {}) => ({
  HEAD: 'refs/heads/main',
  refs: { tags: {}, heads: {} },
  ...overrides
});

describe('parseRepoUrl', () => {
  it('parses short form owner/repo', () => {
    const result = repo.parseRepoUrl('owner/test-repo');
    expect(result).toEqual({
      owner: 'owner',
      repo: 'test-repo',
      url: 'https://github.com/owner/test-repo.git'
    });
  });

  it('parses full GitHub URL', () => {
    const result = repo.parseRepoUrl('https://github.com/owner/test-repo');
    expect(result).toEqual({
      owner: 'owner',
      repo: 'test-repo',
      url: 'https://github.com/owner/test-repo.git'
    });
  });

  it('strips .git suffix in short form', () => {
    const result = repo.parseRepoUrl('owner/test-repo.git');
    expect(result.repo).toBe('test-repo');
  });

  it('strips .git suffix from full URL', () => {
    const result = repo.parseRepoUrl('https://github.com/owner/test-repo.git');
    expect(result.repo).toBe('test-repo');
  });

  it('throws on invalid format (no slash)', () => {
    expect(() => repo.parseRepoUrl('invalid')).toThrow('Invalid repo format');
  });

  it('throws on too many segments', () => {
    expect(() => repo.parseRepoUrl('a/b/c')).toThrow('Invalid repo format');
  });
});

describe('cloneRepo', () => {
  const wd = (sub) => path.join(tmpDir, sub);

  it('clones a repo with specified version', async () => {
    const dir = wd('cloned');
    git.clone.mockResolvedValue(undefined);
    git.getRemoteInfo.mockResolvedValue(makeMockRemoteInfo());

    const result = await repo.cloneRepo('owner/test-repo', dir, 'v1.0');

    expect(git.clone).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://github.com/owner/test-repo.git',
        ref: 'v1.0',
        singleBranch: true,
        depth: 1
      })
    );
    expect(result.owner).toBe('owner');
    expect(result.repo).toBe('test-repo');
    expect(result.version).toBe('v1.0');
    expect(fs.existsSync(result.path)).toBe(true);
  });

  it('uses default branch when version is null', async () => {
    const dir = wd('default-branch');
    git.clone.mockResolvedValue(undefined);
    git.getRemoteInfo.mockResolvedValue(makeMockRemoteInfo());

    const result = await repo.cloneRepo('owner/test-repo', dir, null);

    expect(git.clone).toHaveBeenCalledWith(expect.objectContaining({ ref: 'main' }));
    expect(result.version).toBe('main');
  });

  it('uses first tag when version is latest', async () => {
    const dir = wd('latest');
    git.clone.mockResolvedValue(undefined);
    git.getRemoteInfo.mockResolvedValue(
      makeMockRemoteInfo({ refs: { tags: { v2: 'a', v1: 'b' }, heads: {} } })
    );

    const result = await repo.cloneRepo('owner/test-repo', dir, 'latest');

    expect(result.version).toBe('v1');
  });

  it('returns cached result if target already exists', async () => {
    const dir = wd('cached');
    fs.mkdirSync(path.join(dir, 'owner', 'test-repo@v1.0'), { recursive: true });

    const result = await repo.cloneRepo('owner/test-repo', dir, 'v1.0');

    expect(git.clone).not.toHaveBeenCalled();
    expect(result.version).toBe('v1.0');
  });

  it('cleans up directory on clone failure', async () => {
    const dir = wd('fail');
    git.clone.mockRejectedValue(new Error('Network error'));
    git.getRemoteInfo.mockResolvedValue(makeMockRemoteInfo());

    const targetDir = path.join(dir, 'owner', 'test-repo@main');

    await expect(repo.cloneRepo('owner/test-repo', dir, null)).rejects.toThrow('Network error');
    expect(fs.existsSync(targetDir)).toBe(false);
  });
});

describe('syncRepo', () => {
  it('returns ok on successful pull', async () => {
    git.pull.mockResolvedValue(undefined);

    const result = await repo.syncRepo('/some/path');

    expect(git.pull).toHaveBeenCalled();
    expect(result).toEqual({ status: 'ok' });
  });

  it('returns error message on pull failure', async () => {
    git.pull.mockRejectedValue(new Error('Merge conflict'));

    const result = await repo.syncRepo('/some/path');

    expect(result).toEqual({ status: 'error', message: 'Merge conflict' });
  });
});

describe('deleteRepo', () => {
  it('deletes the directory', async () => {
    const repoDir = path.join(tmpDir, 'todelete');
    fs.mkdirSync(repoDir, { recursive: true });
    fs.writeFileSync(path.join(repoDir, 'file.txt'), 'content');

    await repo.deleteRepo(repoDir);

    expect(fs.existsSync(repoDir)).toBe(false);
  });

  it('succeeds silently on non-existent path with force flag', async () => {
    const nonExistent = path.join(tmpDir, 'does-not-exist');

    const result = await repo.deleteRepo(nonExistent);

    expect(result).toBeUndefined();
  });
});

describe('getRepoTags', () => {
  it('returns tags from remote in reverse order', async () => {
    const mockGetRemoteInfo = vi.mocked(git.getRemoteInfo);
    mockGetRemoteInfo.mockResolvedValue({
      HEAD: null,
      refs: { tags: { v3: 'a', v2: 'b', v1: 'c' }, heads: {} }
    });

    const tags = await repo.getRepoTags('owner/test-repo');

    expect(tags).toEqual(['v1', 'v2', 'v3']);
  });

  it('returns empty array on network error', async () => {
    git.getRemoteInfo.mockRejectedValue(new Error('Network error'));

    const tags = await repo.getRepoTags('owner/test-repo');

    expect(tags).toEqual([]);
  });
});

describe('getRepoBranches', () => {
  it('returns branch names from remote', async () => {
    git.getRemoteInfo.mockResolvedValue({
      HEAD: null,
      refs: { tags: {}, heads: { main: 'a', develop: 'b' } }
    });

    const branches = await repo.getRepoBranches('owner/test-repo');

    expect(branches).toEqual(['main', 'develop']);
  });

  it('returns empty array on network error', async () => {
    git.getRemoteInfo.mockRejectedValue(new Error('Network error'));

    const branches = await repo.getRepoBranches('owner/test-repo');

    expect(branches).toEqual([]);
  });
});

describe('getWorkflowParams', () => {
  it('returns empty object if workflow.yaml is missing', async () => {
    const params = await repo.getWorkflowParams(tmpDir);
    expect(params).toEqual({});
  });

  it('extracts default values from parameters', async () => {
    const yamlPath = path.join(tmpDir, 'workflow.yaml');
    fs.writeFileSync(yamlPath, [
      'parameters:',
      '  input_path:',
      '    description: Input directory',
      '    default: /data/in',
      '    type: string',
      '  threads:',
      '    description: Number of threads',
      '    default: 4',
      '    type: integer'
    ].join('\n'), 'utf8');

    const params = await repo.getWorkflowParams(tmpDir);

    expect(params).toEqual({
      input_path: '/data/in',
      threads: 4
    });
  });

  it('returns empty object on malformed yaml', async () => {
    const yamlPath = path.join(tmpDir, 'workflow.yaml');
    fs.writeFileSync(yamlPath, ':: invalid yaml ::', 'utf8');

    const params = await repo.getWorkflowParams(tmpDir);

    expect(params).toEqual({});
  });

  it('returns empty object if yaml has no parameters key', async () => {
    const yamlPath = path.join(tmpDir, 'workflow.yaml');
    fs.writeFileSync(yamlPath, 'foo: bar\nbaz: qux\n', 'utf8');

    const params = await repo.getWorkflowParams(tmpDir);

    expect(params).toEqual({});
  });
});

describe('getWorkflowSchema', () => {
  it('returns parsed schema from nextflow_schema.json', async () => {
    const schema = { title: 'Test', description: 'A test', properties: {} };
    fs.writeFileSync(path.join(tmpDir, 'nextflow_schema.json'), JSON.stringify(schema), 'utf8');

    const result = await repo.getWorkflowSchema(tmpDir);

    expect(result).toEqual(schema);
  });

  it('returns empty object when schema file is missing', async () => {
    const result = await repo.getWorkflowSchema(tmpDir);
    expect(result).toEqual({});
  });

  it('returns empty object when JSON is malformed', async () => {
    fs.writeFileSync(path.join(tmpDir, 'nextflow_schema.json'), 'not valid json', 'utf8');

    const result = await repo.getWorkflowSchema(tmpDir);

    expect(result).toEqual({});
  });
});

describe('generateUniqueName', () => {
  it('returns the generated name from the library', () => {
    uniqueNamesGenerator.mockReturnValue('happy-lion');

    const name = repo.generateUniqueName([]);

    expect(name).toBe('happy-lion');
    expect(uniqueNamesGenerator).toHaveBeenCalledWith(
      expect.objectContaining({
        dictionaries: expect.any(Array),
        separator: '-',
        length: 2
      })
    );
  });

  it('generates a new name if the first is taken', () => {
    uniqueNamesGenerator
      .mockReturnValueOnce('taken-name')
      .mockReturnValueOnce('unique-name');

    const name = repo.generateUniqueName(['taken-name']);

    expect(name).toBe('unique-name');
    expect(uniqueNamesGenerator).toHaveBeenCalledTimes(2);
  });
});
