import { execFile } from 'child_process';

let _shell: any;

export async function getShell(): Promise<any> {
  if (!_shell) {
    const osCmd =
      process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
    _shell = {
      openPath: (p: string) =>
        new Promise<void>((resolve, reject) => {
          execFile(osCmd, [p], (err) => (err ? reject(err) : resolve()));
        }),
      openExternal: (url: string) =>
        new Promise<void>((resolve, reject) => {
          execFile(osCmd, [url], (err) => (err ? reject(err) : resolve()));
        })
    };
  }
  return _shell;
}
