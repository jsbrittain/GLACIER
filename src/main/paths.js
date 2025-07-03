import path from 'path';
import { userDataDir } from 'platformdirs';
import fs from 'fs';
import store from './store.js';

export function getDefaultCollectionsDir() {
  return path.join(userDataDir('workflow-runner'), 'collections');
}

export function getCollectionsPath() {
  const base = store.get('collectionsPath') || getDefaultCollectionsDir();

  try {
    const owners = fs.readdirSync(base);
    const repos = [];

    for (const owner of owners) {
      const ownerPath = path.join(base, owner);
      if (!fs.statSync(ownerPath).isDirectory()) continue;

      const repoDirs = fs.readdirSync(ownerPath);
      for (const repo of repoDirs) {
        const repoPath = path.join(ownerPath, repo);
        if (fs.statSync(repoPath).isDirectory()) {
          repos.push({
            name: `${owner}/${repo}`,
            path: repoPath
          });
        }
      }
    }

    return repos;
  } catch (e) {
    console.warn('[get-collections] failed:', e);
    return [];
  }
}

export function getCollections() {
  const base = getCollectionsPath();
  const repos = [];

  if (!fs.existsSync(base)) return [];

  const owners = fs.readdirSync(base);
  for (const owner of owners) {
    const ownerPath = path.join(base, owner);
    if (!fs.statSync(ownerPath).isDirectory()) continue;

    const repoDirs = fs.readdirSync(ownerPath);
    for (const repo of repoDirs) {
      const repoPath = path.join(ownerPath, repo);
      if (fs.statSync(repoPath).isDirectory()) {
        repos.push({ name: `${owner}/${repo}`, path: repoPath });
      }
    }
  }

  return repos;
}
