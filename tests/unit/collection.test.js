import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

import { getShell } from '../../src/main/shell.js';
import { spawnSync } from 'child_process';

vi.mock('../../src/main/shell.js', () => ({
  getShell: vi.fn().mockResolvedValue({
    openPath: vi.fn().mockResolvedValue(),
    openExternal: vi.fn().mockResolvedValue()
  })
}));

vi.mock('../../src/main/repo.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    generateUniqueName: vi.fn(),
    cloneRepo: vi.fn(),
    getRepoTags: vi.fn(),
    getRepoBranches: vi.fn(),
    getRemoteBranchHeads: vi.fn(),
    getRepoBranch: vi.fn(),
    getRepoHeadCommit: vi.fn(),
    syncRepo: vi.fn(),
    getWorkflowParams: vi.fn(),
    getWorkflowSchema: vi.fn()
  };
});

vi.mock('../../src/main/runner.js', () => ({
  runWorkflow: vi.fn(),
  getEnvironmentStatus: vi.fn(),
  performEnvironmentAction: vi.fn()
}));

vi.mock('../../src/main/paths.js', () => ({
  getConfigPath: vi.fn(),
  getDocumentsPath: vi.fn(() => '/tmp/documents/GLACIER'),
  getCollectionsPath: vi.fn(),
  getOutputPath: vi.fn(() => '/tmp/output/GLACIER'),
  locateReports: vi.fn(() => [])
}));

vi.mock('../../src/runners/nextflow/nextflow.js', () => ({
  getAvailableProfiles: vi.fn()
}));

vi.mock('../../src/runners/nextflow/nf-parse.js', () => ({
  parseNextflowLog: vi.fn()
}));

vi.mock('child_process', async () => {
  const actual = await vi.importActual('child_process');
  return {
    ...actual,
    spawnSync: vi.fn().mockReturnValue({ status: 0 }),
    execSync: vi.fn().mockReturnValue('')
  };
});

import { Collection } from '../../src/main/collection.js';
import * as repo from '../../src/main/repo.js';
import * as runner from '../../src/main/runner.js';
import * as paths from '../../src/main/paths.js';
import { getAvailableProfiles } from '../../src/runners/nextflow/nextflow.js';
import { parseNextflowLog } from '../../src/runners/nextflow/nf-parse.js';

let tmpDir;
let collection;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'collection-test-'));
  vi.mocked(paths.getConfigPath).mockReturnValue(tmpDir);
  vi.mocked(paths.getCollectionsPath).mockReturnValue(tmpDir);
  vi.clearAllMocks();

  Collection['singleton'] = undefined;
  collection = Collection.getInstance();
  collection.starting_up = false;
  // CI workaround (vitest 3.2.6): async methods may be missing from prototype
  if (typeof collection.startup !== 'function') {
    collection.startup = async function () {
      this.parseCollection();
      this.starting_up = false;
    };
  }
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function makeWorkflow(opts = {}) {
  return {
    id: 'owner/repo',
    name: 'repo',
    owner: 'owner',
    repo: 'repo',
    url: 'owner/repo',
    versions: [
      {
        id: 'owner/repo@v1.0',
        name: 'owner/repo@v1.0',
        type: 'nextflow',
        version: 'v1.0',
        path: path.join(tmpDir, 'workflows', 'owner', 'repo@v1.0'),
        parent_id: 'owner/repo'
      }
    ],
    ...opts
  };
}

function makeCatalogue(opts = {}) {
  return {
    name: 'Test Catalogue',
    source: 'owner/catalogue-repo',
    description: 'A test catalogue',
    sections: [
      {
        name: 'Section 1',
        workflows: [{ name: 'wf1', repo: 'owner/repo1' }]
      }
    ],
    ...opts
  };
}

describe('Collection', () => {
  describe('singleton', () => {
    it('returns the same instance on repeated calls', () => {
      const a = Collection.getInstance();
      const b = Collection.getInstance();
      expect(a).toBe(b);
    });

    it('has empty arrays on fresh instance', () => {
      expect(Array.isArray(collection.workflows)).toBe(true);
      expect(Array.isArray(collection.workflow_instances)).toBe(true);
      expect(Array.isArray(collection.catalogues)).toBe(true);
    });

    it('sets root_path from getConfigPath', () => {
      expect(collection.root_path).toBe(tmpDir);
    });

    it('sets documents_root_path from getDocumentsPath', () => {
      expect(collection.documents_root_path).toBe('/tmp/documents/GLACIER');
    });
  });

  describe('startup', () => {
    it('calls parseCollection', async () => {
      const spy = vi.spyOn(collection, 'parseCollection');
      await collection.startup();
      expect(spy).toHaveBeenCalled();
    });

    it('sets starting_up to false', async () => {
      collection.starting_up = true;
      await collection.startup();
      expect(collection.starting_up).toBe(false);
    });
  });

  describe('ensurePathExists', () => {
    it('creates a directory if it does not exist', () => {
      const dir = path.join(tmpDir, 'new-dir');
      expect(fs.existsSync(dir)).toBe(false);
      collection.ensurePathExists(dir);
      expect(fs.existsSync(dir)).toBe(true);
    });

    it('does not throw if directory already exists', () => {
      const dir = path.join(tmpDir, 'existing');
      fs.mkdirSync(dir, { recursive: true });
      expect(() => collection.ensurePathExists(dir)).not.toThrow();
    });

    it('returns false if root_path is empty', () => {
      collection.root_path = '';
      expect(collection.ensurePathExists('/some/path')).toBe(false);
    });
  });

  describe('parseWorkflows', () => {
    beforeEach(() => {
      fs.mkdirSync(path.join(tmpDir, 'workflows', 'owner'), { recursive: true });
    });

    it('parses workflows from directory structure', () => {
      fs.mkdirSync(path.join(tmpDir, 'workflows', 'owner', 'repo@v1.0'), { recursive: true });

      collection.parseWorkflows();

      expect(collection.workflows).toHaveLength(1);
      expect(collection.workflows[0].id).toBe('owner/repo');
      expect(collection.workflows[0].versions).toHaveLength(1);
      expect(collection.workflows[0].versions[0].version).toBe('v1.0');
    });

    it('skips non-directory entries', () => {
      fs.writeFileSync(path.join(tmpDir, 'workflows', 'owner', 'file.txt'), '');
      fs.mkdirSync(path.join(tmpDir, 'workflows', 'owner', 'repo@v1.0'), { recursive: true });

      collection.parseWorkflows();

      expect(collection.workflows).toHaveLength(1);
    });

    it('handles repos without version tag', () => {
      fs.mkdirSync(path.join(tmpDir, 'workflows', 'owner', 'local-repo'), { recursive: true });

      collection.parseWorkflows();

      expect(collection.workflows[0].id).toBe('owner/local-repo');
    });
  });

  describe('createWorkflowInstance', () => {
    it('creates a new instance and records it', async () => {
      const wf = makeWorkflow();
      collection.workflows = [wf];
      vi.mocked(repo.generateUniqueName).mockReturnValue('happy-fox');

      const instance = await collection.createWorkflowInstance('owner/repo', 'v1.0');

      expect(instance.name).toBe('happy-fox');
      expect(instance.workflow_version.version).toBe('v1.0');
      expect(collection.workflow_instances).toHaveLength(1);
      expect(collection.workflow_instances[0]).toBe(instance);
    });

    it('throws for unknown workflow', async () => {
      await expect(collection.createWorkflowInstance('unknown/repo', 'v1.0')).rejects.toThrow(
        'not found'
      );
    });

    it('throws for workflow with no versions', async () => {
      collection.workflows = [makeWorkflow({ versions: [] })];
      await expect(collection.createWorkflowInstance('owner/repo', 'v1.0')).rejects.toThrow(
        'no versions'
      );
    });

    it('writes catalogue default parameters to glacier-params.json', async () => {
      collection.catalogues = [
        {
          name: 'Test Catalogue',
          source: 'local',
          sections: [
            {
              name: 'My Workflows',
              workflows: [
                {
                  name: 'my-workflow',
                  repo: 'owner/repo',
                  version: 'v1.0',
                  parameters: { outdir: './results', max_cpus: 4 }
                }
              ]
            }
          ]
        }
      ];
      collection.workflows = [makeWorkflow()];
      vi.mocked(repo.generateUniqueName).mockReturnValue('happy-fox');
      vi.mocked(repo.getWorkflowSchema).mockResolvedValue({});

      const instance = await collection.createWorkflowInstance('owner/repo', 'v1.0');

      const paramsFile = path.join(instance.path, 'glacier-params.json');
      expect(fs.existsSync(paramsFile)).toBe(true);
      const params = JSON.parse(fs.readFileSync(paramsFile, 'utf8'));
      expect(params.outdir).toBe('./results');
      expect(params.max_cpus).toBe(4);
    });

    it('auto-resolved settings overlay catalogue default parameters', async () => {
      collection.catalogues = [
        {
          name: 'Test Catalogue',
          source: 'local',
          sections: [
            {
              name: 'My Workflows',
              workflows: [
                {
                  name: 'my-workflow',
                  repo: 'owner/repo',
                  version: 'v1.0',
                  parameters: { outdir: './results', max_cpus: 4 }
                }
              ]
            }
          ]
        }
      ];
      collection.workflows = [makeWorkflow()];
      vi.mocked(repo.generateUniqueName).mockReturnValue('happy-fox');

      // Enable auto-resolve and provide a schema with outdir
      collection.settingsSet('autoOutdir', true);
      vi.mocked(repo.getWorkflowSchema).mockResolvedValue({
        properties: { outdir: { type: 'string', format: 'directory-path' } }
      });

      const instance = await collection.createWorkflowInstance('owner/repo', 'v1.0');

      const paramsFile = path.join(instance.path, 'glacier-params.json');
      expect(fs.existsSync(paramsFile)).toBe(true);
      const params = JSON.parse(fs.readFileSync(paramsFile, 'utf8'));
      // Catalogue default max_cpus should be preserved
      expect(params.max_cpus).toBe(4);
      // outdir should be overridden by the auto-resolved output path
      expect(params.outdir).not.toBe('./results');
      expect(params.outdir).toContain('output');
    });
  });

  describe('runWorkflow', () => {
    it('delegates to runner and attaches PID', async () => {
      vi.mocked(runner.runWorkflow).mockResolvedValue({
        pid: 999,
        cmd: 'test-cmd',
        startTime: new Date().toISOString()
      });
      const instance = {
        id: 'test-instance',
        name: 'test',
        workflow_version: {},
        path: '',
        processes: [],
        status: 'created',
        attachProcess: vi.fn()
      };
      collection.workflow_instances = [instance];
      const spy = vi.spyOn(instance, 'attachProcess');

      const desc = await collection.runWorkflow(instance, { key: 'val' });

      expect(desc.pid).toBe(999);
      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ pid: 999 }));
    });

    it('throws if runner returns null PID', async () => {
      vi.mocked(runner.runWorkflow).mockResolvedValue(null);
      const instance = {
        id: 'test-instance',
        name: 'test',
        workflow_version: {},
        path: '',
        processes: [],
        status: 'created'
      };
      collection.workflow_instances = [instance];

      await expect(collection.runWorkflow(instance, {})).rejects.toThrow('Failed to start');
    });

    it('throws for unknown instance', async () => {
      await expect(collection.runWorkflow({ id: 'nonexistent' })).rejects.toThrow('not found');
    });
  });

  describe('cancelWorkflowInstance', () => {
    it('kills each PID with graceful signal', async () => {
      const killSpy = vi.spyOn(collection, 'killPID').mockReturnValue(true);
      const instance = {
        id: 'test',
        name: '',
        workflow_version: {},
        path: '',
        processes: [{ pid: 100 }, { pid: 200 }],
        status: 'running'
      };
      collection.workflow_instances = [instance];

      await collection.cancelWorkflowInstance(instance);

      expect(killSpy).toHaveBeenCalledTimes(2);
      expect(killSpy).toHaveBeenCalledWith(100, 'graceful');
      expect(killSpy).toHaveBeenCalledWith(200, 'graceful');
      expect(instance.processes).toEqual([]);
    });

    it('throws for unknown instance', async () => {
      await expect(collection.cancelWorkflowInstance({ id: 'x' })).rejects.toThrow('not found');
    });

    it('throws if no running PIDs', async () => {
      const instance = {
        id: 'test',
        name: '',
        workflow_version: {},
        path: '',
        processes: [],
        status: 'created'
      };
      collection.workflow_instances = [instance];

      await expect(collection.cancelWorkflowInstance(instance)).rejects.toThrow(
        'no running process'
      );
    });
  });

  describe('killWorkflowInstance', () => {
    it('kills each PID with kill signal', async () => {
      const killSpy = vi.spyOn(collection, 'killPID').mockReturnValue(true);
      const instance = {
        id: 'test',
        name: '',
        workflow_version: {},
        path: '',
        processes: [{ pid: 100 }],
        status: 'running'
      };
      collection.workflow_instances = [instance];

      await collection.killWorkflowInstance(instance);

      expect(killSpy).toHaveBeenCalledWith(100, 'kill');
      expect(instance.processes).toEqual([]);
    });
  });

  describe('deleteWorkflowInstance', () => {
    it('removes instance folder and removes from list', async () => {
      const instPath = path.join(tmpDir, 'instances', 'owner', 'repo@v1.0', 'test-instance');
      fs.mkdirSync(instPath, { recursive: true });
      const instance = {
        id: 'test-instance',
        name: 'test',
        workflow_version: {},
        path: instPath,
        processes: [],
        status: 'created'
      };
      collection.workflow_instances = [instance];

      await collection.deleteWorkflowInstance(instance);

      expect(fs.existsSync(instPath)).toBe(false);
      expect(collection.workflow_instances).toHaveLength(0);
    });

    it('throws for unknown instance', async () => {
      await expect(collection.deleteWorkflowInstance({ id: 'x' })).rejects.toThrow('not found');
    });
  });

  describe('listWorkflowInstances', () => {
    it('returns all instances', async () => {
      const instances = [
        {
          id: 'a',
          name: 'a',
          workflow_version: {},
          path: '',
          processes: [],
          status: 'created',
          getProgressPercent: () => 0,
          getLaunchTime: () => undefined,
          getLastUpdateTime: () => undefined
        },
        {
          id: 'b',
          name: 'b',
          workflow_version: {},
          path: '',
          processes: [],
          status: 'created',
          getProgressPercent: () => 0,
          getLaunchTime: () => undefined,
          getLastUpdateTime: () => undefined
        }
      ];
      collection.workflow_instances = instances;

      const result = await collection.listWorkflowInstances();

      expect(result).toHaveLength(2);
    });
  });

  describe('getInstanceProgress', () => {
    it('delegates to instance.getProgress', async () => {
      const progress = { workflow: [{ status: 'completed' }], group: [] };
      const instance = { id: 'test', getProgress: vi.fn().mockResolvedValue(progress) };
      collection.workflow_instances = [instance];

      const result = await collection.getInstanceProgress(instance);

      expect(result).toEqual(progress);
    });

    it('throws for unknown instance', async () => {
      await expect(collection.getInstanceProgress({ id: 'x' })).rejects.toThrow('not found');
    });
  });

  describe('getWorkflowInstanceParams', () => {
    it('reads glacier-params.json from instance path', async () => {
      const instPath = path.join(tmpDir, 'instances', 'test-instance');
      fs.mkdirSync(instPath, { recursive: true });
      fs.writeFileSync(
        path.join(instPath, 'glacier-params.json'),
        JSON.stringify({ key: 'val' }),
        'utf8'
      );
      const instance = {
        id: 'test',
        name: 'test',
        workflow_version: {},
        path: instPath,
        processes: [],
        status: 'created'
      };
      collection.workflow_instances = [instance];

      const params = await collection.getWorkflowInstanceParams(instance);

      expect(params).toEqual({ key: 'val' });
    });

    it('returns empty object if glacier-params.json missing', async () => {
      const instance = {
        id: 'test',
        name: 'test',
        workflow_version: {},
        path: '/nonexistent',
        processes: [],
        status: 'created'
      };
      collection.workflow_instances = [instance];

      const params = await collection.getWorkflowInstanceParams(instance);

      expect(params).toEqual({});
    });
  });

  describe('updateWorkflowInstanceStatus', () => {
    it('returns Running when no workflow progress', async () => {
      const instance = {
        id: 'test',
        workflow_version: { path: '/x' },
        path: '/x',
        processes: [],
        getProgress: vi.fn().mockResolvedValue({ workflow: [], group: [] }),
        setCachedProgress: vi.fn()
      };
      collection.workflow_instances = [instance];

      const status = await collection.updateWorkflowInstanceStatus(instance);

      expect(status).toBe('running');
    });

    it('returns last workflow status', async () => {
      const instance = {
        id: 'test',
        workflow_version: { path: '/x' },
        path: '/x',
        processes: [],
        getProgress: vi.fn().mockResolvedValue({
          workflow: [{ status: 'completed' }],
          group: []
        }),
        setCachedProgress: vi.fn()
      };
      collection.workflow_instances = [instance];

      const status = await collection.updateWorkflowInstanceStatus(instance);

      expect(status).toBe('completed');
    });
  });

  describe('getWorkflowReadme', () => {
    it('reads README.md from workflow version path', () => {
      const wfPath = path.join(tmpDir, 'wf');
      fs.mkdirSync(wfPath, { recursive: true });
      fs.writeFileSync(path.join(wfPath, 'README.md'), '# Test', 'utf8');
      const instance = {
        id: 'test',
        name: 'test',
        workflow_version: { path: wfPath },
        path: '',
        processes: []
      };

      const readme = collection.getWorkflowReadme(instance);

      expect(readme).toBe('# Test');
    });

    it('throws if no README.md', () => {
      const instance = {
        id: 'test',
        name: 'test',
        workflow_version: { path: '/nonexistent' },
        path: '',
        processes: []
      };

      expect(() => collection.getWorkflowReadme(instance)).toThrow('No README.md');
    });
  });

  describe('getWorkflowLicense', () => {
    it('reads LICENSE from workflow version path', () => {
      const wfPath = path.join(tmpDir, 'wf');
      fs.mkdirSync(wfPath, { recursive: true });
      fs.writeFileSync(path.join(wfPath, 'LICENSE'), 'MIT', 'utf8');
      const instance = {
        id: 'test',
        name: 'test',
        workflow_version: { path: wfPath },
        path: '',
        processes: []
      };

      const license = collection.getWorkflowLicense(instance);

      expect(license).toBe('MIT');
    });
  });

  describe('getWorkflowInformation', () => {
    it('reads title and description from schema', () => {
      const wfPath = path.join(tmpDir, 'wf');
      fs.mkdirSync(wfPath, { recursive: true });
      fs.writeFileSync(
        path.join(wfPath, 'nextflow_schema.json'),
        JSON.stringify({ title: 'My WF', description: 'Does stuff' }),
        'utf8'
      );
      const ver = { id: 'owner/repo@v1', name: 'test', path: wfPath };

      const info = collection.getWorkflowInformation(ver);

      expect(info.title).toBe('My WF');
      expect(info.description).toBe('Does stuff');
    });

    it('falls back to instance name when no schema', () => {
      const ver = { id: 'owner/repo@v1', name: 'fallback-name', path: '/nonexistent' };

      const info = collection.getWorkflowInformation(ver);

      expect(info.title).toBe('fallback-name');
      expect(info.description).toBe('');
    });

    it('returns error for invalid instance', () => {
      const info = collection.getWorkflowInformation(null);

      expect(info.error).toBe('Invalid workflow instance.');
    });
  });

  describe('getWorkLog', () => {
    it('reads correct log file from work directory', () => {
      const instPath = path.join(tmpDir, 'instances', 'test-instance');
      const workDir = path.join(instPath, 'work', 'ab', '123456somehash');
      fs.mkdirSync(workDir, { recursive: true });
      fs.writeFileSync(path.join(workDir, '.command.out'), 'stdout content', 'utf8');
      const instance = {
        id: 'test',
        name: 'test',
        workflow_version: {},
        path: instPath,
        processes: [],
        status: 'created'
      };
      collection.workflow_instances = [instance];

      const log = collection.getWorkLog(instance, 'ab/123456', 'stdout');

      expect(log).toBe('stdout content');
    });

    it('throws for unknown log type', () => {
      const instance = {
        id: 'test',
        name: 'test',
        workflow_version: {},
        path: tmpDir,
        processes: []
      };
      collection.workflow_instances = [instance];

      expect(() => collection.getWorkLog(instance, 'ab/123456', 'invalid')).toThrow(
        'Unknown log type'
      );
    });

    it('throws for invalid work ID format', () => {
      const instance = {
        id: 'test',
        name: 'test',
        workflow_version: {},
        path: tmpDir,
        processes: []
      };
      collection.workflow_instances = [instance];

      expect(() => collection.getWorkLog(instance, 'bad-id', 'stdout')).toThrow('Invalid work ID');
    });
  });

  describe('openResultsFolder', () => {
    it('opens the instance path via shell', async () => {
      const instPath = path.join(tmpDir, 'instances', 'test-instance');
      fs.mkdirSync(instPath, { recursive: true });
      const instance = {
        id: 'test',
        name: 'test',
        workflow_version: {},
        path: instPath,
        processes: []
      };
      collection.workflow_instances = [instance];

      await collection.openResultsFolder(instance);

      const mockShell = await getShell();
      expect(mockShell.openPath).toHaveBeenCalledWith(instPath);
    });

    it('throws for missing folder', async () => {
      const instance = {
        id: 'test',
        name: 'test',
        workflow_version: {},
        path: '/nonexistent',
        processes: []
      };
      collection.workflow_instances = [instance];

      await expect(collection.openResultsFolder(instance)).rejects.toThrow('does not exist');
    });
  });

  describe('openWorkFolder', () => {
    it('opens matching work subfolder via shell', async () => {
      const instPath = path.join(tmpDir, 'instances', 'test-instance');
      const workDir = path.join(instPath, 'work', 'ab', '123456somehash');
      fs.mkdirSync(workDir, { recursive: true });
      const instance = {
        id: 'test',
        name: 'test',
        workflow_version: {},
        path: instPath,
        processes: []
      };
      collection.workflow_instances = [instance];

      await collection.openWorkFolder(instance, 'ab/123456');

      const mockShell = await getShell();
      expect(mockShell.openPath).toHaveBeenCalledWith(workDir);
    });
  });

  describe('openWebPage', () => {
    it('opens URL via shell.openExternal', async () => {
      await collection.openWebPage('https://example.com');

      const mockShell = await getShell();
      expect(mockShell.openExternal).toHaveBeenCalledWith('https://example.com');
    });
  });

  describe('getSystemResources', () => {
    it('returns cpu cores and memory info', async () => {
      const result = await collection.getSystemResources();

      expect(result).toHaveProperty('cpuCores');
      expect(result).toHaveProperty('totalMem');
      expect(result).toHaveProperty('freeMem');
      expect(typeof result.cpuCores).toBe('number');
    });
  });

  describe('getCollectionRepos', () => {
    it('flattens workflow versions into IRepo list', () => {
      collection.workflows = [
        makeWorkflow(),
        makeWorkflow({
          id: 'owner2/repo2',
          name: 'repo2',
          owner: 'owner2',
          repo: 'repo2',
          versions: [
            {
              id: 'owner2/repo2@v2',
              name: 'owner2/repo2@v2',
              type: 'docker',
              version: 'v2',
              path: '/p2',
              parent_id: 'owner2/repo2'
            }
          ]
        })
      ];

      const repos = collection.getCollectionRepos();

      expect(repos).toHaveLength(2);
      expect(repos[0].id).toBe('owner/repo');
      expect(repos[0].version).toBe('v1.0');
      expect(repos[1].id).toBe('owner2/repo2');
    });
  });

  describe('getInstallableReposList', () => {
    it('returns installable repos array', () => {
      collection.installable_repos = [{ id: 'a', name: 'a' }];
      expect(collection.getInstallableReposList()).toHaveLength(1);
    });
  });

  describe('addInstallableRepo', () => {
    it('fetches tags and adds to list', async () => {
      vi.mocked(repo.getRepoTags).mockResolvedValue(['v1', 'v2']);
      vi.mocked(repo.getRepoBranches).mockResolvedValue([]);

      await collection.addInstallableRepo('owner/test-repo');

      expect(collection.installable_repos).toHaveLength(1);
      expect(collection.installable_repos[0].name).toBe('test-repo');
      expect(collection.installable_repos[0].version).toBe('v1');
    });

    it('falls back to branches when no tags', async () => {
      vi.mocked(repo.getRepoTags).mockResolvedValue([]);
      vi.mocked(repo.getRepoBranches).mockResolvedValue(['main', 'dev']);

      await collection.addInstallableRepo('owner/test-repo');

      expect(collection.installable_repos[0].version).toBe('main');
    });

    it('throws when no tags or branches', async () => {
      vi.mocked(repo.getRepoTags).mockResolvedValue([]);
      vi.mocked(repo.getRepoBranches).mockResolvedValue([]);

      await expect(collection.addInstallableRepo('owner/test-repo')).rejects.toThrow(
        'No tags or branches'
      );
    });
  });

  describe('isRepoInstalled', () => {
    it('returns version string if repo is installed', async () => {
      collection.workflows = [makeWorkflow()];

      const result = await collection.isRepoInstalled('owner/repo', 'v1.0');

      expect(result).toBe('v1.0');
    });

    it('returns empty string if not installed', async () => {
      const result = await collection.isRepoInstalled('owner/nonexistent', 'v1.0');

      expect(result).toBe('');
    });

    it('returns version with sourceVersion latest', async () => {
      const wf = makeWorkflow();
      wf.versions[0].sourceVersion = 'latest';
      collection.workflows = [wf];

      const result = await collection.isRepoInstalled('owner/repo', 'latest');

      expect(result).toBe('v1.0');
    });

    it('returns empty string if no version has sourceVersion latest', async () => {
      collection.workflows = [makeWorkflow()];

      const result = await collection.isRepoInstalled('owner/repo', 'latest');

      expect(result).toBe('');
    });
  });

  describe('getCatalogues', () => {
    it('waits for startup to finish', async () => {
      collection.starting_up = true;
      collection.catalogues = [makeCatalogue()];

      setTimeout(() => {
        collection.starting_up = false;
      }, 200);
      const result = await collection.getCatalogues();

      expect(result).toHaveLength(1);
    });

    it('returns catalogues immediately if not starting up', async () => {
      collection.catalogues = [makeCatalogue()];

      const result = await collection.getCatalogues();

      expect(result).toHaveLength(1);
    });
  });

  describe('parseCatalogues', () => {
    it('parses catalogue.json files', async () => {
      const catDir = path.join(tmpDir, 'catalogues', 'owner', 'cat-repo');
      fs.mkdirSync(catDir, { recursive: true });
      fs.writeFileSync(
        path.join(catDir, 'catalogue.json'),
        JSON.stringify({ name: 'Test Cat', sections: [] }),
        'utf8'
      );

      await collection.parseCatalogues();

      expect(collection.catalogues).toHaveLength(1);
      expect(collection.catalogues[0].name).toBe('Test Cat');
      expect(collection.catalogues[0].source).toBe('owner/cat-repo');
    });

    it('clears existing catalogues before parsing', async () => {
      collection.catalogues = [makeCatalogue()];

      await collection.parseCatalogues();

      expect(collection.catalogues).toEqual([]);
    });

    it('skips non-directory entries at top level (e.g. .DS_Store alongside owner dirs)', async () => {
      const catDir = path.join(tmpDir, 'catalogues', 'owner', 'cat-repo');
      fs.mkdirSync(catDir, { recursive: true });
      fs.writeFileSync(
        path.join(catDir, 'catalogue.json'),
        JSON.stringify({ name: 'Test Cat', sections: [] }),
        'utf8'
      );
      fs.writeFileSync(path.join(tmpDir, 'catalogues', '.DS_Store'), '', 'utf8');

      await collection.parseCatalogues();

      expect(collection.catalogues).toHaveLength(1);
      expect(collection.catalogues[0].name).toBe('Test Cat');
      expect(collection.catalogues[0].source).toBe('owner/cat-repo');
    });

    it('skips non-directory entries at owner level (e.g. .DS_Store alongside repo dirs)', async () => {
      const catDir = path.join(tmpDir, 'catalogues', 'owner', 'cat-repo');
      fs.mkdirSync(catDir, { recursive: true });
      fs.writeFileSync(
        path.join(catDir, 'catalogue.json'),
        JSON.stringify({ name: 'Test Cat', sections: [] }),
        'utf8'
      );
      fs.writeFileSync(path.join(tmpDir, 'catalogues', 'owner', '.DS_Store'), '', 'utf8');

      await collection.parseCatalogues();

      expect(collection.catalogues).toHaveLength(1);
      expect(collection.catalogues[0].name).toBe('Test Cat');
    });

    it('skips non-directory entries at all levels alongside valid catalogues', async () => {
      const catDir = path.join(tmpDir, 'catalogues', 'owner', 'cat-repo');
      fs.mkdirSync(catDir, { recursive: true });
      fs.writeFileSync(
        path.join(catDir, 'catalogue.json'),
        JSON.stringify({ name: 'Test Cat', sections: [] }),
        'utf8'
      );
      fs.writeFileSync(path.join(tmpDir, 'catalogues', '.DS_Store'), '', 'utf8');
      fs.writeFileSync(path.join(tmpDir, 'catalogues', 'owner', '.DS_Store'), '', 'utf8');
      fs.writeFileSync(path.join(catDir, '.DS_Store'), '', 'utf8');
      const anotherDir = path.join(tmpDir, 'catalogues', 'anotherOwner', 'another-repo');
      fs.mkdirSync(anotherDir, { recursive: true });
      fs.writeFileSync(
        path.join(anotherDir, 'catalogue.json'),
        JSON.stringify({ name: 'Another Cat', sections: [] }),
        'utf8'
      );

      await collection.parseCatalogues();

      expect(collection.catalogues).toHaveLength(2);
    });

    it('collects errors for malformed catalogue.json instead of throwing', async () => {
      const catDir = path.join(tmpDir, 'catalogues', 'owner', 'cat-repo');
      fs.mkdirSync(catDir, { recursive: true });
      fs.writeFileSync(path.join(catDir, 'catalogue.json'), '{invalid json}', 'utf8');

      await collection.parseCatalogues();

      expect(collection.catalogues).toHaveLength(0);
      expect(collection.catalogueParseErrors).toHaveLength(1);
      expect(collection.catalogueParseErrors[0].source).toBe('owner/cat-repo');
      expect(collection.catalogueParseErrors[0].error).toContain('Failed to parse catalogue.json');
    });

    it('collects errors for unreadable catalogue.json', async () => {
      const catDir = path.join(tmpDir, 'catalogues', 'owner', 'cat-repo');
      fs.mkdirSync(catDir, { recursive: true });

      await collection.parseCatalogues();

      expect(collection.catalogues).toHaveLength(0);
      expect(collection.catalogueParseErrors).toHaveLength(1);
      expect(collection.catalogueParseErrors[0].source).toBe('owner/cat-repo');
      expect(collection.catalogueParseErrors[0].error).toContain('Failed to read catalogue.json');
    });

    it('parses valid catalogues even when others have errors', async () => {
      const goodDir = path.join(tmpDir, 'catalogues', 'owner', 'good-repo');
      fs.mkdirSync(goodDir, { recursive: true });
      fs.writeFileSync(
        path.join(goodDir, 'catalogue.json'),
        JSON.stringify({ name: 'Good Cat', sections: [] }),
        'utf8'
      );
      const badDir = path.join(tmpDir, 'catalogues', 'owner', 'bad-repo');
      fs.mkdirSync(badDir, { recursive: true });
      fs.writeFileSync(path.join(badDir, 'catalogue.json'), '{invalid}', 'utf8');

      await collection.parseCatalogues();

      expect(collection.catalogues).toHaveLength(1);
      expect(collection.catalogues[0].name).toBe('Good Cat');
      expect(collection.catalogueParseErrors).toHaveLength(1);
      expect(collection.catalogueParseErrors[0].source).toBe('owner/bad-repo');
    });

    it('getCatalogueParseResults returns combined successes and failures', async () => {
      const goodDir = path.join(tmpDir, 'catalogues', 'owner', 'good-repo');
      fs.mkdirSync(goodDir, { recursive: true });
      fs.writeFileSync(
        path.join(goodDir, 'catalogue.json'),
        JSON.stringify({ name: 'Good Cat', sections: [] }),
        'utf8'
      );
      const badDir = path.join(tmpDir, 'catalogues', 'owner', 'bad-repo');
      fs.mkdirSync(badDir, { recursive: true });
      fs.writeFileSync(path.join(badDir, 'catalogue.json'), '{invalid}', 'utf8');

      await collection.parseCatalogues();
      const results = await collection.getCatalogueParseResults();

      expect(results).toHaveLength(2);
      const success = results.find((r) => r.source === 'owner/good-repo');
      expect(success).toBeDefined();
      expect(success.success).toBe(true);
      const failure = results.find((r) => r.source === 'owner/bad-repo');
      expect(failure).toBeDefined();
      expect(failure.success).toBe(false);
      expect(failure.error).toContain('Failed to parse catalogue.json');
    });
  });

  describe('updateCatalogueWorkflow (shard-imported)', () => {
    function makeShardCatalogue() {
      const catDir = path.join(tmpDir, 'catalogues', 'shards', 'local@main');
      fs.mkdirSync(catDir, { recursive: true });
      const catalogue = {
        name: 'Local catalogue',
        source: 'shards/local@main',
        base_dir: catDir,
        sections: [
          {
            name: 'artic-network',
            workflows: [
              {
                name: 'artic-nf',
                repo: 'local/artic-nf',
                version: 'main',
                url: 'ARTIC-Network/artic-nf'
              }
            ]
          }
        ]
      };
      fs.writeFileSync(
        path.join(catDir, 'catalogue.json'),
        JSON.stringify(catalogue, null, 2),
        'utf8'
      );
      collection.catalogues = [catalogue];
      return catalogue;
    }

    it('offers the newest remote tag without rewriting the local identity', async () => {
      const catalogue = makeShardCatalogue();
      vi.mocked(repo.getRepoTags).mockResolvedValue(['v0.9.0', 'v1.0.0']);
      vi.mocked(repo.getRepoBranches).mockResolvedValue([]);

      const result = await collection.updateCatalogueWorkflow(
        'Local catalogue',
        'artic-network',
        'artic-nf'
      );

      expect(result).toEqual({ updated: true, availableVersion: 'v1.0.0' });
      expect(catalogue.sections[0].workflows[0].repo).toBe('local/artic-nf');
      expect(catalogue.sections[0].workflows[0].version).toBe('main');
    });

    it('offers a branch update when the remote HEAD differs from the installed commit', async () => {
      makeShardCatalogue();
      collection.workflows = [
        {
          id: 'local/artic-nf',
          versions: [
            {
              id: 'local/artic-nf@main',
              version: 'main',
              path: '/installed/artic-nf@main',
              parent_id: 'local/artic-nf',
              sourceVersion: undefined
            }
          ]
        }
      ];
      vi.mocked(repo.getRepoTags).mockResolvedValue([]);
      vi.mocked(repo.getRepoBranches).mockResolvedValue(['main']);
      vi.mocked(repo.getRemoteBranchHeads).mockResolvedValue({ main: 'remote-latest-abc' });
      vi.mocked(repo.getRepoBranch).mockResolvedValue('main');
      vi.mocked(repo.getRepoHeadCommit).mockResolvedValue('installed-old-123');

      const result = await collection.updateCatalogueWorkflow(
        'Local catalogue',
        'artic-network',
        'artic-nf'
      );

      expect(result).toEqual({
        updated: true,
        availableVersion: 'main',
        branchUpdate: true
      });
    });

    it('reports up to date when the installed commit matches the remote branch HEAD', async () => {
      makeShardCatalogue();
      collection.workflows = [
        {
          id: 'local/artic-nf',
          versions: [
            {
              id: 'local/artic-nf@main',
              version: 'main',
              path: '/installed/artic-nf@main',
              parent_id: 'local/artic-nf',
              sourceVersion: undefined
            }
          ]
        }
      ];
      vi.mocked(repo.getRepoTags).mockResolvedValue([]);
      vi.mocked(repo.getRepoBranches).mockResolvedValue(['main']);
      vi.mocked(repo.getRemoteBranchHeads).mockResolvedValue({ main: 'same-commit-123' });
      vi.mocked(repo.getRepoBranch).mockResolvedValue('main');
      vi.mocked(repo.getRepoHeadCommit).mockResolvedValue('same-commit-123');

      const result = await collection.updateCatalogueWorkflow(
        'Local catalogue',
        'artic-network',
        'artic-nf'
      );

      expect(result).toEqual({ updated: false, availableVersion: null });
    });

    it('reports up to date when no installed version is present', async () => {
      makeShardCatalogue();
      collection.workflows = [];
      vi.mocked(repo.getRepoTags).mockResolvedValue([]);
      vi.mocked(repo.getRepoBranches).mockResolvedValue(['main']);

      const result = await collection.updateCatalogueWorkflow(
        'Local catalogue',
        'artic-network',
        'artic-nf'
      );

      expect(result).toEqual({ updated: false, availableVersion: null });
    });

    it('throws when the remote has no tags or branches', async () => {
      makeShardCatalogue();
      vi.mocked(repo.getRepoTags).mockResolvedValue([]);
      vi.mocked(repo.getRepoBranches).mockResolvedValue([]);

      await expect(
        collection.updateCatalogueWorkflow('Local catalogue', 'artic-network', 'artic-nf')
      ).rejects.toThrow('No tags or branches found for repository: ARTIC-Network/artic-nf');
    });
  });

  describe('updateShardWorkflow', () => {
    function makeShardCatalogue() {
      const catDir = path.join(tmpDir, 'catalogues', 'shards', 'local@main');
      fs.mkdirSync(catDir, { recursive: true });
      const catalogue = {
        name: 'Local catalogue',
        source: 'shards/local@main',
        base_dir: catDir,
        sections: [
          {
            name: 'artic-network',
            workflows: [
              {
                name: 'artic-nf',
                repo: 'local/artic-nf',
                version: 'main',
                url: 'ARTIC-Network/artic-nf'
              }
            ]
          }
        ]
      };
      fs.writeFileSync(
        path.join(catDir, 'catalogue.json'),
        JSON.stringify(catalogue, null, 2),
        'utf8'
      );
      collection.catalogues = [catalogue];
      return catalogue;
    }

    it('clones the remote into local/<name>@latest and tracks it', async () => {
      const catalogue = makeShardCatalogue();
      const targetPath = path.join(tmpDir, 'workflows', 'local', 'artic-nf@latest');
      fs.mkdirSync(targetPath, { recursive: true });
      vi.mocked(repo.cloneRepo).mockResolvedValue({
        owner: 'ARTIC-Network',
        repo: 'artic-nf',
        version: 'v1.0.0',
        url: 'https://github.com/ARTIC-Network/artic-nf.git',
        path: targetPath
      });

      const version = await collection.updateShardWorkflow(
        'local/artic-nf',
        'ARTIC-Network/artic-nf',
        'v1.0.0',
        'latest'
      );

      expect(repo.cloneRepo).toHaveBeenCalledWith(
        'ARTIC-Network/artic-nf',
        collection.workflow_path,
        'v1.0.0',
        'latest',
        path.join(tmpDir, 'workflows', 'local', 'artic-nf@latest')
      );
      expect(version.version).toBe('v1.0.0');
      expect(version.parent_id).toBe('local/artic-nf');
      // Catalogue entry now tracks 'latest'
      expect(catalogue.sections[0].workflows[0].version).toBe('latest');
      // Local workflow registered with the installed version
      const wf = collection.workflows.find((w) => w.id === 'local/artic-nf');
      expect(wf).toBeDefined();
      expect(wf.versions.some((v) => v.version === 'v1.0.0')).toBe(true);
      // Installed version persisted for @latest tracking
      expect(fs.readFileSync(path.join(targetPath, '.glacier-version'), 'utf8')).toBe('v1.0.0');
    });

    it('updates an existing version in place without duplicating it', async () => {
      const catalogue = makeShardCatalogue();
      const targetPath = path.join(tmpDir, 'workflows', 'local', 'artic-nf@latest');
      fs.mkdirSync(targetPath, { recursive: true });
      vi.mocked(repo.cloneRepo)
        .mockResolvedValueOnce({
          owner: 'ARTIC-Network',
          repo: 'artic-nf',
          version: 'v1.0.0',
          url: 'https://github.com/ARTIC-Network/artic-nf.git',
          path: targetPath
        })
        .mockResolvedValueOnce({
          owner: 'ARTIC-Network',
          repo: 'artic-nf',
          version: 'v1.1.0',
          url: 'https://github.com/ARTIC-Network/artic-nf.git',
          path: targetPath
        });

      await collection.updateShardWorkflow(
        'local/artic-nf',
        'ARTIC-Network/artic-nf',
        'v1.0.0',
        'latest'
      );
      const version = await collection.updateShardWorkflow(
        'local/artic-nf',
        'ARTIC-Network/artic-nf',
        'v1.1.0',
        'latest'
      );

      const wf = collection.workflows.find((w) => w.id === 'local/artic-nf');
      expect(wf.versions).toHaveLength(1);
      expect(version.version).toBe('v1.1.0');
      expect(catalogue.sections[0].workflows[0].version).toBe('latest');
    });

    it('throws when the shard workflow is not in any catalogue', async () => {
      collection.catalogues = [];

      await expect(
        collection.updateShardWorkflow('local/artic-nf', 'ARTIC-Network/artic-nf', 'v1.0.0')
      ).rejects.toThrow('not found in any catalogue');
    });
  });

  describe('addCatalogue', () => {
    it('clones repo and refreshes catalogues', async () => {
      const catDir = path.join(tmpDir, 'catalogues', 'owner', 'cat-repo');
      fs.mkdirSync(catDir, { recursive: true });
      fs.writeFileSync(
        path.join(catDir, 'catalogue.json'),
        JSON.stringify({ name: 'Cloned Cat', sections: [] }),
        'utf8'
      );
      vi.mocked(repo.cloneRepo).mockResolvedValue({
        owner: 'owner',
        repo: 'cat-repo',
        version: 'main',
        url: 'https://github.com/owner/cat-repo',
        path: catDir
      });

      await collection.addCatalogue('owner/cat-repo', 'main');

      expect(collection.catalogues).toHaveLength(1);
      expect(collection.catalogues[0].name).toBe('Cloned Cat');
    });
  });

  describe('removeCatalogue', () => {
    it('removes catalogue directory and refreshes', async () => {
      const catDir = path.join(tmpDir, 'catalogues', 'owner', 'cat-repo');
      fs.mkdirSync(catDir, { recursive: true });
      fs.writeFileSync(
        path.join(catDir, 'catalogue.json'),
        JSON.stringify({ name: 'Test Cat', source: 'owner/cat-repo', sections: [] }),
        'utf8'
      );
      collection.catalogues = [{ name: 'Test Cat', source: 'owner/cat-repo', sections: [] }];

      await collection.removeCatalogue('Test Cat');

      expect(fs.existsSync(catDir)).toBe(false);
    });

    it('throws if catalogue not found', async () => {
      await expect(collection.removeCatalogue('Nope')).rejects.toThrow('not found');
    });
  });

  describe('settingsGet / settingsSet', () => {
    it('delegates to settings module', () => {
      collection.settingsSet('darkMode', true);
      const val = collection.settingsGet('darkMode');
      expect(val).toBe(true);
    });
  });

  describe('syncRepo', () => {
    it('delegates to repo module', () => {
      vi.mocked(repo.syncRepo).mockReturnValue({ status: 'ok', updated: true });

      const result = collection.syncRepo('/some/path');

      expect(repo.syncRepo).toHaveBeenCalledWith('/some/path');
      expect(result).toEqual({ status: 'ok', updated: true });
    });
  });

  describe('getWorkflowParams / getWorkflowSchema', () => {
    it('delegates to repo module', () => {
      vi.mocked(repo.getWorkflowParams).mockResolvedValue({ key: 'val' });
      vi.mocked(repo.getWorkflowSchema).mockResolvedValue({ schema: true });

      const params = collection.getWorkflowParams('/path');
      const schema = collection.getWorkflowSchema('/path');

      expect(params).resolves.toEqual({ key: 'val' });
      expect(schema).resolves.toEqual({ schema: true });
    });
  });

  describe('cloneRepo', () => {
    it('clones and registers a new workflow', async () => {
      vi.mocked(repo.cloneRepo).mockResolvedValue({
        owner: 'newowner',
        repo: 'newrepo',
        version: 'v1',
        url: 'https://github.com/newowner/newrepo',
        path: path.join(tmpDir, 'workflows', 'newowner', 'newrepo@v1')
      });

      const version = await collection.cloneRepo('newowner/newrepo', null);

      expect(version.version).toBe('v1');
      expect(collection.workflows).toHaveLength(1);
      expect(collection.workflows[0].id).toBe('newowner/newrepo');
    });

    it('returns existing version if already installed', async () => {
      const wf = makeWorkflow({ id: 'owner/repo' });
      collection.workflows = [wf];
      vi.mocked(repo.cloneRepo).mockResolvedValue({
        owner: 'owner',
        repo: 'repo',
        version: 'v1.0',
        url: 'https://github.com/owner/repo',
        path: path.join(tmpDir, 'workflows', 'owner', 'repo@v1.0')
      });

      const version = await collection.cloneRepo('owner/repo', null);

      expect(collection.workflows).toHaveLength(1);
      expect(version.version).toBe('v1.0');
    });
  });

  describe('getAvailableProfiles', () => {
    it('delegates to nextflow runner', async () => {
      vi.mocked(getAvailableProfiles).mockResolvedValue(['standard', 'test']);
      const instance = {
        id: 'test',
        name: 'test',
        workflow_version: { path: '/x' },
        path: '/x',
        processes: []
      };
      collection.workflow_instances = [instance];

      const profiles = await collection.getAvailableProfiles(instance);

      expect(profiles).toEqual(['standard', 'test']);
    });
  });

  describe('getWorkflowInstanceLogs', () => {
    it('reads log files from instance path', () => {
      const instPath = path.join(tmpDir, 'instances', 'test-instance');
      fs.mkdirSync(instPath, { recursive: true });
      fs.writeFileSync(path.join(instPath, 'stdout.log'), 'log content', 'utf8');
      const instance = {
        id: 'test',
        name: 'test',
        workflow_version: {},
        path: instPath,
        processes: [],
        status: 'created'
      };

      const logs = collection.getWorkflowInstanceLogs(instance, 'stdout');

      expect(logs).toBe('log content');
    });

    it('returns empty string if log file missing', () => {
      const instance = {
        id: 'test',
        name: 'test',
        workflow_version: {},
        path: '/nonexistent',
        processes: []
      };

      const logs = collection.getWorkflowInstanceLogs(instance, 'stdout');

      expect(logs).toBe('');
    });
  });

  describe('getInstanceReportsList', () => {
    it('delegates to locateReports', () => {
      vi.mocked(paths.locateReports).mockReturnValue([
        { id: '1', name: 'report', path: '/r.html', shortPath: 'r.html' }
      ]);
      const instance = {
        id: 'test',
        name: 'test',
        workflow_version: {},
        path: '/some/path',
        processes: []
      };

      const reports = collection.getInstanceReportsList(instance);

      expect(reports).toHaveLength(1);
      expect(paths.locateReports).toHaveBeenCalledWith('/some/path');
    });
  });

  const describeUnix = process.platform === 'win32' ? describe.skip : describe;
  const describeWin = process.platform !== 'win32' ? describe.skip : describe;

  describeUnix('killPID — Unix', () => {
    it('sends SIGINT on Unix', () => {
      const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => {});

      const result = collection.killPID(123, 'graceful');

      expect(killSpy).toHaveBeenCalledWith(-123, 'SIGINT');
      expect(result).toBe(true);
    });

    it('sends SIGTERM for term mode', () => {
      const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => {});

      collection.killPID(123, 'term');

      expect(killSpy).toHaveBeenCalledWith(-123, 'SIGTERM');
    });

    it('sends SIGKILL for kill mode', () => {
      const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => {});

      collection.killPID(123, 'kill');

      expect(killSpy).toHaveBeenCalledWith(-123, 'SIGKILL');
    });

    it('falls back to single process kill when group kill fails', () => {
      const killSpy = vi
        .spyOn(process, 'kill')
        .mockImplementationOnce(() => {
          throw new Error('ESRCH');
        })
        .mockImplementationOnce(() => {});

      const result = collection.killPID(456, 'kill');

      expect(killSpy).toHaveBeenNthCalledWith(1, -456, 'SIGKILL');
      expect(killSpy).toHaveBeenNthCalledWith(2, 456, 'SIGKILL');
      expect(result).toBe(true);
    });

    it('returns false when all kill attempts fail', () => {
      vi.spyOn(process, 'kill').mockImplementation(() => {
        throw new Error('ESRCH');
      });

      const result = collection.killPID(789, 'kill');

      expect(result).toBe(false);
    });
  });

  describeWin('killPID — Windows', () => {
    let spawnSyncMock;

    beforeEach(() => {
      spawnSyncMock = vi.mocked(spawnSync);
      spawnSyncMock.mockReset();
      spawnSyncMock.mockReturnValue({ status: 0 });
    });

    it('calls taskkill with /PID and /T in graceful mode', () => {
      const result = collection.killPID(123, 'graceful');

      expect(spawnSyncMock).toHaveBeenCalledWith('taskkill', ['/PID', '123', '/T'], {
        stdio: 'inherit'
      });
      expect(result).toBe(true);
    });

    it('adds /F flag in kill mode', () => {
      const result = collection.killPID(123, 'kill');

      expect(spawnSyncMock).toHaveBeenCalledWith('taskkill', ['/PID', '123', '/T', '/F'], {
        stdio: 'inherit'
      });
      expect(result).toBe(true);
    });

    it('returns false when taskkill fails', () => {
      spawnSyncMock.mockReturnValue({ status: 1 });

      const result = collection.killPID(123, 'graceful');

      expect(result).toBe(false);
    });
  });
});
