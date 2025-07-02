import fs from 'fs';
import path from 'path';
import git from 'isomorphic-git';
import http from 'isomorphic-git/http/node/index.js';

async function cloneRepo(repoUrl, targetDir) {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const { pathname, hostname } = new URL(repoUrl);
  const dir = path.resolve(targetDir);

  await git.clone({
    fs,
    http,
    dir,
    url: `https://${hostname}${pathname}`,
    singleBranch: true,
    depth: 1
  });

  return `Cloned ${repoUrl} to ${dir}`;
}

export { cloneRepo };
