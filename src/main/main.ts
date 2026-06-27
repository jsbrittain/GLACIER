import { app, screen, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { registerIpcHandlers, call } from './ipc-handlers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let win: BrowserWindow | null = null;

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
  registerIpcHandlers();

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
      properties: ['openDirectory']
    });
    return res.canceled ? null : (res.filePaths[0] ?? null);
  });
});

ipcMain.handle('pick-file-or-directory', async (_, options) => {
  return call(async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'openDirectory'],
      filters: options?.filters
    });
    return result.canceled ? null : (result.filePaths[0] ?? null);
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
