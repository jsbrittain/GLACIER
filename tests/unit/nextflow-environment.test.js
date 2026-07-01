import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import { Writable } from 'stream';

const mockExecFileSync = vi.hoisted(() => vi.fn());
const mockSpawn = vi.hoisted(() => vi.fn());
const mockHttpsGet = vi.hoisted(() => vi.fn());

const mockCreateWriteStream = vi.hoisted(() => vi.fn());

vi.mock('child_process', () => ({
  execFileSync: mockExecFileSync,
  spawn: mockSpawn
}));

vi.mock('https', () => ({
  default: { get: mockHttpsGet }
}));

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    createWriteStream: mockCreateWriteStream
  };
});

let origPlatform;
let tmpHome;
let fs;

beforeEach(async () => {
  fs = await vi.importActual('fs');
  origPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
  Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'env-test-'));
  process.env.HOME = tmpHome;
});

afterEach(() => {
  if (origPlatform) {
    Object.defineProperty(process, 'platform', origPlatform);
  }
  if (tmpHome && fs.existsSync(tmpHome)) {
    fs.rmSync(tmpHome, { recursive: true, force: true });
  }
  vi.restoreAllMocks();
});

async function importEnv() {
  vi.resetModules();
  return await import('../../src/runners/nextflow/environment.js');
}

function makeMockResponse(writeStream) {
  return {
    statusCode: 200,
    pipe: vi.fn().mockImplementation((dest) => {
      dest._writableState = dest._writableState || {};
      return dest;
    })
  };
}

describe('nextflow-environment', () => {
  describe('nextflowStatus (unix)', () => {
    it('returns info when docker is installed and in web mode', async () => {
      mockExecFileSync.mockImplementation((cmd) => {
        if (cmd === 'docker') return true;
        throw new Error('not found');
      });
      const env = await importEnv();

      const status = await env.nextflowStatus();

      expect(status).toHaveLength(2);
      expect(status[0].title).toBe('Nextflow');
      expect(status[0].status).toBe('info');
      expect(status[1].title).toBe('Docker');
      expect(status[1].status).toBe('info');
    });

    it('returns docker warning without action in web mode', async () => {
      mockExecFileSync.mockImplementation(() => {
        throw new Error('not found');
      });
      const env = await importEnv();

      const status = await env.nextflowStatus();

      const dockerItem = status.find((s) => s.title === 'Docker');
      expect(dockerItem.status).toBe('warning');
      expect(dockerItem.actions).toEqual([]);
    });

    it('returns docker warning with install action in electron mode', async () => {
      mockExecFileSync.mockImplementation(() => {
        throw new Error('not found');
      });
      Object.defineProperty(process, 'versions', {
        value: { ...process.versions, electron: '28.0.0' },
        configurable: true
      });
      const env = await importEnv();

      const status = await env.nextflowStatus();

      const dockerItem = status.find((s) => s.title === 'Docker');
      expect(dockerItem.status).toBe('warning');
      expect(dockerItem.actions).toEqual([
        { action: 'install.docker', label: 'Download Docker Desktop' }
      ]);
      delete process.versions.electron;
    });
  });

  describe('nextflowStatus (windows)', () => {
    it('returns wsl install prompt when wsl is missing', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      mockExecFileSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });
      const env = await importEnv();

      const status = await env.nextflowStatus();

      expect(status).toHaveLength(1);
      expect(status[0].title).toContain('Windows Subsystem for Linux');
      expect(status[0].status).toBe('warning');
      expect(status[0].actions).toEqual([{ action: 'install.wsl2', label: 'Install WSL2' }]);
    });

    it('returns configure prompt when wsl installed but no distro', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      let callCount = 0;
      mockExecFileSync.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return true;
        throw new Error('distro not found');
      });
      const env = await importEnv();

      const status = await env.nextflowStatus();

      expect(status[0].title).toContain('Configuration');
      expect(status[0].status).toBe('warning');
    });

    it('returns info when wsl and distro are ready', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      mockExecFileSync.mockReturnValue('Nextflow version 23.0.0');
      const env = await importEnv();

      const status = await env.nextflowStatus();

      expect(status[0].title).toBe('Nextflow');
      expect(status[0].status).toBe('info');
    });
  });

  describe('nextflowAction', () => {
    it('install.nextflow calls installNextflow', async () => {
      const writeStream = new Writable({
        write(chunk, encoding, callback) {
          callback();
        }
      });
      mockCreateWriteStream.mockReturnValue(writeStream);
      const mockProcess = {
        on: vi.fn((event, cb) => {
          if (event === 'close') cb(0);
        })
      };
      mockSpawn.mockReturnValue(mockProcess);
      mockHttpsGet.mockImplementation((url, cb) => {
        const res = makeMockResponse(writeStream);
        cb(res);
        setTimeout(() => {
          const realFs = require('fs');
          const p = path.join(tmpHome, 'GLACIER', 'bin', 'nextflow');
          if (!realFs.existsSync(p)) realFs.writeFileSync(p, '');
          writeStream.emit('finish');
        }, 50);
        return { on: vi.fn() };
      });
      const env = await importEnv();

      const result = await env.nextflowAction('install.nextflow');

      expect(mockCreateWriteStream).toHaveBeenCalled();
      expect(result).toEqual({ ok: true });
    }, 10000);

    it('install.wsl2 calls execFileSync with wsl', async () => {
      mockExecFileSync.mockReturnValue(true);
      const env = await importEnv();

      await env.nextflowAction('install.wsl2');

      expect(mockExecFileSync).toHaveBeenCalledWith('wsl', [], { stdio: 'ignore' });
    });

    it('install.wsl2.distro triggers distro setup', async () => {
      const writeStream = new Writable({
        write(chunk, encoding, callback) {
          callback();
        }
      });
      mockCreateWriteStream.mockReturnValue(writeStream);
      mockExecFileSync.mockReturnValue('');
      mockHttpsGet.mockImplementation((url, cb) => {
        const res = makeMockResponse(writeStream);
        cb(res);
        setTimeout(() => writeStream.emit('finish'), 50);
        return { on: vi.fn() };
      });
      const env = await importEnv();

      const result = await env.nextflowAction('install.wsl2.distro');

      expect(mockCreateWriteStream).toHaveBeenCalled();
      expect(result).toEqual({ ok: true });
    }, 10000);

    it('install.docker opens external URL', async () => {
      const env = await importEnv();
      const { shell } = await import('electron');

      await env.nextflowAction('install.docker');

      expect(shell.openExternal).toHaveBeenCalledWith(
        'https://www.docker.com/products/docker-desktop/'
      );
    });

    it('throws for unknown action', async () => {
      const env = await importEnv();

      await expect(env.nextflowAction('unknown.action')).rejects.toThrow('Unknown Nextflow action');
    });
  });

  describe('internal helpers (tested through nextflowStatus)', () => {
    it('checkExecutable returns true when command succeeds', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      mockExecFileSync.mockReturnValue('version output');
      const env = await importEnv();

      const status = await env.nextflowStatus();

      expect(status[0].title).toBe('Nextflow');
      expect(status[0].status).toBe('info');
    });

    it('checkExecutable returns false when command throws', async () => {
      mockExecFileSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });
      const env = await importEnv();

      const status = await env.nextflowStatus();

      const dockerItem = status.find((s) => s.title === 'Docker');
      expect(dockerItem.status).toBe('warning');
    });

    it('callExecutable returns stdout on success', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      mockExecFileSync.mockReturnValue('Nextflow version 23.0.0');
      const env = await importEnv();

      const status = await env.nextflowStatus();

      expect(status[0].title).toBe('Nextflow');
    });
  });
});
