import fs from 'fs';

export interface SafeSuccess<T> {
  ok: true;
  data: T;
}

export interface SafeFailure {
  ok: false;
  error: { message: string; code?: string };
}

export type SafeResult<T> = SafeSuccess<T> | SafeFailure;

function wrap<T>(fn: () => T): SafeResult<T> {
  try {
    return { ok: true, data: fn() };
  } catch (err: any) {
    return { ok: false, error: { message: err?.message ?? 'Unknown error', code: err?.code } };
  }
}

export function readdirSync(path: string): SafeResult<string[]> {
  return wrap(() => fs.readdirSync(path));
}

export function readdirWithFileTypesSync(path: string): SafeResult<fs.Dirent[]> {
  return wrap(() => fs.readdirSync(path, { withFileTypes: true }));
}

export function readFileSync(path: string, encoding?: BufferEncoding): SafeResult<string> {
  return wrap(() => fs.readFileSync(path, encoding ?? 'utf-8'));
}

export function writeFileSync(
  path: string,
  data: string,
  options?: fs.WriteFileOptions
): SafeResult<void> {
  return wrap(() => {
    fs.writeFileSync(path, data, options);
  });
}

export function statSync(path: string): SafeResult<fs.Stats> {
  return wrap(() => fs.statSync(path));
}

export function lstatSync(path: string): SafeResult<fs.Stats> {
  return wrap(() => fs.lstatSync(path));
}

export function mkdirSync(path: string, options?: fs.MakeDirectoryOptions): SafeResult<void> {
  return wrap(() => {
    fs.mkdirSync(path, options);
  });
}

export function rmSync(path: string, options?: fs.RmOptions): SafeResult<void> {
  return wrap(() => {
    fs.rmSync(path, options);
  });
}

export function renameSync(oldPath: string, newPath: string): SafeResult<void> {
  return wrap(() => {
    fs.renameSync(oldPath, newPath);
  });
}

export function cpSync(src: string, dest: string, options?: fs.CopySyncOptions): SafeResult<void> {
  return wrap(() => {
    fs.cpSync(src, dest, options);
  });
}

export function readdirSafe(path: string): string[] {
  try {
    return fs.readdirSync(path);
  } catch {
    return [];
  }
}

export function existsSync(path: string): boolean {
  return fs.existsSync(path);
}
