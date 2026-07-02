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
        return path.join(app.getPath('userData'), 'Library');
      } catch {
        // app not ready yet
      }
    }
  }
  return path.join(os.homedir(), 'GLACIER', 'Library');
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

export function getDefaultOutputDir(): string {
  return path.join(getDocumentsPath(), 'output');
}

export function getDefaultStoreDir(): string {
  return path.join(getDocumentsPath(), 'store_dir');
}

export function getStoreDirPath(): string {
  return store.get('storeDirPath') || getDefaultStoreDir();
}

export function getOutputPath(): string {
  return store.get('outputPath') || getDefaultOutputDir();
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
          shortPath: path.relative(reportsDir, fullPath).replace(/\\/g, '/')
        });
      }
    }
  }

  walkDir(reportsDir);

  reportFiles.sort((a, b) => {
    const aSep = a.shortPath.includes('/');
    const bSep = b.shortPath.includes('/');
    const aIndexOrReport = !aSep && (a.name === 'index' || a.name === 'report');
    const bIndexOrReport = !bSep && (b.name === 'index' || b.name === 'report');
    const aPipelineInfo = a.shortPath.split('/').includes('pipeline_info');
    const bPipelineInfo = b.shortPath.split('/').includes('pipeline_info');

    const priority = (indexOrReport: boolean, topLevel: boolean, nf: boolean): number => {
      if (indexOrReport) return 0;
      if (topLevel) return 1;
      if (nf) return 3;
      return 2;
    };

    return (
      priority(aIndexOrReport, !aSep, aPipelineInfo) -
      priority(bIndexOrReport, !bSep, bPipelineInfo)
    );
  });

  return reportFiles;
}
