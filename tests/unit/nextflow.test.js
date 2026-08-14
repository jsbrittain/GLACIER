import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

const mockSpawn = vi.hoisted(() => vi.fn());

const mockSettings = vi.hoisted(() => ({
  get: vi.fn().mockReturnValue(undefined)
}));

vi.mock('child_process', () => ({
  spawn: mockSpawn
}));

vi.mock('slash', () => ({
  default: vi.fn((s) => s)
}));

vi.mock('../../src/main/settings.js', () => ({
  settings: mockSettings
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
  // Cleanup default instance test directory
  const defaultDir = path.resolve(DEFAULT_INSTANCE_PATH);
  if (fs.existsSync(defaultDir)) {
    fs.rmSync(defaultDir, { recursive: true, force: true });
  }
  vi.restoreAllMocks();
});

const DEFAULT_INSTANCE_PATH = '/tmp/instances/test';

function makeInstance(opts = {}) {
  if (!opts.path) {
    fs.mkdirSync(path.resolve(DEFAULT_INSTANCE_PATH), { recursive: true });
  }
  return {
    id: 'test-instance',
    name: 'test-name',
    path: DEFAULT_INSTANCE_PATH,
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
    let unixRunWorkflow;
    let origPlatformDarwin;

    beforeEach(async () => {
      origPlatformDarwin = Object.getOwnPropertyDescriptor(process, 'platform');
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
      vi.resetModules();
      const mod = await import('../../src/runners/nextflow/nextflow.js');
      unixRunWorkflow = mod.runWorkflow;
    });

    afterEach(() => {
      if (origPlatformDarwin) {
        Object.defineProperty(process, 'platform', origPlatformDarwin);
      }
    });

    it('spawns nextflow with correct base arguments', async () => {
      await unixRunWorkflow(makeInstance(), {});

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
      const pid = await unixRunWorkflow(makeInstance(), {});

      expect(pid.pid).toBe(12345);
      expect(pid.cmd).toContain('-log');
    });

    it('calls unref on the child process', async () => {
      await unixRunWorkflow(makeInstance(), {});

      expect(mockChildProcess.unref).toHaveBeenCalled();
    });

    it('attaches error handler to the process', async () => {
      await unixRunWorkflow(makeInstance(), {});

      expect(mockChildProcess.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('uses specified profile', async () => {
      await unixRunWorkflow(makeInstance(), {}, { profile: 'test' });

      expect(mockSpawn).toHaveBeenCalledWith(
        'nextflow',
        expect.arrayContaining(['-profile', 'test']),
        expect.anything()
      );
    });

    it('appends -resume flag when resume is true', async () => {
      await unixRunWorkflow(makeInstance(), {}, { resume: true });

      expect(mockSpawn).toHaveBeenCalledWith(
        'nextflow',
        expect.arrayContaining(['-resume']),
        expect.anything()
      );
    });

    it('does not append -resume when resume is false', async () => {
      await unixRunWorkflow(makeInstance(), {}, { resume: false });

      const callArgs = mockSpawn.mock.calls[0][1];
      expect(callArgs).not.toContain('-resume');
    });

    it('injects NXF_SYNTAX_PARSER=v2 when set to 2', async () => {
      mockSettings.get.mockReturnValue('2');

      await unixRunWorkflow(makeInstance(), {});

      expect(mockSpawn).toHaveBeenCalledWith(
        'nextflow',
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({ NXF_SYNTAX_PARSER: 'v2' })
        })
      );
    });

    it('injects NXF_SYNTAX_PARSER=v1 when set to 1', async () => {
      mockSettings.get.mockReturnValue('1');

      await unixRunWorkflow(makeInstance(), {});

      const env = mockSpawn.mock.calls[0][2].env;
      expect(env.NXF_SYNTAX_PARSER).toBe('v1');
    });

    it('does not inject NXF_SYNTAX_PARSER when unset', async () => {
      mockSettings.get.mockReturnValue(undefined);

      await unixRunWorkflow(makeInstance(), {});

      const env = mockSpawn.mock.calls[0][2].env;
      expect(env.NXF_SYNTAX_PARSER).toBeUndefined();
    });
  });

  describe('runWorkflow — Unix, electron mode', () => {
    let electronRunWorkflow;
    let origPlatformDarwin;
    let origVersions;

    beforeEach(async () => {
      origPlatformDarwin = Object.getOwnPropertyDescriptor(process, 'platform');
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
      origVersions = process.versions;
      Object.defineProperty(process, 'versions', {
        value: { ...process.versions, electron: '28.0.0' },
        configurable: true
      });
      vi.resetModules();
      const mod = await import('../../src/runners/nextflow/nextflow.js');
      electronRunWorkflow = mod.runWorkflow;
    });

    afterEach(() => {
      if (origPlatformDarwin) {
        Object.defineProperty(process, 'platform', origPlatformDarwin);
      }
      Object.defineProperty(process, 'versions', {
        value: origVersions,
        configurable: true
      });
    });

    it('spawns java with bundled JRE', async () => {
      await electronRunWorkflow(makeInstance(), {});

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
      await electronRunWorkflow(makeInstance(), {});

      const javaArgs = mockSpawn.mock.calls[0][1];
      expect(javaArgs).toEqual(
        expect.arrayContaining(['-Dfile.encoding=UTF-8', '--enable-native-access=ALL-UNNAMED'])
      );
    });

    it('uses java binary path as executable', async () => {
      await electronRunWorkflow(makeInstance(), {});

      const binary = mockSpawn.mock.calls[0][0];
      expect(binary).toMatch(/java$/);
    });

    it('electron mode injects NXF_SYNTAX_PARSER=v2', async () => {
      mockSettings.get.mockReturnValue('2');

      await electronRunWorkflow(makeInstance(), {});

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.stringContaining('java'),
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            NXF_HOME: expect.any(String),
            NXF_JAVA_HOME: expect.any(String),
            NXF_SYNTAX_PARSER: 'v2'
          })
        })
      );
    });

    it('electron mode does not inject NXF_SYNTAX_PARSER when unset', async () => {
      mockSettings.get.mockReturnValue(undefined);

      await electronRunWorkflow(makeInstance(), {});

      const env = mockSpawn.mock.calls[0][2].env;
      expect(env.NXF_SYNTAX_PARSER).toBeUndefined();
    });
  });

  describe('runWorkflow — error paths', () => {
    let errorRunWorkflow;
    let origPlatformDarwin;

    beforeEach(async () => {
      origPlatformDarwin = Object.getOwnPropertyDescriptor(process, 'platform');
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
      vi.resetModules();
      const mod = await import('../../src/runners/nextflow/nextflow.js');
      errorRunWorkflow = mod.runWorkflow;
    });

    afterEach(() => {
      if (origPlatformDarwin) {
        Object.defineProperty(process, 'platform', origPlatformDarwin);
      }
    });

    it('returns null when spawned process has no pid', async () => {
      mockSpawn.mockReturnValue({ pid: null, on: vi.fn(), unref: vi.fn() });

      const result = await errorRunWorkflow(makeInstance(), {});

      expect(result).toBeNull();
    });

    it('returns null when spawn throws synchronously', async () => {
      mockSpawn.mockImplementation(() => {
        throw new Error('spawn error');
      });

      const result = await errorRunWorkflow(makeInstance(), {});
      expect(result).toBeNull();
    });

    it('does not crash when error event handler is called', async () => {
      let errorHandler;
      mockChildProcess.on.mockImplementation((event, handler) => {
        if (event === 'error') errorHandler = handler;
      });

      await errorRunWorkflow(makeInstance(), {});

      expect(() => errorHandler(new Error('async error'))).not.toThrow();
      const result = errorHandler(new Error('async error'));
      expect(result).toBeNull();
    });
  });

  describe('runWorkflow — params handling', () => {
    let paramsRunWorkflow;
    let origPlatformDarwin;

    beforeEach(async () => {
      origPlatformDarwin = Object.getOwnPropertyDescriptor(process, 'platform');
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
      vi.resetModules();
      const mod = await import('../../src/runners/nextflow/nextflow.js');
      paramsRunWorkflow = mod.runWorkflow;
    });

    afterEach(() => {
      if (origPlatformDarwin) {
        Object.defineProperty(process, 'platform', origPlatformDarwin);
      }
    });

    it('writes params to glacier-params.json', async () => {
      const writeSpy = vi.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);

      await paramsRunWorkflow(makeInstance(), { key: 'value', num: 42 });

      expect(writeSpy).toHaveBeenCalledWith(
        expect.stringContaining('glacier-params.json'),
        JSON.stringify({ key: 'value', num: 42 }, null, 2),
        'utf8'
      );
    });

    it('skips writing glacier-params.json on resume', async () => {
      const writeSpy = vi.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);

      await paramsRunWorkflow(makeInstance(), {}, { resume: true });

      expect(writeSpy).not.toHaveBeenCalled();
    });

    it('creates work directory before spawning', async () => {
      const mkdirSpy = vi.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined);

      await paramsRunWorkflow(makeInstance(), {});

      expect(mkdirSpy).toHaveBeenCalledWith(expect.stringContaining('work'), {
        recursive: true
      });
    });

    it('writes nextflow.config with CPU limit', async () => {
      mockSettings.get.mockImplementation((key) => {
        if (key === 'resourceLimitsCpu') return 4;
        return 0;
      });
      const writeSpy = vi.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);

      await paramsRunWorkflow(makeInstance(), {});

      const calls = writeSpy.mock.calls.filter(
        ([p]) => typeof p === 'string' && p.endsWith('nextflow.config')
      );
      expect(calls.length).toBe(1);
      expect(calls[0][1]).toContain('cpus: 4');
      expect(calls[0][1]).not.toContain('memory');
    });

    it('writes nextflow.config with memory limit', async () => {
      mockSettings.get.mockImplementation((key) => {
        if (key === 'resourceLimitsMemory') return 8;
        return 0;
      });
      const writeSpy = vi.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);

      await paramsRunWorkflow(makeInstance(), {});

      const calls = writeSpy.mock.calls.filter(
        ([p]) => typeof p === 'string' && p.endsWith('nextflow.config')
      );
      expect(calls.length).toBe(1);
      expect(calls[0][1]).toContain("memory: '8.GB'");
      expect(calls[0][1]).not.toContain('cpus');
    });

    it('writes nextflow.config with both limits', async () => {
      mockSettings.get.mockImplementation((key) => {
        if (key === 'resourceLimitsCpu') return 4;
        if (key === 'resourceLimitsMemory') return 8;
        return 0;
      });
      const writeSpy = vi.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);

      await paramsRunWorkflow(makeInstance(), {});

      const calls = writeSpy.mock.calls.filter(
        ([p]) => typeof p === 'string' && p.endsWith('nextflow.config')
      );
      expect(calls.length).toBe(1);
      expect(calls[0][1]).toContain('cpus: 4');
      expect(calls[0][1]).toContain("memory: '8.GB'");
    });

    it('does not write nextflow.config when limits are 0', async () => {
      mockSettings.get.mockImplementation((key) => 0);
      const writeSpy = vi.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);

      await paramsRunWorkflow(makeInstance(), {});

      const calls = writeSpy.mock.calls.filter(
        ([p]) => typeof p === 'string' && p.endsWith('nextflow.config')
      );
      expect(calls.length).toBe(0);
    });

    it('writes user.config when customNextflowConfig is set', async () => {
      mockSettings.get.mockImplementation((key) => {
        if (key === 'customNextflowConfig') return 'trace { enabled = true }';
        return 0;
      });
      const writeSpy = vi.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);

      await paramsRunWorkflow(makeInstance(), {});

      const calls = writeSpy.mock.calls.filter(
        ([p]) => typeof p === 'string' && p.endsWith('user.config')
      );
      expect(calls.length).toBe(1);
      expect(calls[0][1]).toContain('trace { enabled = true }');
    });

    it('appends -c user.config to spawn args when config is set', async () => {
      mockSettings.get.mockImplementation((key) => {
        if (key === 'customNextflowConfig') return 'some config';
        return 0;
      });
      vi.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);

      await paramsRunWorkflow(makeInstance(), {});

      expect(mockSpawn).toHaveBeenCalledWith(
        'nextflow',
        expect.arrayContaining(['-c', 'user.config']),
        expect.anything()
      );
    });

    it('does not write user.config when config is empty', async () => {
      mockSettings.get.mockImplementation((key) => {
        if (key === 'customNextflowConfig') return '';
        return 0;
      });
      const writeSpy = vi.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);

      await paramsRunWorkflow(makeInstance(), {});

      const calls = writeSpy.mock.calls.filter(
        ([p]) => typeof p === 'string' && p.endsWith('user.config')
      );
      expect(calls.length).toBe(0);
    });
  });

  describe('runWorkflow — profile persistence and recall', () => {
    let profileRunWorkflow;
    let origPlatformDarwin;
    let configDir;

    beforeEach(async () => {
      origPlatformDarwin = Object.getOwnPropertyDescriptor(process, 'platform');
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
      vi.resetModules();
      const mod = await import('../../src/runners/nextflow/nextflow.js');
      profileRunWorkflow = mod.runWorkflow;
    });

    afterEach(() => {
      if (origPlatformDarwin) {
        Object.defineProperty(process, 'platform', origPlatformDarwin);
      }
      if (configDir && fs.existsSync(configDir)) {
        fs.rmSync(configDir, { recursive: true, force: true });
      }
    });

    function instanceWithConfig(content) {
      configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nf-profile-'));
      fs.writeFileSync(path.join(configDir, 'nextflow.config'), content, 'utf8');
      return makeInstance({ workflow_version: { path: configDir, version: 'v1.0' } });
    }

    it('persists the selected profile on fresh launch', async () => {
      const writeSpy = vi.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);

      await profileRunWorkflow(makeInstance(), {}, { profile: 'conda' });

      expect(writeSpy).toHaveBeenCalledWith(
        expect.stringContaining('glacier-profile.json'),
        JSON.stringify({ profile: 'conda' }),
        'utf8'
      );
      expect(mockSpawn).toHaveBeenCalledWith(
        'nextflow',
        expect.arrayContaining(['-profile', 'conda']),
        expect.anything()
      );
    });

    it('resume recalls the profile saved at launch', async () => {
      makeInstance();
      fs.writeFileSync(
        path.resolve(DEFAULT_INSTANCE_PATH, 'glacier-profile.json'),
        JSON.stringify({ profile: 'conda' }),
        'utf8'
      );

      await profileRunWorkflow(makeInstance(), {}, { resume: true });

      expect(mockSpawn).toHaveBeenCalledWith(
        'nextflow',
        expect.arrayContaining(['-profile', 'conda', '-resume']),
        expect.anything()
      );
    });

    it('resume defaults to docker when no profile saved and workflow defines it', async () => {
      await profileRunWorkflow(
        instanceWithConfig(`
          profiles {
            docker { }
            standard { }
          }
        `),
        {},
        { resume: true }
      );

      expect(mockSpawn).toHaveBeenCalledWith(
        'nextflow',
        expect.arrayContaining(['-profile', 'docker', '-resume']),
        expect.anything()
      );
    });

    it('resume falls back to standard when no profile saved and no docker profile', async () => {
      await profileRunWorkflow(makeInstance(), {}, { resume: true });

      expect(mockSpawn).toHaveBeenCalledWith(
        'nextflow',
        expect.arrayContaining(['-profile', 'standard', '-resume']),
        expect.anything()
      );
    });

    it('fresh launch defaults to docker when no explicit profile and workflow defines it', async () => {
      await profileRunWorkflow(
        instanceWithConfig(`
          profiles {
            docker { }
            standard { }
          }
        `),
        {}
      );

      expect(mockSpawn).toHaveBeenCalledWith(
        'nextflow',
        expect.arrayContaining(['-profile', 'docker']),
        expect.anything()
      );
    });
  });
});
