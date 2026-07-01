import { app, screen, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { registerIpcHandlers, call } from './ipc-handlers.js';
import { Collection } from './collection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let win: BrowserWindow | null = null;

/**
 * Attempt to gracefully shut down running processes and save state on catastrophic failure.
 */
async function gracefulCrash(error: Error, type: 'uncaughtException' | 'unhandledRejection') {
  console.error(`FATAL [${type}]:`, error);
  try {
    const col = Collection.getInstance();
    for (const inst of col.workflow_instances) {
      for (const desc of inst.processes) {
        try {
          if (desc.containerId) {
            const { docker } = await import('../runners/docker/docker.js');
            const container = docker.getContainer(desc.containerId);
            await container.stop({ t: 5 });
          } else {
            // Send SIGTERM to process group
            try {
              process.kill(-desc.pid, 'SIGTERM');
            } catch {
              /* already dead */
            }
            try {
              process.kill(desc.pid, 'SIGTERM');
            } catch {
              /* already dead */
            }
          }
        } catch {
          // Best effort
        }
      }
    }
  } catch {
    // Best effort during crash recovery
  }

  if (win) {
    dialog.showErrorBox(
      'GLACIER - Fatal Error',
      `A fatal ${type === 'uncaughtException' ? 'exception' : 'error'} occurred:\n\n${error.message}\n\nThe application will now exit.`
    );
  }

  process.exit(1);
}

process.on('uncaughtException', (error) => {
  void gracefulCrash(error, 'uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  void gracefulCrash(
    reason instanceof Error ? reason : new Error(String(reason)),
    'unhandledRejection'
  );
});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  win = new BrowserWindow({
    width: Math.round(width * 0.8),
    height: Math.round(height * 0.8),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, './preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  const indexPath = path.join(__dirname, '../renderer/index.html');
  win.loadFile(indexPath);
  win.webContents.on('did-fail-load', () => {
    console.error('Failed to load index.html');
  });
}

app.whenReady().then(() => {
  createWindow();
  const resourceRoot = path.join(
    app.isPackaged ? process.resourcesPath : app.getAppPath(),
    'bundle'
  );
  registerIpcHandlers(resourceRoot);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('pick-file', async (_evt, opts?: { filters?: Electron.FileFilter[] }) => {
  return call(async () => {
    const res = await dialog.showOpenDialog(win!, {
      properties: ['openFile'],
      filters: opts?.filters
    });
    return res.canceled ? null : (res.filePaths[0] ?? null);
  });
});

ipcMain.handle('pick-directory', async () => {
  return call(async () => {
    const res = await dialog.showOpenDialog(win!, {
      properties: ['openDirectory', 'createDirectory']
    });
    return res.canceled ? null : (res.filePaths[0] ?? null);
  });
});

ipcMain.handle('show-save-dialog', async (_evt, opts) => {
  return call(async () => {
    const res = await dialog.showSaveDialog(win!, opts);
    return res.canceled ? null : res.filePath;
  });
});

ipcMain.handle('write-text-file', async (_evt, filePath: string, content: string) => {
  return call(async () => {
    const fs = await import('fs');
    fs.writeFileSync(filePath, content, 'utf-8');
  });
});

ipcMain.handle('read-text-file', async (_evt, filePath: string) => {
  return call(async () => {
    const fs = await import('fs');
    return fs.readFileSync(filePath, 'utf-8');
  });
});
