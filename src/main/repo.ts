import { getDefaultCollectionsDir } from './paths.js';
import * as fs from 'fs';
import * as path from 'path';
import yaml from 'js-yaml';
import git from 'isomorphic-git';
import http from 'isomorphic-git/http/node/index.cjs';

interface WorkflowData {
  parameters?: Record<string, any>;
}

interface Params {
  [key: string]: any;
}

export async function cloneRepo(repoRef: string) {
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

export async function syncRepo(path: string) {
  try {
    await git.pull({
      fs,
      http,
      dir: path,
      singleBranch: true,
      fastForwardOnly: true,
      author: {
        name: 'IceFlow',
        email: 'noreply@localhost'
      }
    });
    return { status: 'ok' };
  } catch (err: unknown) {
    if (err instanceof Error) {
      return { status: 'error', message: err.message };
    }
    return { status: 'error', message: String(err) };
  }
}

export async function deleteRepo(repoPath: string) {
  try {
    await fs.promises.rm(repoPath, { recursive: true, force: true });
  } catch (err: unknown) {
    if (err instanceof Error) {
      throw new Error(`Failed to delete repo at ${repoPath}: ${err.message}`);
    }
    throw new Error(`Failed to delete repo at ${repoPath}: ${String(err)}`);
  }
}

export function getWorkflowParams(repoPath: string) {
  const yamlPath = path.join(repoPath, 'workflow.yaml');

  try {
    if (!fs.existsSync(yamlPath)) {
      return {};
    }

    const fileContents = fs.readFileSync(yamlPath, 'utf8');
    const data = yaml.load(fileContents) as WorkflowData;

    // Assuming the YAML has a 'parameters' section as in your sample
    if (data && typeof data === 'object' && data.parameters) {
      const params: Params = {};

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
