import path from 'path';
import { userDataDir } from 'platformdirs';
import fs from 'fs';
import store from './store.js';
import { Repo } from '../types.js';

export function getDefaultCollectionsDir(): string {
  return path.join(userDataDir('workflow-runner'), 'collections');
}

export function getCollectionsPath(): string {
  return store.get('collectionsPath') || getDefaultCollectionsDir();
}

export function listCollections(): Repo[] {
  const base = getCollectionsPath();
  const repos: Repo[] = [];

  if (!fs.existsSync(base)) return repos;

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
