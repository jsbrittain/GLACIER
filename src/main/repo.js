import { getDefaultCollectionsDir } from './paths.js';
import path from 'path';
import fs from 'fs';
import git from 'isomorphic-git';
import http from 'isomorphic-git/http/node/index.cjs';

export async function cloneRepo(repoRef) {
  let owner, repo;

  try {
    // Try to parse as full URL
    const url = new URL(repoRef);
    if (!url.hostname.includes('github.com')) throw new Error();
    [owner, repo] = url.pathname
      .replace(/^\//, '')
      .replace(/\.git$/, '')
      .split('/');
  } catch {
    // Fallback to short form
    if (!repoRef.includes('/') || repoRef.split('/').length !== 2) {
      throw new Error('Invalid repo format. Use either "owner/repo" or full GitHub URL.');
    }
    [owner, repo] = repoRef.replace(/\\.git$/, '').split('/');
  }

  const collectionsDir = getDefaultCollectionsDir();
  const targetDir = path.join(collectionsDir, owner, repo);

  fs.mkdirSync(targetDir, { recursive: true });

  await git.clone({
    fs,
    http,
    dir: targetDir,
    url: `https://github.com/${owner}/${repo}.git`,
    singleBranch: true,
    depth: 1
  });

  console.log('[cloneRepo] returning:', { name: `${owner}/${repo}`, path: targetDir });

  return {
    name: `${owner}/${repo}`,
    path: targetDir
  };
}

export async function syncRepo({ path: repoPath }) {
  try {
    await git.pull({
      fs,
      http,
      dir: repoPath,
      singleBranch: true,
      fastForwardOnly: true,
      author: {
        name: 'workflow-runner',
        email: 'noreply@localhost'
      }
    });
    return { status: 'ok' };
  } catch (err) {
    console.warn('sync failed:', err);
    return { status: 'error', message: err.message };
  }
}
