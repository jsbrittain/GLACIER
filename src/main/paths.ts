import * as os from 'os';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';
import store from './store.js';

const require = createRequire(import.meta.url);

function isElectron(): boolean {
  return process.versions?.electron !== undefined;
}

function getElectronApp(): any {
  try {
    return require('electron').app;
  } catch {
    return null;
  }
}

export function getDefaultConfigDir(): string {
  if (isElectron()) {
    const app = getElectronApp();
    if (app && app.getPath) {
      try {
        return app.getPath('userData');
      } catch {
        // app not ready yet
      }
    }
  }
  return path.join(os.homedir(), 'GLACIER');
}

export function getDefaultDocumentsDir(): string {
  if (isElectron()) {
    const app = getElectronApp();
    if (app && app.getPath) {
      try {
        return path.join(app.getPath('documents'), 'GLACIER');
      } catch {
        // app not ready yet
      }
    }
  }
  return path.join(os.homedir(), 'Documents', 'GLACIER');
}

export function getConfigPath(): string {
  return store.get('configPath') || getDefaultConfigDir();
}

export function getDocumentsPath(): string {
  return store.get('documentsPath') || getDefaultDocumentsDir();
}

// Backward-compat aliases
export function getCollectionsPath(): string {
  return getConfigPath();
}

export function getDefaultCollectionsDir(): string {
  return getDefaultConfigDir();
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
