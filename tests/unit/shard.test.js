import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import * as tar from 'tar';
import { importShard, queryShardStatus } from '../../src/main/shard.js';

let tmpDir;

afterEach(() => {
  if (tmpDir && fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
  tmpDir = undefined;
});

async function waitForShard(shardId, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const status = await queryShardStatus(shardId);
    if (status.status === 'completed') return status;
    if (status.status === 'error') throw new Error(JSON.stringify(status.logs));
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error('Timed out waiting for shard import');
}

// Mimic the shard generator, which ships the shallow clone's .git/config with
// the original origin remote restored
function originConfig(origin) {
  return `[core]\n\trepositoryformatversion = 0\n[remote "origin"]\n\turl = ${origin}\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n`;
}

async function importTestShard(manifest, gitConfig) {
  const glacierPath = path.join(tmpDir, 'glacier');
  const shardDir = path.join(tmpDir, 'shard-src');
  const wfDir = path.join(shardDir, 'workflow');
  fs.mkdirSync(wfDir, { recursive: true });
  fs.writeFileSync(path.join(shardDir, 'manifest.json'), JSON.stringify(manifest), 'utf8');

  // Build the bundled workflow tarball (single top-level folder name that
  // differs from the archive basename so the importer normalises it)
  const tarSrc = path.join(tmpDir, 'tar-src');
  fs.mkdirSync(path.join(tarSrc, 'repo-files'), { recursive: true });
  fs.writeFileSync(path.join(tarSrc, 'repo-files', 'nextflow_schema.json'), '{}', 'utf8');
  fs.writeFileSync(path.join(tarSrc, 'repo-files', 'main.nf'), '// test workflow\n', 'utf8');
  if (gitConfig) {
    if (gitConfig.asFile) {
      // .git as a file (e.g. worktree/submodule gitdir pointer)
      fs.writeFileSync(
        path.join(tarSrc, 'repo-files', '.git'),
        'gitdir: /some/other/path\n',
        'utf8'
      );
    } else {
      fs.mkdirSync(path.join(tarSrc, 'repo-files', '.git'), { recursive: true });
      fs.writeFileSync(path.join(tarSrc, 'repo-files', '.git', 'config'), gitConfig, 'utf8');
    }
  }
  await tar.c({ gzip: false, file: path.join(wfDir, 'artic-nf.tar'), cwd: tarSrc }, ['repo-files']);

  // Package the shard as a .shard (tar.gz) archive
  const shardTar = path.join(tmpDir, 'test.shard');
  await tar.c({ gzip: true, file: shardTar, cwd: path.dirname(shardDir) }, [
    path.basename(shardDir)
  ]);

  const shardId = await importShard(shardTar, glacierPath, path.join(tmpDir, 'documents'));
  await waitForShard(shardId);
  return glacierPath;
}

function readImportedCatalogue(glacierPath) {
  const catFile = path.join(glacierPath, 'catalogues', 'shards', 'local@main', 'catalogue.json');
  const catalogue = JSON.parse(fs.readFileSync(catFile, 'utf8'));
  return catalogue.sections[0].workflows.find((w) => w.name === 'artic-nf');
}

describe('shard import', () => {
  it('records the remote url from the manifest for bundled workflows', async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shard-test-'));
    const glacierPath = await importTestShard({
      name: 'test-shard',
      workflows: [{ name: 'artic-nf', repo: 'ARTIC-Network/artic-nf', version: '0.9.0' }]
    });

    const entry = readImportedCatalogue(glacierPath);
    expect(entry).toBeDefined();
    expect(entry.repo).toBe('local/artic-nf');
    expect(entry.url).toBe('ARTIC-Network/artic-nf');
    expect(
      fs.existsSync(path.join(glacierPath, 'workflows', 'local', 'artic-nf@main', 'main.nf'))
    ).toBe(true);
  });

  it('derives the remote url from the bundled workflow git config', async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shard-test-'));
    const glacierPath = await importTestShard(
      { name: 'test-shard' },
      originConfig('git@github.com:artic-network/raccoon-nf.git')
    );

    const entry = readImportedCatalogue(glacierPath);
    expect(entry.url).toBe('artic-network/raccoon-nf');
  });

  it('manifest repo overrides the git-derived remote', async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shard-test-'));
    const glacierPath = await importTestShard(
      {
        name: 'test-shard',
        workflows: [{ name: 'artic-nf', repo: 'owner/override', version: '0.9.0' }]
      },
      originConfig('https://github.com/owner/git-origin.git')
    );

    const entry = readImportedCatalogue(glacierPath);
    expect(entry.url).toBe('owner/override');
  });

  it('omits url when neither the manifest nor git config provides a remote', async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shard-test-'));
    const glacierPath = await importTestShard({ name: 'test-shard' });

    const entry = readImportedCatalogue(glacierPath);
    expect(entry.url).toBeUndefined();
  });

  it('imports safely when .git is a file (gitdir pointer), linking no remote', async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shard-test-'));
    const glacierPath = await importTestShard({ name: 'test-shard' }, { asFile: true });

    const entry = readImportedCatalogue(glacierPath);
    expect(entry.url).toBeUndefined();
    expect(
      fs.existsSync(path.join(glacierPath, 'workflows', 'local', 'artic-nf@main', 'main.nf'))
    ).toBe(true);
  });

  it('links no remote when the git config has no origin section', async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shard-test-'));
    const glacierPath = await importTestShard(
      { name: 'test-shard' },
      `[core]\n\trepositoryformatversion = 0\n[remote "fork"]\n\turl = https://github.com/fork/repo.git\n`
    );

    const entry = readImportedCatalogue(glacierPath);
    expect(entry.url).toBeUndefined();
  });

  it('links no remote when the origin url value is empty', async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shard-test-'));
    const glacierPath = await importTestShard(
      { name: 'test-shard' },
      `[remote "origin"]\n\turl =\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n`
    );

    const entry = readImportedCatalogue(glacierPath);
    expect(entry.url).toBeUndefined();
  });

  it('links no remote for a local-path origin', async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shard-test-'));
    const glacierPath = await importTestShard(
      { name: 'test-shard' },
      originConfig('/some/local/repo')
    );

    const entry = readImportedCatalogue(glacierPath);
    expect(entry.url).toBeUndefined();
  });

  it('links no remote for a non-GitHub origin', async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shard-test-'));
    const glacierPath = await importTestShard(
      { name: 'test-shard' },
      originConfig('git@gitlab.com:group/repo.git')
    );

    const entry = readImportedCatalogue(glacierPath);
    expect(entry.url).toBeUndefined();
  });

  it('does not mistake a submodule url for the origin remote', async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shard-test-'));
    const glacierPath = await importTestShard(
      { name: 'test-shard' },
      `[remote "origin"]\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n[submodule "foo"]\n\turl = https://github.com/owner/submodule.git\n`
    );

    const entry = readImportedCatalogue(glacierPath);
    expect(entry.url).toBeUndefined();
  });
});
