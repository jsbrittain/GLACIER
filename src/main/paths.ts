import * as os from 'os';
import path from 'path';
// import { userDataDir } from 'platformdirs';
import fs from 'fs';
import store from './store.js';

export function getDefaultCollectionsDir(): string {
  const homeDir = os.homedir();
  return path.join(homeDir, 'GLACIER');
}

export function getCollectionsPath(): string {
  return store.get('collectionsPath') || getDefaultCollectionsDir();
}

export function locateReports(reportsDir: string): Record<string, string>[] {
  // Look through folders recursively for HTML outputs
  if (!fs.existsSync(reportsDir)) {
    throw new Error(`Reports directory does not exist: ${reportsDir}`);
  }
  const reportFiles: Record<string, string>[] = [];

  function walkDir(currentPath: string) {
    // If first level 'work' folder, then skip
    const relativePath = path.relative(reportsDir, currentPath);
    if (relativePath.split(path.sep)[0] === 'work') {
      return;
    }

    const files = fs.readdirSync(currentPath);
    for (const file of files) {
      const fullPath = path.join(currentPath, file);
      const stat = fs.lstatSync(fullPath);
      if (stat.isDirectory()) {
        walkDir(fullPath);
      } else if (stat.isFile() && path.extname(file).toLowerCase() === '.html') {
        reportFiles.push({
          id: (reportFiles.length + 1).toString(),
          name: path.basename(file, '.html'),
          path: fullPath,
          shortPath: path.relative(reportsDir, fullPath)
        });
      }
    }
  }

  walkDir(reportsDir);
  return reportFiles;
}
