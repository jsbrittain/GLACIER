import path from 'path';
import { userDataDir } from 'platformdirs';
import fs from 'fs';
import store from './store.js';
import { Repo } from '../types.js';

export function getDefaultCollectionsDir(): string {
  return path.join(userDataDir('IceFlow'), 'collections');
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
        const url = `${owner}/${repo}`;
        repos.push({ name: url, path: repoPath, url: url });
      }
    }
  }

  return repos;
}
