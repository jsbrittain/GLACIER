import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

const mockSpawn = vi.hoisted(() => vi.fn());

vi.mock('child_process', () => ({
  spawn: mockSpawn
}));

vi.mock('slash', () => ({
  default: vi.fn((s) => s)
}));

vi.mock('../../src/main/paths.js', () => ({
  getConfigPath: vi.fn(() => '/tmp/collections'),
  getCollectionsPath: vi.fn(() => '/tmp/collections')
}));

import { runWorkflow, getAvailableProfiles } from '../../src/runners/nextflow/nextflow.js';

let mockChildProcess;
let origPlatform;

beforeEach(() => {
  origPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
  Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });

  const pid = 12345;
  mockChildProcess = {
    pid,
    on: vi.fn(),
    unref: vi.fn()
  };
  mockSpawn.mockReturnValue(mockChildProcess);
});

afterEach(() => {
  if (origPlatform) {
    Object.defineProperty(process, 'platform', origPlatform);
  }
  // Cleanup Windows-paths-that-are-relative on non-Windows runners
  ['C:\\Users\\test', 'C:\\test'].forEach((p) => {
    if (fs.existsSync(p)) {
      fs.rmSync(p, { recursive: true, force: true });
    }
  });
  vi.restoreAllMocks();
});

function makeInstance(opts = {}) {
  return {
    id: 'test-instance',
    name: 'test-name',
    path: '/tmp/instances/test',
    workflow_version: { path: '/tmp/workflows/owner/repo', version: 'v1.0' },
    ...opts
  };
}

describe('nextflow', () => {
  describe('getAvailableProfiles', () => {
    let configDir;

    afterEach(() => {
      if (configDir && fs.existsSync(configDir)) {
        fs.rmSync(configDir, { recursive: true, force: true });
      }
    });

    function instanceWithConfig(content) {
      configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nf-profiles-'));
      fs.writeFileSync(path.join(configDir, 'nextflow.config'), content, 'utf8');
      return makeInstance({ workflow_version: { path: configDir, version: 'v1.0' } });
    }

    it('returns standard when config file does not exist', async () => {
      const profiles = await getAvailableProfiles(makeInstance());

      expect(profiles).toEqual(['standard']);
    });

    it('returns standard when config has no profiles block', async () => {
      const profiles = await getAvailableProfiles(instanceWithConfig('// no profiles here\n'));

      expect(profiles).toEqual(['standard']);
    });

    it('extracts profile names from profiles block', async () => {
      const profiles = await getAvailableProfiles(
        instanceWithConfig(`
          profiles {
            standard { container = "ubuntu:latest" }
            test { container = "alpine:latest" }
          }
        `)
      );

      expect(profiles).toEqual(['standard', 'test']);
    });

    it('handles quoted profile names', async () => {
      const profiles = await getAvailableProfiles(
        instanceWithConfig(`
          profiles {
            'my-profile' { container = "ubuntu" }
            "other" { container = "alpine" }
          }
        `)
      );

      expect(profiles).toContain('my-profile');
      expect(profiles).toContain('other');
      expect(profiles).toContain('standard');
    });

    it('skips line comments within profiles block', async () => {
      const profiles = await getAvailableProfiles(
        instanceWithConfig(`
          profiles {
            standard { }
            // this is commented out
            debug { }
          }
        `)
      );

      expect(profiles).toContain('standard');
      expect(profiles).toContain('debug');
    });

    it('always includes standard even if missing from config', async () => {
      const profiles = await getAvailableProfiles(
        instanceWithConfig(`
          profiles {
            production { }
          }
        `)
      );

      expect(profiles).toContain('standard');
      expect(profiles).toContain('production');
    });

    it('returns profiles sorted alphabetically', async () => {
      const profiles = await getAvailableProfiles(
        instanceWithConfig(`
          profiles {
            test { }
            standard { }
            alpha { }
          }
        `)
      );

      expect(profiles).toEqual(['alpha', 'standard', 'test']);
    });

    it('handles malformed config with unclosed brace', async () => {
      const profiles = await getAvailableProfiles(
        instanceWithConfig(`
          profiles {
            test { }
        `)
      );

      expect(profiles).toEqual(['standard']);
    });

    it('handles read error gracefully', async () => {
      const instance = makeInstance({
        workflow_version: { path: '/nonexistent', version: 'v1.0' }
      });

      const profiles = await getAvailableProfiles(instance);

      expect(profiles).toEqual(['standard']);
    });
  });

  describe('runWorkflow — Unix, non-electron', () => {
    it('spawns nextflow with correct base arguments', async () => {
      await runWorkflow(makeInstance(), {});

      expect(mockSpawn).toHaveBeenCalledWith(
        'nextflow',
        expect.arrayContaining([
          'run',
          expect.stringContaining('main.nf'),
          '-work-dir',
          expect.any(String),
          '-profile',
          'standard',
          '-params-file',
          expect.any(String),
          '-name',
          expect.stringMatching(/^test-name-/)
        ]),
        expect.objectContaining({
          cwd: '/tmp/instances/test',
          stdio: ['ignore', expect.any(Number), expect.any(Number)],
          detached: true
        })
      );
    });

    it('returns the spawned process PID', async () => {
      const pid = await runWorkflow(makeInstance(), {});

      expect(pid.pid).toBe(12345);
      expect(pid.cmd).toContain('-log');
    });

    it('calls unref on the child process', async () => {
      await runWorkflow(makeInstance(), {});

      expect(mockChildProcess.unref).toHaveBeenCalled();
    });

    it('attaches error handler to the process', async () => {
      await runWorkflow(makeInstance(), {});

      expect(mockChildProcess.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('uses specified profile', async () => {
      await runWorkflow(makeInstance(), {}, { profile: 'test' });

      expect(mockSpawn).toHaveBeenCalledWith(
        'nextflow',
        expect.arrayContaining(['-profile', 'test']),
        expect.anything()
      );
    });

    it('appends -resume flag when resume is true', async () => {
      await runWorkflow(makeInstance(), {}, { resume: true });

      expect(mockSpawn).toHaveBeenCalledWith(
        'nextflow',
        expect.arrayContaining(['-resume']),
        expect.anything()
      );
    });

    it('does not append -resume when resume is false', async () => {
      await runWorkflow(makeInstance(), {}, { resume: false });

      const callArgs = mockSpawn.mock.calls[0][1];
      expect(callArgs).not.toContain('-resume');
    });
  });

  describe('runWorkflow — Unix, electron mode', () => {
    let origVersions;

    beforeEach(() => {
      origVersions = process.versions;
      Object.defineProperty(process, 'versions', {
        value: { ...process.versions, electron: '28.0.0' },
        configurable: true
      });
    });

    afterEach(() => {
      Object.defineProperty(process, 'versions', {
        value: origVersions,
        configurable: true
      });
    });

    it('spawns java with bundled JRE', async () => {
      await runWorkflow(makeInstance(), {});

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.stringContaining('java'),
        expect.arrayContaining([
          '-jar',
          expect.stringContaining('nextflow.jar'),
          'run',
          expect.any(String)
        ]),
        expect.objectContaining({
          env: expect.objectContaining({
            NXF_HOME: expect.any(String),
            NXF_JAVA_HOME: expect.any(String)
          })
        })
      );
    });

    it('passes JVM flags in electron mode', async () => {
      await runWorkflow(makeInstance(), {});

      const javaArgs = mockSpawn.mock.calls[0][1];
      expect(javaArgs).toEqual(
        expect.arrayContaining(['-Dfile.encoding=UTF-8', '--enable-native-access=ALL-UNNAMED'])
      );
    });

    it('uses java binary path as executable', async () => {
      await runWorkflow(makeInstance(), {});

      const binary = mockSpawn.mock.calls[0][0];
      expect(binary).toMatch(/java$/);
    });
  });

  describe('runWorkflow — Windows WSL', () => {
    // Note: is_windows is a module-level constant evaluated at import time.
    // These tests dynamically re-import the module after setting process.platform.

    let origPlatformWin;
    let winRunWorkflow;

    beforeEach(async () => {
      origPlatformWin = Object.getOwnPropertyDescriptor(process, 'platform');
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      vi.resetModules();
      const mod = await import('../../src/runners/nextflow/nextflow.js');
      winRunWorkflow = mod.runWorkflow;
    });

    afterEach(() => {
      if (origPlatformWin) {
        Object.defineProperty(process, 'platform', origPlatformWin);
      }
      // On non-Windows, the Windows paths 'C:\\Users\\test' and 'C:\\test'
      // are treated as relative paths and created under CWD by the real fs
      // calls inside runWorkflow. Clean them up to avoid untracked files.
      ['C:\\Users\\test', 'C:\\test'].forEach((p) => {
        if (fs.existsSync(p)) {
          fs.rmSync(p, { recursive: true, force: true });
        }
      });
    });

    it('spawns wsl.exe with bash wrapper', async () => {
      mockSpawn.mockReturnValue({ pid: 999, on: vi.fn(), unref: vi.fn() });

      await winRunWorkflow(makeInstance({ path: 'C:\\Users\\test' }), {});

      expect(mockSpawn).toHaveBeenCalledWith(
        'wsl.exe',
        expect.arrayContaining([
          '-d',
          'glacier',
          '-e',
          'bash',
          '-lc',
          expect.stringContaining('nextflow')
        ]),
        expect.objectContaining({
          cwd: 'C:\\Users\\test',
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true,
          detached: true
        })
      );
    });

    it('returns wsl process PID', async () => {
      mockSpawn.mockReturnValue({ pid: 999, on: vi.fn(), unref: vi.fn() });

      const pid = await winRunWorkflow(makeInstance({ path: 'C:\\test' }), {});

      expect(pid.pid).toBe(999);
      expect(pid.cmd).toContain('-log');
    });

    it('throws when wsl process has no pid', async () => {
      mockSpawn.mockReturnValue({ pid: null, on: vi.fn(), unref: vi.fn() });

      await expect(winRunWorkflow(makeInstance({ path: 'C:\\test' }), {})).rejects.toThrow(
        'Failed to spawn'
      );
    });
  });

  describe('runWorkflow — error paths', () => {
    it('returns null when spawned process has no pid', async () => {
      mockSpawn.mockReturnValue({ pid: null, on: vi.fn(), unref: vi.fn() });

      const result = await runWorkflow(makeInstance(), {});

      expect(result).toBeNull();
    });

    it('returns null when spawn throws synchronously', async () => {
      mockSpawn.mockImplementation(() => {
        throw new Error('spawn error');
      });

      const result = await runWorkflow(makeInstance(), {});
      expect(result).toBeNull();
    });

    it('does not crash when error event handler is called', async () => {
      let errorHandler;
      mockChildProcess.on.mockImplementation((event, handler) => {
        if (event === 'error') errorHandler = handler;
      });

      await runWorkflow(makeInstance(), {});

      expect(() => errorHandler(new Error('async error'))).not.toThrow();
      const result = errorHandler(new Error('async error'));
      expect(result).toBeNull();
    });
  });

  describe('runWorkflow — params handling', () => {
    it('writes params to glacier-params.json', async () => {
      const writeSpy = vi.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);

      await runWorkflow(makeInstance(), { key: 'value', num: 42 });

      expect(writeSpy).toHaveBeenCalledWith(
        expect.stringContaining('glacier-params.json'),
        JSON.stringify({ key: 'value', num: 42 }, null, 2),
        'utf8'
      );
    });

    it('skips writing glacier-params.json on resume', async () => {
      const writeSpy = vi.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);

      await runWorkflow(makeInstance(), {}, { resume: true });

      expect(writeSpy).not.toHaveBeenCalled();
    });

    it('creates work directory before spawning', async () => {
      const mkdirSpy = vi.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined);

      await runWorkflow(makeInstance(), {});

      expect(mkdirSpy).toHaveBeenCalledWith(expect.stringContaining('/work'), {
        recursive: true
      });
    });
  });
});
