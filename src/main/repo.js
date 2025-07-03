import { getDefaultCollectionsDir } from './paths.js';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
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

export async function deleteRepo(repoPath) {
  try {
    await fs.rm(repoPath, { recursive: true, force: true });
  } catch (err) {
    throw new Error(`Failed to delete repo at ${repoPath}: ${err.message}`);
  }
}

export function getWorkflowParams(repoPath) {
  const yamlPath = path.join(repoPath, 'workflow.yaml');

  try {
    if (!fs.existsSync(yamlPath)) {
      return {};
    }

    const fileContents = fs.readFileSync(yamlPath, 'utf8');
    const data = yaml.load(fileContents);

    // Assuming the YAML has a 'parameters' section as in your sample
    if (data && typeof data === 'object' && data.parameters) {
      const params = {};

      for (const [key, val] of Object.entries(data.parameters)) {
        params[key] = val.default !== undefined ? val.default : '';
      }

      return params;
    }

    return {};
  } catch (err) {
    console.error(`Failed to read workflow params from ${yamlPath}:`, err);
    return {};
  }
}
