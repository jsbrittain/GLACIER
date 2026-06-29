// Main Collection store for workflows and instances

import path from 'path';
import os from 'os';
import fs from 'fs';
import { IRepo, IRepoVersions } from './types.js';
import { generateUniqueName } from './repo.js';
import { cloneRepo, ICloneRepo, getRepoTags, getRepoBranches, parseRepoUrl } from './repo.js';
import { runWorkflow } from './runner.js';
import { getEnvironmentStatus, performEnvironmentAction } from '../runners/environment.js';
import { ProcessDescriptor, WorkflowStatus } from '../types/types.js';
import { syncRepo, getWorkflowParams, getWorkflowSchema, isValidWorkflowRepo as checkIsValidWorkflowRepo } from './repo.js';
import {
  getConfigPath,
  getDocumentsPath,
  locateReports,
  getDefaultConfigDir,
  getDefaultDocumentsDir
} from './paths.js';
import { settings, StoreSchema } from './settings.js';
import { importShard, queryShardStatus } from './shard.js';

// Should remove imports from specific runners
import { getAvailableProfiles } from '../runners/nextflow/nextflow.js';
import { parseNextflowLog } from '../runners/nextflow/nf-parse.js';
//

let _shell: any;
async function getShell(): Promise<any> {
  if (!_shell) {
    try {
      const pkg = await import('electron');
      _shell = pkg.shell;
    } catch {
      _shell = { openPath: () => Promise.resolve(), openExternal: () => Promise.resolve() };
    }
  }
  return _shell;
}

const instance_database_file = 'instances.json';

export interface Catalogue {
  name: string;
  source: string;
  description?: string;
  icon?: string;
  base_dir?: string;
  scheme?: Record<string, string>;
  scheme_url?: string;
  sections: CatalogueSection[];
}

export interface CatalogueSection {
  name: string;
  description?: string;
  icon?: string;
  scheme?: Record<string, string>;
  workflows: CatalogueWorkflow[];
  hidden?: boolean;
}

export interface CatalogueWorkflow {
  name: string;
  repo: string;
  version?: string;
  hidden?: boolean;
}

export enum IWorkflowType {
  NEXTFLOW = 'nextflow',
  SNAKEMAKE = 'snakemake',
  DOCKER = 'docker'
}

// A specific version (github tag) of a workflow
export interface IWorkflowVersion {
  id: string;
  name: string;
  type: IWorkflowType;
  version: string | undefined; // github tag, undefined for local
  path: string;
  parent_id: string; // reference to parent workflow
}

class WorkflowVersion implements IWorkflowVersion {
  id: string;
  name: string;
  type: IWorkflowType;
  version: string | undefined;
  path: string;
  parent_id: string; // reference to parent workflow

  constructor({ id, name, type, version, path, parent_id }: IWorkflowVersion) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.version = version;
    this.path = path;
    this.parent_id = parent_id;
  }
}

// Generally a repository, which can support multiple versions
export interface IWorkflow {
  id: string;
  name: string;
  owner: string;
  repo: string;
  url: string;
  versions: WorkflowVersion[];
}

class Workflow implements IWorkflow {
  id: string;
  name: string;
  owner: string;
  repo: string;
  url: string;
  versions: WorkflowVersion[];

  constructor(wf: IWorkflow) {
    this.id = wf.id;
    this.name = wf.name;
    this.owner = wf.owner;
    this.repo = wf.repo;
    this.url = wf.url;
    this.versions = wf.versions;
  }
}

export interface IWorkflowParams {
  [key: string]: any;
}

// A specific instance of a workflow
export interface IWorkflowInstance {
  id: string;
  name: string;
  workflow_version: WorkflowVersion;
  path: string;
  params?: IWorkflowParams;
  status?: string;
  /** Computed by listWorkflowInstances */
  progress?: number;
  launch_time?: string;
  last_update?: string;
  hidden?: boolean;
}

class WorkflowInstance implements IWorkflowInstance {
  id: string;
  name: string;
  workflow_version: WorkflowVersion;
  path: string;
  params?: IWorkflowParams;
  status: string;
  progress?: number;
  launch_time?: string;
  last_update?: string;
  hidden?: boolean;

  processes: ProcessDescriptor[] = [];

  constructor({
    id,
    name,
    workflow_version,
    path,
    status = 'created',
    params = {},
    hidden
  }: IWorkflowInstance) {
    this.id = id;
    this.name = name;
    this.workflow_version = workflow_version;
    this.path = path;
    this.params = params;
    this.status = status;
    this.hidden = hidden;
  }

  attachProcess(desc: ProcessDescriptor) {
    this.processes.push(desc);
  }

  async getProgress(): Promise<Record<string, any>> {
    // Read the most recent .nextflow.log (handles rotation: .nextflow.log, .nextflow.log.1, ...)
    let logFile = path.join(this.path, '.nextflow.log');
    if (fs.existsSync(this.path)) {
      const candidates = fs
        .readdirSync(this.path)
        .filter((f) => f.startsWith('.nextflow.log'))
        .map((f) => ({
          name: f,
          mtime: fs.statSync(path.join(this.path, f)).mtimeMs
        }))
        .sort((a, b) => b.mtime - a.mtime);
      if (candidates.length > 0) {
        logFile = path.join(this.path, candidates[0].name);
      }
    }
    if (fs.existsSync(logFile)) {
      return await parseNextflowLog(logFile);
    } else {
      return { status: 'No log file found' };
    }
  }

  async getStatus(): Promise<string> {
    const progress = await this.getProgress();
    const workflow_progress = progress?.workflow;
    // get status of last item
    if (workflow_progress && workflow_progress.length > 0) {
      const last = workflow_progress[workflow_progress.length - 1];
      if (last.status) {
        return last.status;
      }
    }
    return 'unknown';
  }

  getProgressPercent(): number {
    const progressData = this._cachedProgress;
    if (!progressData?.group) return 0;
    const count = countProcesses(progressData.group);
    return count.total > 0 ? Math.round((count.completed / count.total) * 100) : 0;
  }

  getLaunchTime(instanceDb: any): string | undefined {
    if (!instanceDb?.runs) return undefined;
    const run = instanceDb.runs.find((r: any) => r.id === this.id);
    if (!run?.runs?.length) return undefined;
    return run.runs[0].datetime || undefined;
  }

  getLastUpdateTime(): string | undefined {
    if (!this._cachedProgress) return undefined;
    const progress = this._cachedProgress;
    let latest: string | undefined;
    const consider = (ts: string | undefined) => {
      if (ts && (!latest || ts > latest)) latest = ts;
    };
    // Check workflow-level events
    for (const entry of progress.workflow || []) {
      consider(entry.time);
    }
    // Walk process tree for timestamps
    const walk = (items: any[]) => {
      for (const item of items) {
        consider(item.last_update);
        for (const p of item.process || []) {
          consider(p.time);
          consider(p.last_update);
        }
        if (item.group?.length) walk(item.group);
      }
    };
    walk(progress.group || []);
    return latest;
  }

  private _cachedProgress: Record<string, any> | null = null;

  setCachedProgress(data: Record<string, any> | null) {
    this._cachedProgress = data;
  }
}

function countProcesses(groups: any[]): { total: number; completed: number } {
  const allProcesses = new Map<string, string>();
  const walk = (items: any[]) => {
    for (const item of items) {
      for (const p of item.process || []) {
        allProcesses.set(p.full_name, p.status);
      }
      if (item.group?.length) walk(item.group);
    }
  };
  walk(groups);
  let completed = 0;
  for (const status of allProcesses.values()) {
    if (status === 'completed') completed++;
  }
  return { total: allProcesses.size, completed };
}

// Singleton class
export class Collection {
  // --- Class management --------------------------------------------------------------
  // Ensure a singleton instance that can be referenced from anywhere

  private static singleton: Collection; // single instance of class

  // private constructor to prevent direct instantiation
  private constructor() {
    this.root_path = getConfigPath();
    this.documents_root_path = getDocumentsPath();
  }

  // Method to get the singleton instance
  static getInstance(): Collection {
    if (!Collection.singleton) {
      Collection.singleton = new Collection();
    }
    return Collection.singleton;
  }

  // --- Data --------------------------------------------------------------------------

  root_path: string = '';
  documents_root_path: string = '';
  starting_up: boolean = true;

  catalogues: Catalogue[] = [];
  workflows: Workflow[] = [];
  workflow_instances: WorkflowInstance[] = [];

  installable_repos: IRepoVersions[] = [];

  // --- Convenience setters/getters ---------------------------------------------------

  get workflow_path(): string {
    return path.join(this.root_path, 'workflows');
  }

  get containers_path(): string {
    return path.join(this.root_path, 'containers');
  }

  get instances_path(): string {
    return path.join(this.documents_root_path, 'instances');
  }

  get catalogues_path(): string {
    return path.join(this.root_path, 'catalogues');
  }

  // --- Logic -------------------------------------------------------------------------

  async init(): Promise<Record<string, boolean>> {
    // Re-read paths from store in case they were changed
    this.root_path = getConfigPath();
    this.documents_root_path = getDocumentsPath();

    // Check path existence BEFORE parseCollection (which auto-creates dirs)
    const missing: Record<string, boolean> = {
      config: !this.root_path || !fs.existsSync(this.root_path),
      documents: !this.documents_root_path || !fs.existsSync(this.documents_root_path)
    };

    const is_electron = process.versions?.electron !== undefined;
    if (is_electron && !fs.existsSync(this.catalogues_path)) {
      // Import manifest if one exists
      const { app } = await import('electron');
      const resource_root = path.join(
        app.isPackaged ? process.resourcesPath : app.getAppPath(),
        'bundle'
      );
      const manifestPath = path.join(resource_root, 'manifest.json');
      if (fs.existsSync(manifestPath)) {
        await this.importManifest(manifestPath);
      }
    }
    await this.parseCollection();
    this.starting_up = false;
    return missing;
  }

  getDefaultPaths(): Record<string, string> {
    return {
      config: getDefaultConfigDir(),
      documents: getDefaultDocumentsDir()
    };
  }

  getMissingPaths(): Record<string, boolean> {
    return {
      config: !this.root_path || !fs.existsSync(this.root_path),
      documents: !this.documents_root_path || !fs.existsSync(this.documents_root_path)
    };
  }

  async parseCollection() {
    this.parseWorkflows();
    this.parseInstallableRepos();
    await this.parseCatalogues();
    await this.parseInstances();
  }

  private parseWorkflows() {
    // Clean existing workflows
    this.workflows = [];
    // Hierarchy: root_path/workflows/owner/repo@version/    with version=tag or branch
    this.ensurePathExists(this.workflow_path);
    console.log(`Parsing collection from path: ${this.workflow_path}`);
    const owners = fs.readdirSync(this.workflow_path);
    for (const owner of owners) {
      const ownerPath = path.join(this.workflow_path, owner);
      if (!fs.statSync(ownerPath).isDirectory()) continue;
      const repoDirs = fs.readdirSync(ownerPath);
      for (const repo_and_version of repoDirs) {
        const version_path = path.join(ownerPath, repo_and_version);
        if (!fs.statSync(version_path).isDirectory()) continue;
        const repo = repo_and_version.split('@')[0];
        const version = repo_and_version.split('@')[1];
        // Check for existing workflow and create if not found
        let wf = this.workflows.find((wf) => wf.id === `${owner}/${repo}`);
        if (wf === undefined) {
          wf = new Workflow({
            id: `${owner}/${repo}`,
            name: repo,
            owner: owner,
            repo: repo,
            url: `${owner}/${repo}`,
            versions: []
          } as IWorkflow);
          this.workflows.push(wf);
        }

        // Add version to workflow
        const versionPath = path.join(ownerPath, repo_and_version);
        const versionPostfix = version !== undefined ? `@${version}` : '';
        const type = this.determineWorkflowType(versionPath);
        wf.versions.push({
          id: `${owner}/${repo}${versionPostfix}`,
          name: `${owner}/${repo}${versionPostfix}`,
          type: type,
          version: version,
          path: versionPath,
          parent_id: wf.id
        } as WorkflowVersion);
      }
    }
  }

  private parseInstallableRepos() {}

  private async parseInstances() {
    // Clean existing instances
    this.workflow_instances = [];
    // Hierarchy: root_path/instances/owner/repo@version/instance_id/
    this.ensurePathExists(this.instances_path);
    console.log(`Parsing instances from path: ${this.instances_path}`);
    const owners = fs.readdirSync(this.instances_path);
    for (const owner of owners) {
      const ownerPath = path.join(this.instances_path, owner);
      if (!fs.statSync(ownerPath).isDirectory()) continue;
      const repoDirs = fs.readdirSync(ownerPath);
      for (const repo_and_version of repoDirs) {
        const version_path = path.join(ownerPath, repo_and_version);
        if (!fs.statSync(version_path).isDirectory()) continue;
        if (!repo_and_version.includes('@')) continue;
        const repo = repo_and_version.split('@')[0];
        const version = repo_and_version.split('@')[1];
        console.log(`Parsing instances for workflow: ${owner}/${repo}@${version}`);
        // Find the corresponding workflow version
        const wf = this.workflows.find((wf) => wf.id === `${owner}/${repo}`);
        if (wf === undefined) {
          console.log(`Workflow ${owner}/${repo} not found for instances, skipping.`);
          continue;
        }
        const wf_version = wf.versions.find((v) => v.version === version);
        if (wf_version === undefined) {
          console.log(
            `Workflow version ${owner}/${repo}@${version} not found for instances, skipping.`
          );
          continue;
        }
        // Parse instances
        const versionPath = path.join(ownerPath, repo_and_version);
        const instanceDirs = fs.readdirSync(versionPath);
        for (const instanceDir of instanceDirs) {
          if (!fs.statSync(path.join(versionPath, instanceDir)).isDirectory()) continue;
          const instance = new WorkflowInstance({
            id: instanceDir,
            name: instanceDir,
            workflow_version: wf_version,
            path: path.join(versionPath, instanceDir),
            params: {}
          });
          this.workflow_instances.push(instance);
        }
      }
    }
    // Now that the instance folder tree has been parsed, cross-reference with the
    // instance database that contains process IDs, etc.
    await this.parseInstanceDatabase();
  }

  private async parseInstanceDatabase() {
    const db_path = path.join(this.root_path, instance_database_file);
    if (!fs.existsSync(db_path)) {
      console.log('No instance database found.');
      return;
    }
    let db_updated = false;
    const db = JSON.parse(fs.readFileSync(db_path, 'utf-8'));
    for (const run of db.runs) {
      const instance = this.workflow_instances.find((inst) => inst.id === run.id);
      if (!instance) {
        const latest_run = run.runs?.length > 0 ? run.runs[run.runs.length - 1] : null;
        let has_running = false;
        // Try new-style processes first, fall back to old-style pids
        const descriptors = this.getDescriptorsFromRun(latest_run);
        for (const desc of descriptors) {
          if (await this.verifyProcess(desc)) {
            has_running = true;
            break;
          }
        }
        if (!has_running) {
          console.log(`Instance ${run.id} found in database but not in filesystem, removing.`);
          db.runs = db.runs.filter((r: any) => r.id !== run.id);
          db_updated = true;
        } else {
          console.log(`Instance ${run.id} found in database but not in filesystem, process still running, keeping.`);
        }
        continue;
      }
      // Restore hidden flag
      if (run.hidden) {
        instance.hidden = true;
      }
      // Get latest run
      if (run.runs && run.runs.length > 0) {
        const latest_run = run.runs[run.runs.length - 1];
        instance.status = latest_run.status;
        // If running and process descriptors exist, check if still running
        const descriptors = this.getDescriptorsFromRun(latest_run);
        if (latest_run.status === 'running' && descriptors.length > 0) {
          instance.processes = descriptors;
          const alive: ProcessDescriptor[] = [];
          for (const desc of descriptors) {
            const isAlive = await this.verifyProcess(desc);
            if (isAlive) {
              alive.push(desc);
              const tag = desc.containerId
                ? `container ${desc.containerId.slice(0, 12)}`
                : `PID ${desc.pid}`;
              console.log(`Instance ${instance.id} has running ${tag}`);
            } else {
              const tag = desc.containerId
                ? `container ${desc.containerId.slice(0, 12)}`
                : `PID ${desc.pid}`;
              console.log(`Instance ${instance.id} ${tag} is not running, updating status.`);
            }
          }
          instance.processes = alive;
          if (alive.length === 0 && descriptors.length > 0) {
            // All processes dead — update status
            const progress = await instance.getStatus();
            const status = progress || 'closed';
            run.runs.push({
              datetime: new Date().toISOString(),
              pids: [],
              status: status
            });
            instance.status = status;
            db_updated = true;
          } else if (alive.length !== descriptors.length) {
            // Some processes died — update DB with cleaned list
            db_updated = true;
          }
        }
      }
    }
    if (db_updated) {
      fs.writeFileSync(db_path, JSON.stringify(db, null, 2));
    }
  }

  /** Extract ProcessDescriptors from a DB run entry, handling both old and new schema */
  private getDescriptorsFromRun(run: any): ProcessDescriptor[] {
    if (!run) return [];
    // New format
    if (run.processes && Array.isArray(run.processes) && run.processes.length > 0) {
      return run.processes;
    }
    // Legacy format: `pids: number[]`
    if (run.pids && Array.isArray(run.pids) && run.pids.length > 0) {
      return run.pids.map((pid: number) => ({
        pid,
        startTime: run.datetime || undefined
      }));
    }
    return [];
  }

  private printCollection() {
    console.log('Workflows in collection:');
    for (const wf of this.workflows) {
      console.log(`- ${wf.id}`);
      for (const ver of wf.versions) {
        console.log(`  - Version: ${ver.version} at ${ver.path}`);
      }
    }
    console.log('Instances in collection:');
    for (const inst of this.workflow_instances) {
      console.log(`- ${inst.id} (${inst.workflow_version.id}) at ${inst.path}`);
      if (inst.processes.length > 0) {
        const descs = inst.processes
          .map((p) => `${p.pid}${p.containerId ? ' (container:' + p.containerId.slice(0, 12) + ')' : ''}`)
          .join(', ');
        console.log(`  - Processes: ${descs}`);
      }
    }
  }

  ensurePathExists(folder: string) {
    if (!this.root_path || !folder) {
      throw new Error('Root path or workflow path is not set.');
    }
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  determineWorkflowType(folder: string): IWorkflowType {
    // Placeholder logic, can be improved
    return IWorkflowType.NEXTFLOW;
  }

  getRootPath(): string | null {
    return this.root_path;
  }

  getCollectionsPath(): string | null {
    return this.getRootPath();
  }

  getConfigPath(): string | null {
    return this.root_path;
  }

  getDocumentsPath(): string | null {
    return this.documents_root_path;
  }

  async setConfigPath(path: string) {
    this.root_path = path;
    settings.set('configPath', path);
    await this.parseCollection();
  }

  async setDocumentsPath(path: string) {
    this.documents_root_path = path;
    settings.set('documentsPath', path);
    await this.parseCollection();
  }

  createWorkflowInstance(workflow_id: string, version: string): IWorkflowInstance {
    const { owner, repo } = parseRepoUrl(workflow_id);
    const workflow = this.workflows.find((wf) => wf.id === `${owner}/${repo}`);
    if (!workflow) {
      throw new Error(`Workflow ${workflow_id} not found.`);
    }
    if (!workflow.versions || workflow.versions.length === 0) {
      throw new Error(`Workflow ${workflow_id} has no versions.`);
    }
    let workflow_version;
    if (version === undefined || version === 'latest') {
      // Local repository
      workflow_version = workflow.versions[0];
    } else {
      workflow_version = workflow.versions.filter((v: any) => v.version === version)[0];
    }
    const repo_and_version = `${workflow.repo}@${workflow_version.version}`;
    const existing_ids = this.workflow_instances.map((inst) => inst.id);
    const instance_name = generateUniqueName(existing_ids);
    const instance_id = instance_name;
    const instance_path = path.join(this.instances_path, owner, repo_and_version, instance_name);
    this.ensurePathExists(instance_path);
    const instance = new WorkflowInstance({
      id: instance_id,
      name: instance_name,
      workflow_version: workflow_version,
      path: instance_path
    });
    this.workflow_instances.push(instance);
    this.recordRunWorkflow(instance, 'created');
    return instance;
  }

  async listWorkflowInstances(): Promise<IWorkflowInstance[]> {
    // First, check progress of 'Running' instances
    const updatePromises = [];
    for (const instance of this.workflow_instances) {
      if (
        instance.status === WorkflowStatus.Running ||
        instance.status === WorkflowStatus.Completed
      ) {
        const updatePromise = this.updateWorkflowInstanceStatus(instance).then((status) => {
          instance.status = status;
          this.recordRunWorkflow(instance, status);
        });
        updatePromises.push(updatePromise);
      }
    }
    await Promise.all(updatePromises);
    // Enrich instances with computed metadata
    const db_path = path.join(this.root_path, instance_database_file);
    let instanceDb: any = null;
    if (fs.existsSync(db_path)) {
      instanceDb = JSON.parse(fs.readFileSync(db_path, 'utf-8'));
    }
    const visible: IWorkflowInstance[] = [];
    for (const instance of this.workflow_instances) {
      if (instance.hidden) continue;
      instance.progress = instance.getProgressPercent();
      instance.launch_time = instance.getLaunchTime(instanceDb);
      instance.last_update = instance.getLastUpdateTime();
      visible.push(instance);
    }
    visible.sort((a, b) => {
      const wfA = (a.workflow_version?.name ?? '').toLowerCase();
      const wfB = (b.workflow_version?.name ?? '').toLowerCase();
      if (wfA !== wfB) return wfA.localeCompare(wfB);
      return (a.name ?? '').toLowerCase().localeCompare((b.name ?? '').toLowerCase());
    });
    return visible;
  }

  async getInstanceProgress(instance: IWorkflowInstance): Promise<Record<string, unknown>> {
    // Find instance
    const local_instance = this.workflow_instances.find((inst) => inst.id === instance.id);
    if (!local_instance) {
      throw new Error(`Instance ${instance.id} not found in collection.`);
    }
    return await local_instance.getProgress();
  }

  async getWorkflowInstanceParams(instance: IWorkflowInstance): Promise<IWorkflowParams> {
    // Find instance
    const local_instance = this.workflow_instances.find((inst) => inst.id === instance.id);
    if (!local_instance) {
      throw new Error(`Instance ${instance.id} not found in collection.`);
    }
    const filename = path.join(local_instance.path, 'glacier-params.json');
    if (!fs.existsSync(filename)) {
      console.log(`Params file ${filename} does not exist.`);
      return {};
    }
    const params = JSON.parse(fs.readFileSync(filename, 'utf-8'));
    return params;
  }

  async updateWorkflowInstanceStatus(instance: IWorkflowInstance): Promise<string> {
    // Run nextflow log and get last status
    // Find Instance
    const local_instance = this.workflow_instances.find((inst) => inst.id === instance.id);
    if (!local_instance) {
      throw new Error(`Instance ${instance.id} not found in collection.`);
    }
    const progress = await local_instance.getProgress();
    local_instance.setCachedProgress(progress);
    const workflow_progress = progress.workflow;
    // get status of last item
    if (!workflow_progress || workflow_progress.length === 0) {
      return WorkflowStatus.Running;
    } else {
      let status: string = WorkflowStatus.Created;
      // recurse from the end to find last known status
      for (let i = workflow_progress.length - 1; i >= 0; i--) {
        if (
          status === WorkflowStatus.Completed &&
          workflow_progress[i].status !== WorkflowStatus.Completed
        ) {
          // Try to retrieve a more informative status (success / fail)
          status = workflow_progress[i].status;
          break;
        } else {
          status = workflow_progress[i].status;
        }
      }
      return status;
    }
    return WorkflowStatus.Unknown;
  }

  killPID = (pid: number, mode = 'graceful') => {
    // mode: 'graceful' | 'term' | 'kill'
    const isWin = process.platform === 'win32';

    if (isWin) {
      const { spawnSync } = require('child_process');
      const args = ['/PID', String(pid), '/T'];
      if (mode === 'kill') args.push('/F');
      const res = spawnSync('taskkill', args, { stdio: 'inherit' });
      return res.status === 0;
    } else {
      const sig = mode === 'kill' ? 'SIGKILL' : mode === 'term' ? 'SIGTERM' : 'SIGINT';
      try {
        process.kill(-pid, sig); // signal the process group
        return true;
      } catch {
        // Fallback: try the single process
        try {
          process.kill(pid, sig);
          return true;
        } catch {
          return false;
        }
      }
    }
  };

  /**
   * Read the command line of a running process for PID-reuse detection.
   * Returns null when the platform doesn't support it or the PID is gone.
   */
  private async getProcessCmd(pid: number): Promise<string | null> {
    const isWin = process.platform === 'win32';
    try {
      if (isWin) {
        const { execSync } = require('child_process');
        const out = execSync(
          `wmic process where processid=${pid} get commandline /format:list`,
          { encoding: 'utf-8', timeout: 3000 }
        );
        const match = out.match(/CommandLine=(.+)/);
        return match ? match[1].trim() : null;
      } else {
        // macOS / Linux — read /proc/<pid>/cmdline (works on both)
        const cmdline = require('fs').readFileSync(`/proc/${pid}/cmdline`, 'utf-8');
        return cmdline.replace(/\0/g, ' ').trim();
      }
    } catch {
      return null;
    }
  }

  /**
   * Verify that a process descriptor still refers to the expected OS process.
   * For Docker containers, inspect via Docker API.
   */
  private async verifyProcess(desc: ProcessDescriptor): Promise<boolean> {
    // Docker containers
    if (desc.containerId) {
      try {
        const { docker } = await import('../runners/docker/docker.js');
        const container = docker.getContainer(desc.containerId);
        const info = await container.inspect();
        return info.State.Running;
      } catch {
        return false;
      }
    }

    // Standard PID — check liveness first, then verify command line
    try {
      process.kill(desc.pid, 0);
    } catch {
      return false;
    }

    // If we have a stored cmd, verify it matches the running process
    if (desc.cmd) {
      const actualCmd = await this.getProcessCmd(desc.pid);
      if (actualCmd !== null && !actualCmd.includes(desc.cmd)) {
        // The PID is alive but belongs to a different program — PID reuse
        const excerpt =
          actualCmd.length > 120 ? actualCmd.slice(0, 120) + '...' : actualCmd;
        console.warn(
          `PID ${desc.pid} cmd mismatch: expected "${desc.cmd.slice(0, 80)}", got "${excerpt}"`
        );
        return false;
      }
    }

    return true;
  }

  async cancelWorkflowInstance(instance: IWorkflowInstance): Promise<void> {
    console.log(`Cancelling instance ${instance.id}`);
    const local_instance = this.workflow_instances.find((inst) => inst.id === instance.id);
    if (!local_instance) {
      throw new Error(`Instance ${instance.id} not found in collection.`);
    }
    if (local_instance.processes.length === 0) {
      throw new Error(`Instance ${instance.id} has no running process.`);
    }
    for (const desc of local_instance.processes) {
      try {
        if (desc.containerId) {
          const { docker } = await import('../runners/docker/docker.js');
          const container = docker.getContainer(desc.containerId);
          await container.stop({ t: 10 });
        } else {
          const success = this.killPID(desc.pid, 'graceful');
          if (!success) {
            console.error(`Failed to stop PID ${desc.pid} for instance ${instance.id}`);
          }
        }
      } catch (err) {
        console.error(`Failed to stop process for instance ${instance.id}: ${err}`);
      }
    }
    local_instance.processes = [];
  }

  async resetWorkflowInstanceStatus(instance: IWorkflowInstance): Promise<void> {
    const local_instance = this.workflow_instances.find((inst) => inst.id === instance.id);
    if (!local_instance) {
      throw new Error(`Instance ${instance.id} not found in collection.`);
    }
    if (fs.existsSync(local_instance.path)) {
      const entries = fs.readdirSync(local_instance.path);
      for (const entry of entries) {
        if (entry === 'glacier-params.json') continue;
        fs.rmSync(path.join(local_instance.path, entry), { recursive: true, force: true });
      }
    }
    local_instance.status = WorkflowStatus.Created;
    local_instance.processes = [];
    local_instance.setCachedProgress(null);
  }

  async killWorkflowInstance(instance: IWorkflowInstance): Promise<void> {
    console.log(`Killing instance ${instance.id}`);
    const local_instance = this.workflow_instances.find((inst) => inst.id === instance.id);
    if (!local_instance) {
      throw new Error(`Instance ${instance.id} not found in collection.`);
    }
    if (local_instance.processes.length === 0) {
      throw new Error(`Instance ${instance.id} has no running process.`);
    }
    for (const desc of local_instance.processes) {
      try {
        if (desc.containerId) {
          const { docker } = await import('../runners/docker/docker.js');
          const container = docker.getContainer(desc.containerId);
          await container.kill();
        } else {
          const success = this.killPID(desc.pid, 'kill');
          if (!success) {
            console.error(`Failed to kill PID ${desc.pid} for instance ${instance.id}`);
          }
        }
      } catch (err) {
        console.error(`Failed to kill process for instance ${instance.id}: ${err}`);
      }
    }
    local_instance.processes = [];
  }

  async deleteWorkflowInstance(instance: IWorkflowInstance): Promise<void> {
    // Find instance
    const local_instance_index = this.workflow_instances.findIndex(
      (inst) => inst.id === instance.id
    );
    if (local_instance_index === -1) {
      throw new Error(`Instance ${instance.id} not found in collection.`);
    }
    const local_instance = this.workflow_instances[local_instance_index];
    // Ensure no running processes
    if (local_instance.processes.length > 0) {
      await this.killWorkflowInstance(instance);
    }
    // Delete folder
    if (fs.existsSync(local_instance.path)) {
      fs.rmSync(local_instance.path, { recursive: true, force: true });
    }
    // Remove from collection
    this.workflow_instances.splice(local_instance_index, 1);
    // Update database
    const db_path = path.join(this.root_path, instance_database_file);
    if (fs.existsSync(db_path)) {
      let db = JSON.parse(fs.readFileSync(db_path, 'utf-8'));
      db.runs = db.runs.filter((r: any) => r.id !== instance.id);
      fs.writeFileSync(db_path, JSON.stringify(db, null, 2));
    }
  }

  async openResultsFolder(instance: IWorkflowInstance) {
    const local_instance = this.workflow_instances.find((inst) => inst.id === instance.id);
    if (!local_instance) {
      throw new Error(`Instance ${instance.id} not found in collection.`);
    }
    const folderPath = local_instance.path;
    if (fs.existsSync(folderPath)) {
      const s = await getShell();
      return s.openPath(folderPath);
    } else {
      throw new Error(`Results folder ${folderPath} does not exist.`);
    }
  }

  async getInstanceDiskUsage(instance: IWorkflowInstance): Promise<number> {
    const local_instance = this.workflow_instances.find((inst) => inst.id === instance.id);
    if (!local_instance) {
      throw new Error(`Instance ${instance.id} not found in collection.`);
    }
    const folderPath = local_instance.path;
    if (!fs.existsSync(folderPath)) {
      return 0;
    }
    let totalSize = 0;
    const walkDir = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walkDir(fullPath);
        } else if (entry.isFile()) {
          totalSize += fs.statSync(fullPath).size;
        }
      }
    };
    walkDir(folderPath);
    return totalSize;
  }

  async deleteOrphanedInstances(): Promise<number> {
    const orphans = this.workflow_instances.filter(
      (inst) => inst.status === WorkflowStatus.Created
    );
    const count = orphans.length;
    for (const inst of orphans) {
      // Remove from filesystem if folder exists
      if (fs.existsSync(inst.path)) {
        fs.rmSync(inst.path, { recursive: true, force: true });
      }
      // Remove from collection
      const idx = this.workflow_instances.indexOf(inst);
      if (idx !== -1) {
        this.workflow_instances.splice(idx, 1);
      }
    }
    // Clean up database
    const db_path = path.join(this.root_path, instance_database_file);
    if (fs.existsSync(db_path)) {
      const db = JSON.parse(fs.readFileSync(db_path, 'utf-8'));
      const orphanIds = new Set(orphans.map((o) => o.id));
      db.runs = db.runs.filter((r: any) => !orphanIds.has(r.id));
      fs.writeFileSync(db_path, JSON.stringify(db, null, 2));
    }
    return count;
  }

  async hideWorkflowInstance(instance: IWorkflowInstance): Promise<void> {
    const local_instance = this.workflow_instances.find((inst) => inst.id === instance.id);
    if (!local_instance) {
      throw new Error(`Instance ${instance.id} not found in collection.`);
    }
    local_instance.hidden = true;
    local_instance.processes = [];
    // Persist hidden flag in DB
    const db_path = path.join(this.root_path, instance_database_file);
    if (fs.existsSync(db_path)) {
      const db = JSON.parse(fs.readFileSync(db_path, 'utf-8'));
      const run = db.runs.find((r: any) => r.id === local_instance.id);
      if (run) {
        run.hidden = true;
        fs.writeFileSync(db_path, JSON.stringify(db, null, 2));
      }
    }
  }

  async unhideWorkflowInstance(instance: IWorkflowInstance): Promise<void> {
    const local_instance = this.workflow_instances.find((inst) => inst.id === instance.id);
    if (!local_instance) {
      throw new Error(`Instance ${instance.id} not found in collection.`);
    }
    local_instance.hidden = false;
    const db_path = path.join(this.root_path, instance_database_file);
    if (fs.existsSync(db_path)) {
      const db = JSON.parse(fs.readFileSync(db_path, 'utf-8'));
      const run = db.runs.find((r: any) => r.id === local_instance.id);
      if (run) {
        delete run.hidden;
        fs.writeFileSync(db_path, JSON.stringify(db, null, 2));
      }
    }
  }

  listHiddenInstances(): IWorkflowInstance[] {
    return this.workflow_instances.filter((inst) => inst.hidden);
  }

  async openWorkFolder(instance: IWorkflowInstance, word_id: string) {
    const local_instance = this.workflow_instances.find((inst) => inst.id === instance.id);
    if (!local_instance) {
      throw new Error(`Instance ${instance.id} not found in collection.`);
    }
    // nextflow work id: <2digits>/<first 6digits of hash>
    const match = word_id.match(/^([a-f0-9]{2})\/([a-f0-9]{6})$/);
    if (!match) {
      throw new Error(`Invalid work ID format: ${word_id}`);
    }
    const prefix = match[1];
    const short_hash = match[2];
    const workFolder = path.join(local_instance.path, 'work', prefix);
    if (!fs.existsSync(workFolder)) {
      throw new Error(`Work folder ${workFolder} does not exist.`);
    }
    // Find matching folders
    const candidates = fs.readdirSync(workFolder).filter((f) => f.startsWith(short_hash));
    if (candidates.length === 0) {
      throw new Error(`No work folders found matching ID: ${word_id}`);
    } else if (candidates.length > 1) {
      console.warn(`Multiple work folders found matching ID: ${word_id}, opening first match.`);
    }
    const folderPath = path.join(workFolder, candidates[0]);
    const s = await getShell();
    return s.openPath(folderPath);
  }

  getWorkLog(instance: IWorkflowInstance, workID: string, log_type: string): string {
    const log_filenames = {
      stdout: '.command.out',
      stderr: '.command.err',
      log: '.command.log',
      run: '.command.run',
      shell: '.command.sh',
      trace: '.command.trace',
      begin: '.command.begin'
    };
    let log_filename;
    if (log_type in log_filenames) {
      log_filename = log_filenames[log_type as keyof typeof log_filenames];
    } else {
      throw new Error(`Unknown log type: ${log_type}`);
    }

    const local_instance = this.workflow_instances.find((inst) => inst.id === instance.id);
    if (!local_instance) {
      throw new Error(`Instance ${instance.id} not found in collection.`);
    }
    // nextflow work id: <2digits>/<first 6digits of hash>
    const match = workID.match(/^([a-f0-9]{2})\/([a-f0-9]{6})$/);
    if (!match) {
      throw new Error(`Invalid work ID format: ${workID}`);
    }
    const prefix = match[1];
    const short_hash = match[2];
    const workFolder = path.join(local_instance.path, 'work', prefix);
    if (!fs.existsSync(workFolder)) {
      throw new Error(`Work folder ${workFolder} does not exist.`);
    }
    // Find matching folders
    const candidates = fs.readdirSync(workFolder).filter((f) => f.startsWith(short_hash));
    if (candidates.length === 0) {
      throw new Error(`No work folders found matching ID: ${workID}`);
    } else if (candidates.length > 1) {
      console.warn(`Multiple work folders found matching ID: ${workID}, using first match.`);
    }
    const folderPath = path.join(workFolder, candidates[0]);
    const logFile = path.join(folderPath, `${log_filename}`);
    if (fs.existsSync(logFile)) {
      return fs.readFileSync(logFile, 'utf-8');
    } else {
      console.log(`Log file ${logFile} does not exist.`);
      return '';
    }
  }

  async getAvailableProfiles(instance: IWorkflowInstance): Promise<string[]> {
    const local_instance = this.workflow_instances.find((inst) => inst.id === instance.id);
    if (!local_instance) {
      throw new Error(`Instance ${instance.id} not found in collection.`);
    }
    return await getAvailableProfiles(local_instance);
  }

  async cloneRepo(url: string, ver: string): Promise<IWorkflowVersion> {
    console.log(`Cloning repository ${url} version ${ver}`);
    const repo: ICloneRepo = await cloneRepo(url, this.workflow_path, ver);
    const wf_id = `${repo.owner}/${repo.repo}`;
    // Create workflow if it doesn't already exist
    let wf = this.workflows.find((wf) => wf.id === wf_id);
    if (wf === undefined) {
      wf = new Workflow({
        id: wf_id,
        name: repo.repo,
        owner: repo.owner,
        repo: repo.repo,
        url: repo.url,
        versions: []
      } as IWorkflow);
      this.workflows.push(wf);
    }
    // Check if version already exists
    let version = wf.versions.find((v) => v.version === repo.version);
    if (version !== undefined) {
      return version;
    }
    version = new WorkflowVersion({
      id: `${wf_id}@${repo.version}`,
      name: `${wf_id}@${repo.version}`,
      type: this.determineWorkflowType(repo.path),
      version: repo.version,
      path: repo.path,
      parent_id: wf.id
    });
    wf.versions.push(version);
    return version;
  }

  async setCollectionsPath(path: string) {
    this.root_path = path;
    settings.set('configPath', path);
    await this.parseCollection();
  }

  getCollectionRepos(): IRepo[] {
    const repos: IRepo[] = [];
    this.workflows.forEach((wf) => {
      wf.versions.forEach((ver) => {
        repos.push({
          id: wf.id,
          name: wf.name,
          path: ver.path,
          version: ver.version,
          url: wf.url
        } as IRepo);
      });
    });
    return repos;
  }

  async runWorkflow(
    instance: IWorkflowInstance,
    params: IWorkflowParams = {},
    opts = {}
  ): Promise<ProcessDescriptor | null> {
    const local_instance = this.workflow_instances.find((inst) => inst.id === instance.id);
    if (!local_instance) {
      throw new Error(`Instance ${instance.id} not found in collection.`);
    }
    const desc = await runWorkflow({
      instance: instance,
      params: params,
      opts: opts
    });
    if (!desc) {
      throw new Error(`Failed to start workflow instance ${instance.id}.`);
    }
    local_instance.attachProcess(desc);
    this.recordRunWorkflow(instance);
    return desc;
  }

  recordRunWorkflow(instance: IWorkflowInstance, status = 'running') {
    // Save metadata to DB
    const local_instance = this.workflow_instances.find((inst) => inst.id === instance.id);
    if (!local_instance) {
      throw new Error(`Instance ${instance.id} not found in collection.`);
    }
    local_instance.status = status;
    // Read database from glacier root
    const db_path = path.join(this.root_path, instance_database_file);
    let db: any = { runs: [] };
    if (fs.existsSync(db_path)) {
      db = JSON.parse(fs.readFileSync(db_path, 'utf-8'));
    }
    // Build the run entry with both new structured processes and legacy pids
    const entry = {
      datetime: new Date().toISOString(),
      processes: local_instance.processes,
      pids: local_instance.processes.map((p) => p.pid).filter((p) => p > 0),
      status: status
    };
    // Find existing run
    const existing_run = db.runs.find((r: any) => r.id === local_instance.id);
    if (existing_run) {
      // Append new run
      existing_run.runs.push(entry);
    } else {
      // Create instance
      db.runs.push({
        id: local_instance.id,
        name: local_instance.name,
        workflow: local_instance.workflow_version.id,
        runs: [entry]
      });
    }
    // Write DB
    fs.writeFileSync(db_path, JSON.stringify(db, null, 2));
  }

  syncRepo(path: string) {
    return syncRepo(path);
  }

  getWorkflowParams(repoPath: string) {
    return getWorkflowParams(repoPath);
  }

  getWorkflowSchema(repoPath: string): Promise<Record<string, unknown>> {
    return getWorkflowSchema(repoPath);
  }

  async isValidWorkflowRepo(repoPath: string): Promise<boolean> {
    return checkIsValidWorkflowRepo(repoPath);
  }

  getWorkflowInstanceLogs(instance: IWorkflowInstance, log_type: string): string {
    const logFile = path.join(instance.path, `${log_type}.log`);
    if (fs.existsSync(logFile)) {
      return fs.readFileSync(logFile, 'utf-8');
    } else {
      console.log(`Log file ${logFile} does not exist.`);
      return '';
    }
  }

  getInstanceReportsList(instance: IWorkflowInstance): Record<string, string>[] {
    return locateReports(instance.path);
  }

  getInstallableReposList(): IRepoVersions[] {
    return this.installable_repos;
  }

  async addInstallableRepo(url: string) {
    const { repo: name } = parseRepoUrl(url);
    let versions = await getRepoTags(url);
    if (versions.length === 0) {
      versions = await getRepoBranches(url);
    }
    if (versions.length === 0) {
      throw new Error(`No tags or branches found for repository: ${url}`);
    }
    let version;
    if (versions.includes('main')) {
      version = 'main';
    } else {
      version = versions[0];
    }
    this.installable_repos.push({
      id: `${url}`,
      name: name,
      url: url,
      path: '',
      version: version,
      versions: versions
    });
    return '';
  }

  getWorkflowInformation(instance: IWorkflowVersion): Record<string, string> {
    if (!instance || !instance.path) {
      return { error: 'Invalid workflow instance.' };
    }

    let title = '';
    let description = '';

    // Read schema file
    const schemaFile = path.join(instance.path, 'nextflow_schema.json');
    if (fs.existsSync(schemaFile)) {
      const schema = JSON.parse(fs.readFileSync(schemaFile, 'utf-8'));
      title = schema.title || instance.name;
      description = schema.description || '';
    } else {
      title = instance.name;
      description = '';
    }

    const info: Record<string, string> = {};
    info['title'] = title;
    info['description'] = description;
    return info;
  }

  getWorkflowReadme(instance: IWorkflowInstance): string {
    if (!instance || !instance.workflow_version) {
      return 'Invalid workflow instance.';
    }
    const readmeFile = path.join(instance.workflow_version.path, 'README.md');
    if (fs.existsSync(readmeFile)) {
      return fs.readFileSync(readmeFile, 'utf-8');
    } else {
      throw new Error('No README.md file found for this workflow.');
    }
  }

  getWorkflowLicense(instance: IWorkflowInstance): string {
    if (!instance || !instance.workflow_version) {
      return 'Invalid workflow instance.';
    }
    const licenseFile = path.join(instance.workflow_version.path, 'LICENSE');
    if (fs.existsSync(licenseFile)) {
      return fs.readFileSync(licenseFile, 'utf-8');
    } else {
      throw new Error('No LICENSE file found for this workflow.');
    }
  }

  settingsGet<K extends keyof StoreSchema>(key: K): StoreSchema[K] | undefined {
    return settings.get(key);
  }

  settingsSet<K extends keyof StoreSchema>(key: K, value: StoreSchema[K]): void {
    settings.set(key, value);
  }

  async openWebPage(url: string) {
    const s = await getShell();
    return s.openExternal(url);
  }

  async getEnvironmentStatus(key: string) {
    return getEnvironmentStatus(key);
  }

  async performEnvironmentAction(key: string, action: string) {
    return performEnvironmentAction(key, action);
  }

  async parseCatalogues() {
    // Clear existing catalogues
    this.catalogues = [];

    // Read catalogues from catalogues path
    if (!fs.existsSync(this.catalogues_path)) {
      console.log(`Catalogues path ${this.catalogues_path} does not exist.`);
      return;
    }
    const owners = fs.readdirSync(this.catalogues_path);
    for (const owner of owners) {
      const ownerPath = path.join(this.catalogues_path, owner);
      if (!fs.statSync(ownerPath).isDirectory()) continue;
      const repoDirs = fs.readdirSync(ownerPath);
      for (const repo of repoDirs) {
        const repoPath = path.join(ownerPath, repo);
        if (!fs.statSync(repoPath).isDirectory()) continue;
        // Read catalogue.json
        const cat_file = path.join(repoPath, 'catalogue.json');
        const cat_contents = fs.readFileSync(cat_file, 'utf-8');
        let js = JSON.parse('{}');
        try {
          js = JSON.parse(cat_contents);
        } catch (err) {
          throw new Error(`Failed to parse catalogue.json for ${owner}/${repo}: ${err}`);
        }
        js['source'] = `${owner}/${repo}`;
        js['base_dir'] = repoPath;
        // Resolve scheme_url if provided
        if (js['scheme_url']) {
          try {
            const response = await fetch(js['scheme_url']);
            if (response.ok) {
              const remoteScheme = await response.json();
              js['scheme'] = { ...remoteScheme, ...js['scheme'] };
            }
          } catch (err) {
            console.error(`Failed to fetch scheme from ${js['scheme_url']}: ${err}`);
          }
        }
        // Add to catalogues
        this.catalogues.push(js);
      }
    }
  }

  async refreshCatalogues() {
    this.parseWorkflows();
    return await this.parseCatalogues();
  }

  async addCatalogue(url: string, version: string) {
    // Clone catalogue repository and refresh catalogues list
    console.log(`Cloning catalogue repository ${url} version ${version}`);
    const hasSlash = url.includes('/');
    if (!hasSlash) {
      url = `${url}/glacier-catalogue`;
    }
    const repo: ICloneRepo = await cloneRepo(url, this.catalogues_path, version);
    const cat_file = path.join(repo.path, 'catalogue.json');
    const contents = fs.readFileSync(cat_file, 'utf-8');
    const js = JSON.parse(contents);
    js['source'] = url;
    js['base_dir'] = repo.path;
    this.parseCatalogues(); // update catalogue
  }

  async removeCatalogue(catalogue_name: string) {
    // Remove catalogue from catalogues path
    const cat = this.catalogues.find((c) => c.name === catalogue_name);
    if (!cat) {
      throw new Error(`Catalogue ${catalogue_name} not found.`);
    }
    const owner = cat.source.split('/')[0];
    const repo = cat.source.split('/')[1];
    const cat_path = path.join(this.catalogues_path, owner, repo);
    fs.rmSync(cat_path, { recursive: true, force: true });
    // Refresh catalogues
    this.parseCatalogues();
  }

  async removeCatalogueSection(catalogue_name: string, section_name: string) {
    // Remove section from catalogue
    const cat = this.catalogues.find((c) => c.name === catalogue_name);
    if (!cat) {
      throw new Error(`Catalogue ${catalogue_name} not found.`);
    }
    const section_index = cat.sections.findIndex((s) => s.name === section_name);
    if (section_index === -1) {
      throw new Error(`Section ${section_name} not found in catalogue ${catalogue_name}.`);
    }
    cat.sections.splice(section_index, 1);
    // Save to catalogues path
    const owner = cat.source.split('/')[0];
    const repo = cat.source.split('/')[1];
    const cat_path = path.join(this.catalogues_path, owner, repo, 'catalogue.json');
    fs.writeFileSync(cat_path, JSON.stringify(cat, null, 2));
    // Refresh catalogues
    this.parseCatalogues();
  }

  async removeCatalogueWorkflow(
    catalogue_name: string,
    section_name: string,
    workflow_name: string
  ) {
    // Remove workflow from catalogue section
    const cat = this.catalogues.find((c) => c.name === catalogue_name);
    if (!cat) {
      throw new Error(`Catalogue ${catalogue_name} not found.`);
    }
    const section = cat.sections.find((s) => s.name === section_name);
    if (!section) {
      throw new Error(`Section ${section_name} not found in catalogue ${catalogue_name}.`);
    }
    const workflow_index = section.workflows.findIndex((w) => w.name === workflow_name);
    if (workflow_index === -1) {
      throw new Error(
        `Workflow ${workflow_name} not found in section ${section_name} of catalogue ${catalogue_name}.`
      );
    }
    section.workflows.splice(workflow_index, 1);
    // Save to catalogues path
    const owner = cat.source.split('/')[0];
    const repo = cat.source.split('/')[1];
    const cat_path = path.join(this.catalogues_path, owner, repo, 'catalogue.json');
    fs.writeFileSync(cat_path, JSON.stringify(cat, null, 2));
    // Refresh catalogues
    this.parseCatalogues();
  }

  async uninstallCatalogueWorkflow(
    catalogue_name: string,
    section_name: string,
    workflow_name: string
  ) {
    // Keep the catalogue entry — only remove the installed files from disk
    const cat = this.catalogues.find((c) => c.name === catalogue_name);
    if (!cat) {
      throw new Error(`Catalogue ${catalogue_name} not found.`);
    }
    const section = cat.sections.find((s) => s.name === section_name);
    if (!section) {
      throw new Error(`Section ${section_name} not found in catalogue ${catalogue_name}.`);
    }
    const workflow_entry = section.workflows.find((w) => w.name === workflow_name);
    if (!workflow_entry) {
      throw new Error(
        `Workflow ${workflow_name} not found in section ${section_name} of catalogue ${catalogue_name}.`
      );
    }
    // Delete workflow repo files from disk
    const { owner: wf_owner, repo: wf_repo } = parseRepoUrl(workflow_entry.repo);
    const wf_id = `${wf_owner}/${wf_repo}`;
    const wf_index = this.workflows.findIndex((w) => w.id === wf_id);
    if (wf_index !== -1) {
      const wf = this.workflows[wf_index];
      for (const version of wf.versions) {
        if (fs.existsSync(version.path)) {
          fs.rmSync(version.path, { recursive: true, force: true });
        }
      }
      this.workflows.splice(wf_index, 1);
    }
  }

  async hideCatalogueSection(catalogue_name: string, section_name: string) {
    // Hide catalogue section by adding "hidden" property
    console.log('Hiding section', section_name, 'in catalogue', catalogue_name);
    const cat = this.catalogues.find((c) => c.name === catalogue_name);
    if (!cat) {
      throw new Error(`Catalogue ${catalogue_name} not found.`);
    }
    const section = cat.sections.find((s) => s.name === section_name);
    if (!section) {
      throw new Error(`Section ${section_name} not found in catalogue ${catalogue_name}.`);
    }
    section.hidden = true;
    // Save to catalogues path
    const owner = cat.source.split('/')[0];
    const repo = cat.source.split('/')[1];
    const cat_path = path.join(this.catalogues_path, owner, repo, 'catalogue.json');
    fs.writeFileSync(cat_path, JSON.stringify(cat, null, 2));
    // Refresh catalogues
    this.parseCatalogues();
  }

  async hideCatalogueWorkflow(catalogue_name: string, section_name: string, workflow_name: string) {
    // Hide workflow in catalogue section by adding "hidden" property
    const cat = this.catalogues.find((c) => c.name === catalogue_name);
    if (!cat) {
      throw new Error(`Catalogue ${catalogue_name} not found.`);
    }
    const section = cat.sections.find((s) => s.name === section_name);
    if (!section) {
      throw new Error(`Section ${section_name} not found in catalogue ${catalogue_name}.`);
    }
    const workflow = section.workflows.find((w) => w.name === workflow_name);
    if (!workflow) {
      throw new Error(
        `Workflow ${workflow_name} not found in section ${section_name} of catalogue ${catalogue_name}.`
      );
    }
    workflow.hidden = true;
    // Save to catalogues path
    const owner = cat.source.split('/')[0];
    const repo = cat.source.split('/')[1];
    const cat_path = path.join(this.catalogues_path, owner, repo, 'catalogue.json');
    fs.writeFileSync(cat_path, JSON.stringify(cat, null, 2));
    // Refresh catalogues
    this.parseCatalogues();
  }

  async updateCatalogueWorkflow(
    catalogue_name: string,
    section_name: string,
    workflow_name: string
  ) {
    // Update workflow in catalogue section by re-fetching tags/branches
    const cat = this.catalogues.find((c) => c.name === catalogue_name);
    if (!cat) {
      throw new Error(`Catalogue ${catalogue_name} not found.`);
    }
    const section = cat.sections.find((s) => s.name === section_name);
    if (!section) {
      throw new Error(`Section ${section_name} not found in catalogue ${catalogue_name}.`);
    }
    const workflow = section.workflows.find((w) => w.name === workflow_name);
    if (!workflow) {
      throw new Error(
        `Workflow ${workflow_name} not found in section ${section_name} of catalogue ${catalogue_name}.`
      );
    }
    // Re-fetch tags and branches
    const tags = await getRepoTags(workflow.repo);
    const branches = await getRepoBranches(workflow.repo);
    const all_versions = tags.concat(branches);
    if (all_versions.length === 0) {
      throw new Error(`No tags or branches found for repository: ${workflow.repo}`);
    }
    let updated = false;
    if (workflow.version === 'latest') {
      const wf = this.workflows.find((w) => w.id === workflow.repo);
      if (wf && wf.versions.length > 0) {
        const installedPath = wf.versions[0].path;
        if (installedPath) {
          const timeoutMs = 15000;
          const timeout = new Promise<{ status: 'ok'; updated: false }>((resolve) =>
            setTimeout(() => resolve({ status: 'ok', updated: false }), timeoutMs)
          );
          const result = await Promise.race([syncRepo(installedPath), timeout]);
          if (result.status === 'ok') {
            updated = result.updated ?? false;
          }
        }
      }
    } else if (!all_versions.includes(workflow.version || '')) {
      workflow.version = all_versions[0];
      updated = true;
    }
    // Save to catalogues path
    const cat_owner = cat.source.split('/')[0];
    const cat_repo = cat.source.split('/')[1];
    const cat_path = path.join(this.catalogues_path, cat_owner, cat_repo, 'catalogue.json');
    fs.writeFileSync(cat_path, JSON.stringify(cat, null, 2));
    // Refresh catalogues
    this.parseCatalogues();
    return { updated };
  }

  async checkCatalogueWorkflowUpdates(catalogue_name: string) {
    const cat = this.catalogues.find((c) => c.name === catalogue_name);
    if (!cat) {
      throw new Error(`Catalogue ${catalogue_name} not found.`);
    }
    // Sync the catalogue repo itself first
    if (cat.base_dir) {
      await syncRepo(cat.base_dir);
    }
    this.parseCatalogues();
    // Check each workflow
    const results: { name: string; updated: boolean; error?: string }[] = [];
    const catRef = this.catalogues.find((c) => c.name === catalogue_name);
    if (!catRef) {
      throw new Error(`Catalogue ${catalogue_name} not found after refresh.`);
    }
    for (const section of catRef.sections || []) {
      for (const workflow of section.workflows || []) {
        if (workflow.version === 'latest') {
          const wf = this.workflows.find((w) => w.id === workflow.repo);
          if (wf && wf.versions.length > 0) {
            const installedPath = wf.versions[0].path;
            if (installedPath && fs.existsSync(installedPath)) {
              try {
                const timeoutMs = 20000;
                const timeout = new Promise<{ status: 'ok'; updated: false }>((resolve) =>
                  setTimeout(() => resolve({ status: 'ok', updated: false }), timeoutMs)
                );
                const syncResult: any = await Promise.race([syncRepo(installedPath), timeout]);
                if (syncResult.status === 'ok') {
                  results.push({
                    name: workflow.name,
                    updated: syncResult.updated ?? false
                  });
                } else {
                  results.push({
                    name: workflow.name,
                    updated: false,
                    error: syncResult.message
                  });
                }
              } catch (err: unknown) {
                results.push({
                  name: workflow.name,
                  updated: false,
                  error: String(err)
                });
              }
            }
          }
        } else {
          results.push({ name: workflow.name, updated: false });
        }
      }
    }
    return {
      total: results.length,
      updated: results.filter((r) => r.updated).length,
      upToDate: results.filter((r) => !r.updated && !r.error).length,
      errors: results.filter((r) => r.error).length,
      errorDetails: results.filter((r) => r.error).map((r) => `${r.name}: ${r.error}`)
    };
  }

  async showCatalogueSectionWorkflows(catalogue_name: string, section_name: string) {
    // Show hidden workflows in catalogue section by removing "hidden" property
    const cat = this.catalogues.find((c) => c.name === catalogue_name);
    if (!cat) {
      throw new Error(`Catalogue ${catalogue_name} not found.`);
    }
    const section = cat.sections.find((s) => s.name === section_name);
    if (!section) {
      throw new Error(`Section ${section_name} not found in catalogue ${catalogue_name}.`);
    }
    section.workflows.forEach((w) => {
      w.hidden = false;
    });
    // Save to catalogues path
    const owner = cat.source.split('/')[0];
    const repo = cat.source.split('/')[1];
    const cat_path = path.join(this.catalogues_path, owner, repo, 'catalogue.json');
    fs.writeFileSync(cat_path, JSON.stringify(cat, null, 2));
    // Refresh catalogues
    this.parseCatalogues();
  }

  async showCatalogueSections(catalogue_name: string) {
    // Show hidden sections in catalogue by removing "hidden" property
    const cat = this.catalogues.find((c) => c.name === catalogue_name);
    if (!cat) {
      throw new Error(`Catalogue ${catalogue_name} not found.`);
    }
    cat.sections.forEach((s) => {
      s.hidden = false;
    });
    // Show all workflows in section
    cat.sections.forEach((s) => {
      s.workflows.forEach((w) => {
        w.hidden = false;
      });
    });
    // Save to catalogues path
    const owner = cat.source.split('/')[0];
    const repo = cat.source.split('/')[1];
    const cat_path = path.join(this.catalogues_path, owner, repo, 'catalogue.json');
    fs.writeFileSync(cat_path, JSON.stringify(cat, null, 2));
    // Refresh catalogues
    this.parseCatalogues();
  }

  async showCatalogueWorkflows(catalogue_name: string) {
    // Show hidden workflows in catalogue by removing "hidden" property
    const cat = this.catalogues.find((c) => c.name === catalogue_name);
    if (!cat) {
      throw new Error(`Catalogue ${catalogue_name} not found.`);
    }
    cat.sections.forEach((s) => {
      s.workflows.forEach((w) => {
        w.hidden = false;
      });
    });
    // Save to catalogues path
    const owner = cat.source.split('/')[0];
    const repo = cat.source.split('/')[1];
    const cat_path = path.join(this.catalogues_path, owner, repo, 'catalogue.json');
    fs.writeFileSync(cat_path, JSON.stringify(cat, null, 2));
    // Refresh catalogues
    this.parseCatalogues();
  }

  async addUserWorkflow(name: string, url: string, version: string, section: string) {
    const { owner, repo } = parseRepoUrl(url);
    if (!name) {
      name = repo;
    }
    if (!section) {
      section = 'My Workflows';
    }
    if (!version) {
      version = 'latest';
    }
    // Verify that repository url exists
    const tags = await getRepoTags(url);
    const branches = await getRepoBranches(url);
    const all_versions = tags.concat(branches);
    if (all_versions.length === 0) {
      throw new Error(`No tags or branches found for repository: ${url}`);
    }
    if (version !== 'latest' && !all_versions.includes(version)) {
      throw new Error(
        `Version ${version} not found for repository: ${url}. Available versions: ${all_versions.join(
          ', '
        )}`
      );
    }
    // Add workflow to catalogue
    const user_cat_path = path.join(
      this.catalogues_path,
      'user_collection',
      'store',
      'catalogue.json'
    );
    let user_catalogue: Catalogue;
    if (fs.existsSync(user_cat_path)) {
      // Read existing catalogue
      const contents = fs.readFileSync(user_cat_path, 'utf-8');
      user_catalogue = JSON.parse(contents);
    } else {
      // Create new catalogue
      user_catalogue = {
        name: 'User collection',
        source: 'local',
        sections: []
      };
    }
    // Find (or create) section
    let user_section = user_catalogue.sections.find((sec) => sec.name === section);
    if (!user_section) {
      user_section = {
        name: section,
        workflows: []
      };
      user_catalogue.sections.push(user_section);
    }
    user_section.workflows.push({
      name: name,
      repo: `${owner}/${repo}`,
      version: version
    });
    // Save to catalogues path
    this.ensurePathExists(path.dirname(user_cat_path));
    fs.writeFileSync(user_cat_path, JSON.stringify(user_catalogue, null, 2));
    // Refresh catalogues
    this.parseCatalogues();
  }

  async getCatalogues() {
    // Max timeout of 10 seconds to wait for catalogues to be parsed
    const start = Date.now();
    while (this.starting_up) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (Date.now() - start > 10000) {
        return this.catalogues;
      }
    }
    return this.catalogues;
  }

  async isRepoInstalled(url: string, version: string): Promise<string> {
    const { owner, repo } = parseRepoUrl(url);
    const wf = this.workflows.find((wf) => wf.id === `${owner}/${repo}`);
    if (!wf) {
      return '';
    }
    if (version === 'latest') {
      // Any version installed
      if (wf.versions.length > 0) {
        return wf.versions[0].version || '';
      } else {
        return '';
      }
    }
    const ver = wf.versions.find((v) => v.version === version);
    if (ver) {
      return ver.version || '';
    } else {
      return '';
    }
  }

  async getSystemResources(): Promise<Record<string, unknown>> {
    // ram and cores
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    return {
      cpuCores: cpus.length,
      totalMem: totalMem,
      freeMem: freeMem
    };
  }

  async importManifest(manifestPath: string) {
    const contents = fs.readFileSync(manifestPath, 'utf-8');
    const manifest = JSON.parse(contents);
    if (manifest.catalogues && Array.isArray(manifest.catalogues)) {
      for (const cat of manifest.catalogues) {
        const url = cat.url;
        const version = cat?.version || '';
        try {
          await this.addCatalogue(url, version);
          console.log(`Successfully imported catalogue from ${url}`);
        } catch (err) {
          console.error(`Failed to import catalogue from ${url}: ${err}`);
        }
      }
    } else {
      console.error('Invalid manifest format: "catalogues" array is missing.');
    }
  }

  async importShard(filePath: string) {
    return importShard(filePath, this.root_path);
  }

  async queryShardStatus(shardId: string) {
    return queryShardStatus(shardId);
  }
}
