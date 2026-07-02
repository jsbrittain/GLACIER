import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import { Writable } from 'stream';

const mockExecFileSync = vi.hoisted(() => vi.fn());
const mockSpawn = vi.hoisted(() => vi.fn());
const mockHttpsGet = vi.hoisted(() => vi.fn());

const mockCreateWriteStream = vi.hoisted(() => vi.fn());

const mockExecFile = vi.hoisted(() => vi.fn());

vi.mock('child_process', () => ({
  execFileSync: mockExecFileSync,
  execFile: mockExecFile,
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
      mockExecFile.mockImplementation((_file, _args, _options, callback) => {
        callback(new Error('ENOENT'), null, '');
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
      mockExecFile.mockImplementation((file, args, _options, callback) => {
        if (file === 'wsl' && args[0] === '--version') {
          callback(null, 'WSL version: 2.3.26.0\n', '');
        } else {
          callback(new Error('distro not found'), null, '');
        }
      });
      const env = await importEnv();

      const status = await env.nextflowStatus();

      expect(status[0].title).toContain('Configuration');
      expect(status[0].status).toBe('warning');
    });

    it('handles utf-16 encoded wsl --version output with null bytes', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      mockExecFile.mockImplementation((file, args, _options, callback) => {
        if (file === 'wsl' && args[0] === '--version') {
          callback(
            null,
            'W\x00S\x00L\x00 \x00v\x00e\x00r\x00s\x00i\x00o\x00n\x00:\x00 \x002\x00.\x007\x00.\x001\x000\x00.\x000\x00\r\x00\n\x00',
            ''
          );
        } else {
          callback(new Error('distro not found'), null, '');
        }
      });
      const env = await importEnv();

      const status = await env.nextflowStatus();

      expect(status[0].title).toContain('Configuration');
      expect(status[0].status).toBe('warning');
    });

    it('returns update prompt when wsl version is too old for systemd', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      mockExecFile.mockImplementation((file, args, _options, callback) => {
        if (file === 'wsl' && args[0] === '--version') {
          callback(null, 'WSL version: 0.60.0\n', '');
        } else {
          callback(new Error('not found'), null, '');
        }
      });
      const env = await importEnv();

      const status = await env.nextflowStatus();

      expect(status).toHaveLength(1);
      expect(status[0].title).toContain('Update Required');
      expect(status[0].status).toBe('warning');
      expect(status[0].actions).toEqual([{ action: 'update.wsl2', label: 'Update WSL' }]);
    });

    it('returns update prompt with version when wsl version is too old', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      mockExecFile.mockImplementation((file, args, _options, callback) => {
        if (file === 'wsl' && args[0] === '--version') {
          callback(null, 'WSL version: 0.50.1\n', '');
        } else {
          callback(new Error('not found'), null, '');
        }
      });
      const env = await importEnv();

      const status = await env.nextflowStatus();

      expect(status[0].description).toContain('0.50.1');
      expect(status[0].description).toContain('0.67.6');
    });

    it('proceeds past version check when wsl meets minimum version', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      mockExecFile.mockImplementation((file, args, _options, callback) => {
        if (file === 'wsl' && args[0] === '--version') {
          callback(null, 'WSL version: 0.67.6\n', '');
        } else if (file === 'wsl' && args.includes('nextflow')) {
          callback(null, 'Nextflow version 23.0.0\n', '');
        } else if (
          file === 'wsl' &&
          args.includes('-lc') &&
          args.join(' ').includes('docker info')
        ) {
          callback(null, '', '');
        } else {
          callback(null, '', '');
        }
      });
      const env = await importEnv();

      const status = await env.nextflowStatus();

      expect(status[0].title).toBe('Windows Subsystem for Linux');
      expect(status[0].status).toBe('info');
    });

    it('returns info when wsl and distro are ready', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      mockExecFile.mockImplementation((file, args, _options, callback) => {
        if (file === 'wsl' && args[0] === '--version') {
          callback(null, 'WSL version: 2.3.26.0\n', '');
        } else {
          callback(null, 'Nextflow version 23.0.0\n', '');
        }
      });
      const env = await importEnv();

      const status = await env.nextflowStatus();

      expect(status[0].title).toBe('Windows Subsystem for Linux');
      expect(status[0].status).toBe('info');
    });

    it('returns docker warning when the WSL docker daemon is not accessible', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      mockExecFile.mockImplementation((file, args, _options, callback) => {
        if (file === 'wsl' && args[0] === '--version') {
          callback(null, 'WSL version: 2.3.26.0\n', '');
        } else if (
          file === 'wsl' &&
          args.includes('-lc') &&
          args.join(' ').includes('docker info')
        ) {
          callback(new Error('docker is not running'), null, '');
        } else {
          callback(null, 'Nextflow version 23.0.0\n', '');
        }
      });
      const env = await importEnv();

      const status = await env.nextflowStatus();

      const dockerItem = status.find((s) => s.title === 'Docker');
      expect(dockerItem.status).toBe('warning');
      expect(dockerItem.description).toContain('not currently accessible');
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

    it('update.wsl2 calls wsl --update', async () => {
      mockExecFileSync.mockReturnValue('');
      const env = await importEnv();

      const result = await env.nextflowAction('update.wsl2');

      expect(mockExecFileSync).toHaveBeenCalledWith('wsl', ['--update'], { stdio: 'inherit' });
      expect(result).toEqual({ ok: true });
    });

    it('update.wsl2 throws when wsl --update fails', async () => {
      mockExecFileSync.mockImplementation(() => {
        throw new Error('wsl update failed');
      });
      const env = await importEnv();

      await expect(env.nextflowAction('update.wsl2')).rejects.toThrow(
        'WSL update failed: wsl update failed'
      );
    });

    it('install.wsl2.distro imports the bundled distro without downloading Ubuntu', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      const { app } = await import('electron');
      app.getAppPath.mockReturnValue(tmpHome);
      const bundledImage = path.join(tmpHome, 'bundle', 'wsl', 'glacier-wsl.tar');
      fs.mkdirSync(path.dirname(bundledImage), { recursive: true });
      fs.writeFileSync(bundledImage, 'fake bundled image');
      mockExecFileSync.mockImplementation((cmd, args = []) => {
        if (cmd === 'wsl' && args[0] === '--version') return 'WSL version: 2.3.26.0';
        return '';
      });
      const env = await importEnv();

      const result = await env.nextflowAction('install.wsl2.distro');

      const importCall = mockExecFileSync.mock.calls.find(
        ([cmd, args]) => cmd === 'wsl' && args[0] === '--import'
      );
      expect(importCall).toBeDefined();
      expect(importCall[1][3]).toBe(bundledImage);
      expect(mockHttpsGet).not.toHaveBeenCalled();
      expect(mockCreateWriteStream).not.toHaveBeenCalled();
      expect(result).toEqual({ ok: true });
    });

    it('install.wsl2.distro succeeds when bundled import works but docker is not ready', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      const { app } = await import('electron');
      app.getAppPath.mockReturnValue(tmpHome);
      const bundledImage = path.join(tmpHome, 'bundle', 'wsl', 'glacier-wsl.tar');
      fs.mkdirSync(path.dirname(bundledImage), { recursive: true });
      fs.writeFileSync(bundledImage, 'fake bundled image');
      mockExecFileSync.mockImplementation((cmd, args = []) => {
        if (cmd === 'wsl' && args[0] === '--version') return 'WSL version: 2.3.26.0';
        if (cmd === 'wsl' && args.includes('-lc') && args.join(' ').includes('docker info')) {
          throw new Error('docker is not running');
        }
        return '';
      });
      const env = await importEnv();

      const result = await env.nextflowAction('install.wsl2.distro');

      expect(result).toEqual({ ok: true });
      expect(mockHttpsGet).not.toHaveBeenCalled();
      expect(mockCreateWriteStream).not.toHaveBeenCalled();
    });

    it('install.wsl2.distro fails when the bundled distro is missing', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      mockExecFileSync.mockImplementation((cmd, args = []) => {
        if (cmd === 'wsl' && args[0] === '--version') return 'WSL version: 2.3.26.0';
        throw new Error('not found');
      });
      const { app } = await import('electron');
      app.getAppPath.mockReturnValue(tmpHome);
      const env = await importEnv();

      await expect(env.nextflowAction('install.wsl2.distro')).rejects.toThrow(
        'Bundled GLACIER WSL image not found'
      );
      expect(mockHttpsGet).not.toHaveBeenCalled();
      expect(mockCreateWriteStream).not.toHaveBeenCalled();
      expect(mockExecFileSync).not.toHaveBeenCalledWith(
        'wsl',
        ['--unregister', 'glacier'],
        expect.anything()
      );
    });

    it('install.wsl2.distro fails when wsl version is too old for systemd', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      mockExecFileSync.mockImplementation((cmd, args = []) => {
        if (cmd === 'wsl' && args[0] === '--version') return 'WSL version: 0.50.0';
        throw new Error('not found');
      });
      const env = await importEnv();

      await expect(env.nextflowAction('install.wsl2.distro')).rejects.toThrow(
        'does not support systemd'
      );
      expect(mockHttpsGet).not.toHaveBeenCalled();
      expect(mockCreateWriteStream).not.toHaveBeenCalled();
    });

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
      mockExecFile.mockImplementation((file, args, _options, callback) => {
        if (file === 'wsl' && args[0] === '--version') {
          callback(null, 'WSL version: 2.3.26.0\n', '');
        } else {
          callback(null, 'version output\n', '');
        }
      });
      const env = await importEnv();

      const status = await env.nextflowStatus();

      expect(status[0].title).toBe('Windows Subsystem for Linux');
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
      mockExecFile.mockImplementation((file, args, _options, callback) => {
        if (file === 'wsl' && args[0] === '--version') {
          callback(null, 'WSL version: 2.3.26.0\n', '');
        } else {
          callback(null, 'Nextflow version 23.0.0\n', '');
        }
      });
      const env = await importEnv();

      const status = await env.nextflowStatus();

      expect(status[0].title).toBe('Windows Subsystem for Linux');
    });
  });
});
