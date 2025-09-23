import { getDefaultCollectionsDir } from './paths.js';
import * as fs from 'fs';
import * as path from 'path';
import yaml from 'js-yaml';
import git from 'isomorphic-git';
import http from 'isomorphic-git/http/node/index.cjs';
import { IRepo } from './types.js';
import { uniqueNamesGenerator, adjectives, animals } from 'unique-names-generator';

interface WorkflowData {
  parameters?: Record<string, any>;
}

interface Params {
  [key: string]: any;
}

export interface ICloneRepo {
  owner: string;
  repo: string;
  version: string;
  url: string;
  path: string;
}

export async function cloneRepo(
  repoUrl: string,
  workflowDir: string,
  branch: string | null = null,
  tag: string | null = null
): Promise<ICloneRepo> {
  let owner: string = '';
  let repo: string = '';
  let version: string | null = null;

  // Either branch or tag can be specified (but not both), otherwise default branch
  if (branch !== null && tag !== null) {
    throw new Error('Either branch or tag must be specified, not both.');
  }

  // Interpret repository reference as short-form or full URL
  try {
    // Try to parse as full URL
    const url = new URL(repoUrl);
    if (!url.hostname.includes('github.com')) throw new Error();
    [owner, repo] = url.pathname
      .replace(/^\//, '')
      .replace(/\.git$/, '')
      .split('/');
  } catch {
    // Fallback to short form
    if (!repoUrl.includes('/') || repoUrl.split('/').length !== 2) {
      throw new Error('Invalid repo format. Use either "owner/repo" or full GitHub URL.');
    }
    [owner, repo] = repoUrl.replace(/\\.git$/, '').split('/');
  }
  const url = `https://github.com/${owner}/${repo}.git`;

  // Determine the version to clone
  if (branch !== null) {
    version = branch;
  } else if (tag !== null) {
    version = tag;
  } else {
    version = await getDefaultBranch(url);
  }
  if (version === null || version === '') {
    version = 'main'; // Fallback
  }

  // Determine and create the target directory
  const targetDir = path.join(workflowDir, owner, repo + '@' + version);
  fs.mkdirSync(targetDir, { recursive: true });

  // Clone
  await git.clone({
    fs,
    http,
    dir: targetDir,
    url: url,
    ref: version, // branch or tag
    singleBranch: true,
    depth: 1
  });

  return {
    owner: owner,
    repo: repo,
    version: version,
    url: url,
    path: targetDir
  } as ICloneRepo;
}

async function getDefaultBranch(url: string) {
  const info = await git.getRemoteInfo({ http, url }); // e.g. "refs/heads/main"
  const head = info.HEAD;
  if (!head) return 'main'; // Fallback if HEAD not found
  return head.replace('refs/heads/', '');
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
        name: 'GLACIER',
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

export async function getWorkflowParams(repoPath: string) {
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

export async function getWorkflowSchema(repoPath: string) {
  const schemaPath = path.join(repoPath, 'nextflow_schema.json');
  try {
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found at ${schemaPath}`);
    }

    const fileContents = fs.readFileSync(schemaPath, 'utf8');
    const schema = JSON.parse(fileContents);
    return schema;
  } catch (err) {
    return {};
  }
}

export function generateUniqueName(existingNames: string[]) {
  const existingNamesSet = new Set(existingNames);
  let newName = '';
  do {
    newName = uniqueNamesGenerator({
      dictionaries: [adjectives, animals],
      separator: '-',
      length: 2
    });
  } while (existingNamesSet.has(newName));
  return newName;
}
