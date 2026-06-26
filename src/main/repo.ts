import * as fs from 'fs';
import * as path from 'path';
import yaml from 'js-yaml';
import git from 'isomorphic-git';
import http from 'isomorphic-git/http/node';
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

export function parseRepoUrl(repoUrl: string): { owner: string; repo: string; url: string } {
  // Interpret repository reference as short-form or full URL
  let owner: string = '';
  let repo: string = '';
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
    [owner, repo] = repoUrl.replace(/\.git$/, '').split('/');
  }
  const url = `https://github.com/${owner}/${repo}.git`;
  return { owner, repo, url };
}

export async function cloneRepo(
  repoUrl: string,
  workflowDir: string,
  ver: string | null = null
): Promise<ICloneRepo> {
  const { owner, repo, url } = parseRepoUrl(repoUrl);

  // Determine the version to clone
  let version = ver || (await getDefaultBranch(url));
  if (version === null || version === '' || version === 'latest') {
    const tags = (await getRepoTags(url)) || [];
    if (tags.length === 0) {
      version = 'main';
    } else {
      version = tags[0];
    }
  }

  // Determine and create the target directory
  const targetDir = path.join(workflowDir, owner, repo + '@' + version);
  if (fs.existsSync(targetDir)) {
    return {
      owner: owner,
      repo: repo,
      version: version,
      url: url,
      path: targetDir
    } as ICloneRepo;
  }
  fs.mkdirSync(targetDir, { recursive: true });

  // Clone
  try {
    await git.clone({
      fs,
      http,
      dir: targetDir,
      url: url,
      ref: version, // branch or tag
      singleBranch: true,
      depth: 1
    });
  } catch (err: unknown) {
    fs.rmSync(targetDir, { recursive: true, force: true }); // Clean up on failure
    throw err;
  }

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
    const branch = await git.currentBranch({ fs, dir: path, fullname: false });
    if (!branch) return { status: 'ok', updated: false };
    const headBefore = await git.resolveRef({ fs, dir: path, ref: branch });
    await git.pull({
      fs,
      http,
      dir: path,
      ref: branch,
      singleBranch: true,
      fastForwardOnly: true,
      author: {
        name: 'GLACIER',
        email: 'noreply@localhost'
      }
    });
    const headAfter = await git.resolveRef({ fs, dir: path, ref: branch });
    return { status: 'ok', updated: headBefore !== headAfter };
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

export async function getRepoTags(url: string) {
  const { url: full_url } = parseRepoUrl(url);
  try {
    const info = await git.getRemoteInfo({ http, url: full_url });
    return Object.keys(info.refs.tags).reverse();
  } catch {
    console.info(`Failed to fetch tags from ${url}`);
    return [];
  }
}

export async function getRepoBranches(url: string) {
  const { url: full_url } = parseRepoUrl(url);
  try {
    const info = await git.getRemoteInfo({ http, url: full_url });
    return Object.keys(info.refs.heads);
  } catch {
    console.info(`Failed to fetch branches from ${url}`);
    return [];
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
    console.log(`Failed to read workflow schema from ${schemaPath}:`, err);
    return {};
  }
}

export async function isValidWorkflowRepo(repoPath: string) {
  const nextflowSchemaPath = path.join(repoPath, 'nextflow_schema.json');
  const dockerfilePath = path.join(repoPath, 'Dockerfile');

  const nextflowExists = await fs.promises
    .stat(nextflowSchemaPath)
    .then(() => true)
    .catch(() => false);
  const dockerExists = await fs.promises
    .stat(dockerfilePath)
    .then(() => true)
    .catch(() => false);

  return nextflowExists || dockerExists;
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
