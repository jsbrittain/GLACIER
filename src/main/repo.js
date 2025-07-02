const fs = require('fs');
const path = require('path');
const git = require('isomorphic-git');
const http = require('isomorphic-git/http/node');

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
    depth: 1,
  });

  return `Cloned ${repoUrl} to ${dir}`;
}

module.exports = { cloneRepo };
