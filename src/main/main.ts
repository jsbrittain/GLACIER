import { app, screen, BrowserWindow, ipcMain, dialog } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { registerIpcHandlers } from './ipc-handlers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let win: BrowserWindow;

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  win = new BrowserWindow({
    width: Math.round(width * 0.8),
    height: Math.round(height * 0.8),
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
  const res = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: opts?.filters
  });
  return res.canceled ? null : (res.filePaths[0] ?? null);
});

ipcMain.handle('pick-directory', async () => {
  const res = await dialog.showOpenDialog(win, {
    properties: ['openDirectory']
  });
  return res.canceled ? null : (res.filePaths[0] ?? null);
});
