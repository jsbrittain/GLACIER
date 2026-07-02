import { execFile } from 'child_process';

let _shell: any;

async function getElectronShell() {
  try {
    const electron = await import('electron');
    return electron.shell;
  } catch {
    return null;
  }
}

async function openElectronPath(filePath: string) {
  const shell = await getElectronShell();
  if (!shell?.openPath) return false;
  const error = await shell.openPath(filePath);
  if (error) throw new Error(error);
  return true;
}

async function openElectronExternal(url: string) {
  const shell = await getElectronShell();
  if (!shell?.openExternal) return false;
  await shell.openExternal(url);
  return true;
}

function execOpen(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    execFile(args[0], args.slice(1), (err) => (err ? reject(err) : resolve()));
  });
}

function openCommand(target: string, textEditor = false) {
  if (process.platform === 'darwin') return ['open', ...(textEditor ? ['-t'] : []), target];
  if (process.platform === 'win32') return ['cmd.exe', '/c', 'start', '', target];
  return ['xdg-open', target];
}

export async function getShell(): Promise<any> {
  if (!_shell) {
    _shell = {
      openPath: async (p: string) => {
        if (await openElectronPath(p)) return;
        await execOpen(openCommand(p));
      },
      openExternal: async (url: string) => {
        if (await openElectronExternal(url)) return;
        await execOpen(openCommand(url));
      },
      openInEditor: async (filePath: string) => {
        if (await openElectronPath(filePath)) return;
        await execOpen(openCommand(filePath, true));
      }
    };
  }
  return _shell;
}
