// Main Collection store for workflows and instances

import path from 'path';
import os from 'os';
import fs from 'fs';
import * as safeFs from './safe-fs.js';
import { IRepo, IRepoVersions } from './types.js';
import { getShell } from './shell.js';
import { generateUniqueName } from './repo.js';
import {
  cloneRepo,
  ICloneRepo,
  getRepoTags,
  getRepoBranches,
  parseRepoUrl,
  sortTagsBySemver
} from './repo.js';
import { runWorkflow } from './runner.js';
import { getEnvironmentStatus, performEnvironmentAction } from '../runners/environment.js';
import { ProcessDescriptor, WorkflowStatus } from '../types/types.js';
import {
  syncRepo,
  getWorkflowParams,
  getWorkflowSchema,
  isValidWorkflowRepo as checkIsValidWorkflowRepo
} from './repo.js';
import {
  getConfigPath,
  getDocumentsPath,
  getOutputPath,
  getStoreDirPath,
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

export interface CatalogueParseError {
  source: string;
  error: string;
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
  sourceVersion?: string; // original catalogue version request ('latest' or specific tag)
}

class WorkflowVersion implements IWorkflowVersion {
  id: string;
  name: string;
  type: IWorkflowType;
  version: string | undefined;
  path: string;
  parent_id: string; // reference to parent workflow
  sourceVersion?: string;

  constructor({ id, name, type, version, path, parent_id, sourceVersion }: IWorkflowVersion) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.version = version;
    this.path = path;
    this.parent_id = parent_id;
    this.sourceVersion = sourceVersion;
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
    // Read the most recent nextflow.log (handles rotation: nextflow.log, nextflow.log.1, ...)
    let logFile = path.join(this.path, 'nextflow.log');
    if (fs.existsSync(this.path)) {
      const candidates = fs
        .readdirSync(this.path)
        .filter((f) => f.startsWith('nextflow.log'))
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
    const launch = run.runs.find((e: any) => e.status === 'running');
    return launch?.datetime || run.runs[0].datetime || undefined;
  }

  getLastUpdateTime(): string | undefined {
    if (!this._cachedProgress) return undefined;
    const progress = this._cachedProgress;
    let latest: string | undefined;
    const consider = (ts: string | undefined) => {
      if (ts && (!latest || ts > latest)) latest = ts;
    };
    // Walk process tree for ISO 8601 timestamps only
    // Note: p.time and entry.time are raw nextflow log prefixes (e.g. "Apr-01 12:34:56")
    // and must NOT be compared as ISO 8601 strings — they can produce incorrect ordering
    // or parse to the same value as launch_time.
    const walk = (items: any[]) => {
      for (const item of items) {
        consider(item.last_update);
        for (const p of item.process || []) {
          consider(p.last_update);
        }
        if (item.group?.length) walk(item.group);
      }
    };
    walk(progress.group || []);
    // Fallback: use nextflow.log modification time if tree had no ISO timestamps
    if (!latest) {
      try {
        if (fs.existsSync(this.path)) {
          const candidates = fs
            .readdirSync(this.path)
            .filter((f) => f.startsWith('nextflow.log'))
            .map((f) => ({
              name: f,
              mtime: fs.statSync(path.join(this.path, f)).mtimeMs
            }))
            .sort((a, b) => b.mtime - a.mtime);
          if (candidates.length > 0) {
            latest = new Date(candidates[0].mtime).toISOString();
          }
        }
      } catch {}
    }
    return latest;
  }

  private _cachedProgress: Record<string, any> | null = null;

  setCachedProgress(data: Record<string, any> | null) {
    this._cachedProgress = data;
  }
}

const STATUS_PRIORITY: Record<string, number> = {
  completed: 4,
  error: 3,
  submitted: 2,
  starting: 1,
  created: 0
};

function countProcesses(groups: any[]): { total: number; completed: number } {
  const allProcesses = new Map<string, string>();
  const walk = (items: any[]) => {
    for (const item of items) {
      for (const p of item.process || []) {
        const priority = STATUS_PRIORITY[p.status] ?? -1;
        const existingStatus = allProcesses.get(p.full_name);
        const existingPriority =
          existingStatus !== undefined ? (STATUS_PRIORITY[existingStatus] ?? -1) : -1;
        if (priority >= existingPriority) {
          allProcesses.set(p.full_name, p.status);
        }
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

function findStoreDirKey(schema: Record<string, any>): string | null {
  const storeDirKeys = ['store_dir', 'storedir', 'store-dir'];
  const props = schema?.properties ?? {};
  for (const key of storeDirKeys) {
    if (key in props) return key;
  }
  const defs = schema?.$defs || schema?.definitions || {};
  for (const defKey of Object.keys(defs)) {
    const defProps = defs[defKey]?.properties ?? {};
    for (const key of storeDirKeys) {
      if (key in defProps) return key;
    }
  }
  return null;
}

function findOutdirKey(schema: Record<string, any>): string | null {
  const outdirKeys = ['outdir', 'outputDir', 'output_dir'];
  const props = schema?.properties ?? {};
  for (const key of outdirKeys) {
    if (key in props) return key;
  }
  const defs = schema?.$defs || schema?.definitions || {};
  for (const defKey of Object.keys(defs)) {
    const defProps = defs[defKey]?.properties ?? {};
    for (const key of outdirKeys) {
      if (key in defProps) return key;
    }
  }
  return null;
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
  catalogueParseErrors: CatalogueParseError[] = [];
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

  async init(resourceRoot?: string): Promise<Record<string, boolean>> {
    // Re-read paths from store in case they were changed
    this.root_path = getConfigPath();
    this.documents_root_path = getDocumentsPath();

    // Clean up stale temp files from previous crashes
    this.cleanupTempFiles();

    // Check path existence BEFORE parseCollection (which auto-creates dirs)
    const missing: Record<string, boolean> = {
      config: !this.root_path || !safeFs.existsSync(this.root_path),
      documents: !this.documents_root_path || !safeFs.existsSync(this.documents_root_path)
    };

    if (process.versions?.electron !== undefined && !safeFs.existsSync(this.catalogues_path)) {
      if (resourceRoot) {
        const manifestPath = path.join(resourceRoot, 'manifest.json');
        if (safeFs.existsSync(manifestPath)) {
          await this.importManifest(manifestPath);
        }
      }
    }
    await this.parseCollection();
    this.starting_up = false;
    return missing;
  }

  /** Remove stale .tmp files left behind by interrupted transactional writes */
  private cleanupTempFiles() {
    const dbPath = path.join(this.root_path, instance_database_file);
    const tmpPath = dbPath + '.tmp';
    safeFs.rmSync(tmpPath, { force: true });
  }

  getDefaultPaths(): Record<string, string> {
    return {
      config: getDefaultConfigDir(),
      documents: getDefaultDocumentsDir()
    };
  }

  getMissingPaths(): Record<string, boolean> {
    return {
      config: !this.root_path || !safeFs.existsSync(this.root_path),
      documents: !this.documents_root_path || !safeFs.existsSync(this.documents_root_path)
    };
  }

  /**
   * Check the integrity of core paths and state, returning a list of issues.
   * Does not mutate state — call repairState() to fix issues.
   */
  async integrityCheck(): Promise<{
    ok: boolean;
    issues: Array<{ severity: 'error' | 'warning'; message: string }>;
  }> {
    const issues: Array<{ severity: 'error' | 'warning'; message: string }> = [];

    // Core paths
    if (!this.root_path || !safeFs.existsSync(this.root_path)) {
      issues.push({ severity: 'error', message: `Config path does not exist: ${this.root_path}` });
    }
    if (!this.documents_root_path || !safeFs.existsSync(this.documents_root_path)) {
      issues.push({
        severity: 'error',
        message: `Documents path does not exist: ${this.documents_root_path}`
      });
    }
    if (!safeFs.existsSync(this.workflow_path)) {
      issues.push({
        severity: 'warning',
        message: `Workflows path does not exist: ${this.workflow_path}`
      });
    }
    if (!safeFs.existsSync(this.instances_path)) {
      issues.push({
        severity: 'warning',
        message: `Instances path does not exist: ${this.instances_path}`
      });
    }

    // Instance database integrity
    const dbPath = path.join(this.root_path, instance_database_file);
    if (safeFs.existsSync(dbPath)) {
      const raw = safeFs.readFileSync(dbPath);
      if (!raw.ok) {
        issues.push({
          severity: 'error',
          message: `Cannot read instance database: ${raw.error.message}`
        });
      } else {
        try {
          const db = JSON.parse(raw.data);
          if (!db?.runs || !Array.isArray(db.runs)) {
            issues.push({ severity: 'error', message: 'Instance database has invalid structure' });
          }
        } catch {
          issues.push({
            severity: 'error',
            message: 'Instance database is corrupt (invalid JSON)'
          });
        }
      }
    }

    // Orphaned .tmp files
    const tmpPath = dbPath + '.tmp';
    if (safeFs.existsSync(tmpPath)) {
      issues.push({ severity: 'warning', message: `Stale temp file found: ${tmpPath}` });
    }

    // Running processes consistency
    for (const inst of this.workflow_instances) {
      if (inst.processes.length > 0) {
        for (const desc of inst.processes) {
          const alive = await this.verifyProcess(desc);
          if (!alive) {
            issues.push({
              severity: 'warning',
              message: `Instance ${inst.id} has stale process (PID ${desc.pid})`
            });
          }
        }
      }
      if (!safeFs.existsSync(inst.path)) {
        issues.push({
          severity: 'warning',
          message: `Instance ${inst.id} path missing: ${inst.path}`
        });
      }
    }

    return { ok: issues.filter((i) => i.severity === 'error').length === 0, issues };
  }

  /**
   * Attempt to repair common state inconsistencies.
   * Recreates missing core directories and cleans up stale temp files.
   */
  async repairState(): Promise<{ repaired: string[]; failed: string[] }> {
    const repaired: string[] = [];
    const failed: string[] = [];

    // Recreate missing core directories
    for (const [label, dir] of [
      ['config', this.root_path],
      ['documents', this.documents_root_path],
      ['workflows', this.workflow_path],
      ['instances', this.instances_path],
      ['catalogues', this.catalogues_path]
    ] as [string, string][]) {
      if (dir && !safeFs.existsSync(dir)) {
        const result = safeFs.mkdirSync(dir, { recursive: true });
        if (result.ok) {
          repaired.push(`Created ${label} directory: ${dir}`);
        } else {
          failed.push(`Failed to create ${label} directory ${dir}: ${result.error.message}`);
        }
      }
    }

    // Clean up .tmp files
    const dbPath = path.join(this.root_path, instance_database_file);
    const tmpPath = dbPath + '.tmp';
    if (safeFs.existsSync(tmpPath)) {
      const result = safeFs.rmSync(tmpPath, { force: true });
      if (result.ok) {
        repaired.push(`Removed stale temp file: ${tmpPath}`);
      } else {
        failed.push(`Failed to remove stale temp file ${tmpPath}: ${result.error.message}`);
      }
    }

    // Re-parse collection to resync in-memory state with disk
    try {
      await this.parseCollection();
      repaired.push('Re-parsed collection from disk');
    } catch (err) {
      failed.push(`Failed to re-parse collection: ${err}`);
    }

    return { repaired, failed };
  }

  async parseCollection() {
    this.parseWorkflows();
    this.parseInstallableRepos();
    await this.parseCatalogues();
    await this.revertOrphanedWorkflows();
    await this.parseInstances();
  }

  private parseWorkflows() {
    // Clean existing workflows
    this.workflows = [];
    // Hierarchy: root_path/workflows/owner/repo@version/    with version=tag or branch
    this.ensurePathExists(this.workflow_path);
    console.log(`Parsing collection from path: ${this.workflow_path}`);
    const owners = safeFs.readdirSync(this.workflow_path);
    if (!owners.ok) {
      console.warn(`Cannot read workflows directory: ${owners.error.message}`);
      return;
    }
    for (const owner of owners.data) {
      try {
        const ownerPath = path.join(this.workflow_path, owner);
        const ownerStat = safeFs.statSync(ownerPath);
        if (!ownerStat.ok || !ownerStat.data.isDirectory()) continue;
        const repoDirs = safeFs.readdirSync(ownerPath);
        if (!repoDirs.ok) {
          console.warn(`Cannot read directory ${ownerPath}: ${repoDirs.error.message}`);
          continue;
        }
        for (const repo_and_version of repoDirs.data) {
          const version_path = path.join(ownerPath, repo_and_version);
          const verStat = safeFs.statSync(version_path);
          if (!verStat.ok || !verStat.data.isDirectory()) continue;
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
          // Read persisted version metadata for @latest directories
          let actualVersion = version;
          if (version === 'latest') {
            const metaFile = path.join(versionPath, '.glacier-version');
            const metaResult = safeFs.readFileSync(metaFile);
            if (metaResult.ok) {
              actualVersion = metaResult.data.trim();
            }
          }
          wf.versions.push({
            id: `${owner}/${repo}${versionPostfix}`,
            name: `${owner}/${repo}${versionPostfix}`,
            type: type,
            version: actualVersion,
            path: versionPath,
            parent_id: wf.id,
            sourceVersion: version === 'latest' ? 'latest' : undefined
          } as WorkflowVersion);
        }
      } catch (err) {
        console.warn(`Skipping malformed workflow entry ${owner}: ${err}`);
        continue;
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
    const owners = safeFs.readdirSync(this.instances_path);
    if (!owners.ok) {
      console.warn(`Cannot read instances directory: ${owners.error.message}`);
      return;
    }
    for (const owner of owners.data) {
      try {
        const ownerPath = path.join(this.instances_path, owner);
        const ownerStat = safeFs.statSync(ownerPath);
        if (!ownerStat.ok || !ownerStat.data.isDirectory()) continue;
        const repoDirs = safeFs.readdirSync(ownerPath);
        if (!repoDirs.ok) continue;
        for (const repo_and_version of repoDirs.data) {
          const version_path = path.join(ownerPath, repo_and_version);
          const verStat = safeFs.statSync(version_path);
          if (!verStat.ok || !verStat.data.isDirectory()) continue;
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
          const instanceDirs = safeFs.readdirSync(versionPath);
          if (!instanceDirs.ok) continue;
          for (const instanceDir of instanceDirs.data) {
            const instStat = safeFs.statSync(path.join(versionPath, instanceDir));
            if (!instStat.ok || !instStat.data.isDirectory()) continue;
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
      } catch (err) {
        console.warn(`Skipping malformed instance entry ${owner}: ${err}`);
        continue;
      }
    }
    // Now that the instance folder tree has been parsed, cross-reference with the
    // instance database that contains process IDs, etc.
    await this.parseInstanceDatabase();
  }

  private async parseInstanceDatabase() {
    const db_path = path.join(this.root_path, instance_database_file);
    if (!safeFs.existsSync(db_path)) {
      console.log('No instance database found.');
      return;
    }
    const raw = safeFs.readFileSync(db_path);
    if (!raw.ok) {
      console.warn(`Cannot read instance database: ${raw.error.message}`);
      return;
    }
    let db: any;
    try {
      db = JSON.parse(raw.data);
    } catch (err) {
      console.error(`Instance database is corrupt, backing up and resetting: ${err}`);
      const backupPath = db_path + '.corrupt.' + Date.now();
      safeFs.renameSync(db_path, backupPath);
      return;
    }
    if (!db?.runs || !Array.isArray(db.runs)) {
      console.warn('Instance database has no valid runs array, resetting.');
      const backupPath = db_path + '.corrupt.' + Date.now();
      safeFs.renameSync(db_path, backupPath);
      return;
    }
    let db_updated = false;
    for (const run of db.runs) {
      const instance = this.workflow_instances.find((inst) => inst.id === run.id);
      if (!instance) {
        const latest_run = run.runs?.length > 0 ? run.runs[run.runs.length - 1] : null;
        // Try new-style processes first, fall back to old-style pids
        const descriptors = this.getDescriptorsFromRun(latest_run);
        for (const desc of descriptors) {
          if (await this.verifyProcess(desc)) {
            // Kill orphan — instance folder gone but process still alive
            if (desc.containerId) {
              try {
                const { docker } = await import('../runners/docker/docker.js');
                const container = docker.getContainer(desc.containerId);
                await container.kill();
              } catch (err) {
                console.error(`Failed to kill orphan container ${desc.containerId}: ${err}`);
              }
            } else {
              this.killPID(desc.pid, 'kill');
            }
            console.log(
              `Instance ${run.id} found in database but not in filesystem, killed orphan process.`
            );
          }
        }
        console.log(`Instance ${run.id} found in database but not in filesystem, removing.`);
        db.runs = db.runs.filter((r: any) => r.id !== run.id);
        db_updated = true;
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
      this.writeInstanceDatabase(db, db_path);
    }
  }

  /** Atomic write to instances DB: write to temp file, then rename */
  private writeInstanceDatabase(db: any, dbPath: string): boolean {
    // Clean up stale temp files from previous crashes
    const tmpPath = dbPath + '.tmp';
    safeFs.rmSync(tmpPath, { force: true });
    const result = safeFs.writeFileSync(tmpPath, JSON.stringify(db, null, 2));
    if (!result.ok) {
      // Try direct write as fallback
      const fallback = safeFs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
      if (!fallback.ok) {
        console.error(`Failed to write instance database: ${fallback.error.message}`);
        return false;
      }
      return true;
    }
    const renameResult = safeFs.renameSync(tmpPath, dbPath);
    if (!renameResult.ok) {
      console.error(`Failed to atomically write instance database: ${renameResult.error.message}`);
      safeFs.rmSync(tmpPath, { force: true });
      return false;
    }
    return true;
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
          .map(
            (p) =>
              `${p.pid}${p.containerId ? ' (container:' + p.containerId.slice(0, 12) + ')' : ''}`
          )
          .join(', ');
        console.log(`  - Processes: ${descs}`);
      }
    }
  }

  ensurePathExists(folder: string): boolean {
    if (!this.root_path || !folder) {
      console.error('Root path or workflow path is not set.');
      return false;
    }
    if (!safeFs.existsSync(folder)) {
      const result = safeFs.mkdirSync(folder, { recursive: true });
      if (!result.ok) {
        console.error(`Failed to create directory ${folder}: ${result.error.message}`);
        return false;
      }
    }
    return true;
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

  getOutputPath(): string {
    return getOutputPath();
  }

  getStoreDirPath(): string {
    return getStoreDirPath();
  }

  async setOutputPath(path: string) {
    settings.set('outputPath', path);
  }

  async setStoreDirPath(path: string) {
    settings.set('storeDirPath', path);
  }

  async createWorkflowInstance(workflow_id: string, version: string): Promise<IWorkflowInstance> {
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
      workflow_version =
        workflow.versions.find((v) => v.sourceVersion === 'latest') || workflow.versions[0];
    } else {
      workflow_version = workflow.versions.filter((v: any) => v.version === version)[0];
    }
    const repo_and_version = `${workflow.repo}@${workflow_version.version}`;
    const existing_ids = this.workflow_instances.map((inst) => inst.id);
    const instance_name = generateUniqueName(existing_ids);
    const instance_id = instance_name;
    const instance_path = path.join(this.instances_path, owner, repo_and_version, instance_name);
    this.ensurePathExists(instance_path);

    // Auto-set store_dir and outdir if enabled
    if (this.settingsGet('autoStoreDir') || this.settingsGet('autoOutdir')) {
      const schema = await getWorkflowSchema(workflow_version.path);
      const params: Record<string, string> = {};
      if (this.settingsGet('autoStoreDir')) {
        const storeDirKey = findStoreDirKey(schema);
        if (storeDirKey) {
          const storeDirPath = getStoreDirPath();
          params[storeDirKey] = storeDirPath;
          safeFs.mkdirSync(storeDirPath, { recursive: true });
        }
      }
      if (this.settingsGet('autoOutdir')) {
        const outdirKey = findOutdirKey(schema);
        if (outdirKey) {
          const outputDir = path.join(getOutputPath(), owner, repo_and_version, instance_name);
          params[outdirKey] = outputDir;
          safeFs.mkdirSync(outputDir, { recursive: true });
        }
      }
      if (Object.keys(params).length > 0) {
        const paramsFile = path.join(instance_path, 'glacier-params.json');
        safeFs.writeFileSync(paramsFile, JSON.stringify(params, null, 2));
      }
    }

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
        instance.status === WorkflowStatus.Completed ||
        instance.status === WorkflowStatus.Failed
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
    if (safeFs.existsSync(db_path)) {
      const raw = safeFs.readFileSync(db_path);
      if (raw.ok) {
        try {
          instanceDb = JSON.parse(raw.data);
        } catch {
          /* corrupt DB, ignore */
        }
      }
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
    const readResult = safeFs.readFileSync(filename);
    if (!readResult.ok) {
      console.log(`Params file ${filename} does not exist.`);
      return {};
    }
    try {
      return JSON.parse(readResult.data);
    } catch {
      console.warn(`Params file ${filename} is corrupt, returning empty.`);
      return {};
    }
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
        const out = execSync(`wmic process where processid=${pid} get commandline /format:list`, {
          encoding: 'utf-8',
          timeout: 3000
        });
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
        const excerpt = actualCmd.length > 120 ? actualCmd.slice(0, 120) + '...' : actualCmd;
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
    if (safeFs.existsSync(local_instance.path)) {
      const entries = safeFs.readdirSync(local_instance.path);
      if (entries.ok) {
        for (const entry of entries.data) {
          if (entry === 'glacier-params.json') continue;
          safeFs.rmSync(path.join(local_instance.path, entry), { recursive: true, force: true });
        }
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
    if (safeFs.existsSync(local_instance.path)) {
      safeFs.rmSync(local_instance.path, { recursive: true, force: true });
    }
    // Remove from collection
    this.workflow_instances.splice(local_instance_index, 1);
    // Update database
    const db_path = path.join(this.root_path, instance_database_file);
    if (safeFs.existsSync(db_path)) {
      const readResult = safeFs.readFileSync(db_path);
      if (readResult.ok) {
        try {
          const db = JSON.parse(readResult.data);
          db.runs = db.runs.filter((r: any) => r.id !== instance.id);
          this.writeInstanceDatabase(db, db_path);
        } catch (err) {
          console.error(`Failed to update instance database: ${err}`);
        }
      }
    }
  }

  async deleteInstanceOutput(instance: IWorkflowInstance): Promise<void> {
    const outputPath = this.getOutputPathForInstance(instance);
    if (outputPath && safeFs.existsSync(outputPath)) {
      safeFs.rmSync(outputPath, { recursive: true, force: true });
    }
  }

  async openResultsFolder(instance: IWorkflowInstance) {
    const local_instance = this.workflow_instances.find((inst) => inst.id === instance.id);
    if (!local_instance) {
      throw new Error(`Instance ${instance.id} not found in collection.`);
    }
    const folderPath = local_instance.path;
    if (safeFs.existsSync(folderPath)) {
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
    if (!safeFs.existsSync(folderPath)) {
      return 0;
    }
    let totalSize = 0;
    const walkDir = (dir: string) => {
      const entries = safeFs.readdirWithFileTypesSync(dir);
      if (!entries.ok) return;
      for (const entry of entries.data) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walkDir(fullPath);
        } else if (entry.isFile()) {
          const statResult = safeFs.statSync(fullPath);
          if (statResult.ok) {
            totalSize += statResult.data.size;
          }
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
      if (safeFs.existsSync(inst.path)) {
        safeFs.rmSync(inst.path, { recursive: true, force: true });
      }
      // Remove from collection
      const idx = this.workflow_instances.indexOf(inst);
      if (idx !== -1) {
        this.workflow_instances.splice(idx, 1);
      }
    }
    // Clean up database
    const db_path = path.join(this.root_path, instance_database_file);
    if (safeFs.existsSync(db_path)) {
      const readResult = safeFs.readFileSync(db_path);
      if (readResult.ok) {
        try {
          const db = JSON.parse(readResult.data);
          const orphanIds = new Set(orphans.map((o) => o.id));
          db.runs = db.runs.filter((r: any) => !orphanIds.has(r.id));
          this.writeInstanceDatabase(db, db_path);
        } catch (err) {
          console.error(`Failed to update instance database: ${err}`);
        }
      }
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
    if (safeFs.existsSync(db_path)) {
      const readResult = safeFs.readFileSync(db_path);
      if (readResult.ok) {
        try {
          const db = JSON.parse(readResult.data);
          const run = db.runs.find((r: any) => r.id === local_instance.id);
          if (run) {
            run.hidden = true;
            this.writeInstanceDatabase(db, db_path);
          }
        } catch (err) {
          console.error(`Failed to update instance database: ${err}`);
        }
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
    if (safeFs.existsSync(db_path)) {
      const readResult = safeFs.readFileSync(db_path);
      if (readResult.ok) {
        try {
          const db = JSON.parse(readResult.data);
          const run = db.runs.find((r: any) => r.id === local_instance.id);
          if (run) {
            delete run.hidden;
            this.writeInstanceDatabase(db, db_path);
          }
        } catch (err) {
          console.error(`Failed to update instance database: ${err}`);
        }
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
    if (!safeFs.existsSync(workFolder)) {
      throw new Error(`Work folder ${workFolder} does not exist.`);
    }
    // Find matching folders
    const readResult = safeFs.readdirSync(workFolder);
    if (!readResult.ok) {
      throw new Error(`Cannot read work folder ${workFolder}: ${readResult.error.message}`);
    }
    const candidates = readResult.data.filter((f) => f.startsWith(short_hash));
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
    if (!safeFs.existsSync(workFolder)) {
      throw new Error(`Work folder ${workFolder} does not exist.`);
    }
    // Find matching folders
    const readResult = safeFs.readdirSync(workFolder);
    if (!readResult.ok) {
      throw new Error(`Cannot read work folder ${workFolder}: ${readResult.error.message}`);
    }
    const candidates = readResult.data.filter((f) => f.startsWith(short_hash));
    if (candidates.length === 0) {
      throw new Error(`No work folders found matching ID: ${workID}`);
    } else if (candidates.length > 1) {
      console.warn(`Multiple work folders found matching ID: ${workID}, using first match.`);
    }
    const folderPath = path.join(workFolder, candidates[0]);
    const logFile = path.join(folderPath, `${log_filename}`);
    const logResult = safeFs.readFileSync(logFile);
    if (logResult.ok) {
      return logResult.data;
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

  async cloneRepo(url: string, ver: string, sourceVer?: string): Promise<IWorkflowVersion> {
    console.log(`Cloning repository ${url} version ${ver}`);
    const isLatest = sourceVer === 'latest';
    const repo: ICloneRepo = await cloneRepo(
      url,
      this.workflow_path,
      ver,
      isLatest ? 'latest' : undefined
    );
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
    // Check if version already exists at this path
    let version = wf.versions.find((v) => v.path === repo.path);
    if (version !== undefined) {
      if (sourceVer && version.sourceVersion !== sourceVer) {
        version.sourceVersion = sourceVer;
      }
      if (version.version !== repo.version) {
        version.version = repo.version;
      }
      if (isLatest) {
        safeFs.writeFileSync(path.join(repo.path, '.glacier-version'), repo.version);
      }
      return version;
    }
    version = new WorkflowVersion({
      id: `${wf_id}@${repo.version}`,
      name: `${wf_id}@${repo.version}`,
      type: this.determineWorkflowType(repo.path),
      version: repo.version,
      path: repo.path,
      parent_id: wf.id,
      sourceVersion: sourceVer || ver
    });
    // Persist the actual version for @latest directories so it survives refresh
    if (isLatest) {
      safeFs.writeFileSync(path.join(repo.path, '.glacier-version'), repo.version);
    }
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
    if (safeFs.existsSync(db_path)) {
      const raw = safeFs.readFileSync(db_path);
      if (raw.ok) {
        try {
          db = JSON.parse(raw.data);
        } catch {
          /* corrupt DB, start fresh */
        }
        if (!db?.runs || !Array.isArray(db.runs)) db = { runs: [] };
      }
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
    this.writeInstanceDatabase(db, db_path);
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
    const logResult = safeFs.readFileSync(logFile);
    if (logResult.ok) {
      return logResult.data;
    } else {
      console.log(`Log file ${logFile} does not exist.`);
      return '';
    }
  }

  async openLogFile(instance: IWorkflowInstance, log_type: string) {
    const local_instance = this.workflow_instances.find((inst) => inst.id === instance.id);
    if (!local_instance) {
      throw new Error(`Instance ${instance.id} not found in collection.`);
    }
    const logFile = path.join(local_instance.path, `${log_type}.log`);
    if (safeFs.existsSync(logFile)) {
      const s = await getShell();
      return s.openInEditor(logFile);
    }
  }

  async openWorkLogFile(instance: IWorkflowInstance, workID: string, log_type: string) {
    const local_instance = this.workflow_instances.find((inst) => inst.id === instance.id);
    if (!local_instance) {
      throw new Error(`Instance ${instance.id} not found in collection.`);
    }
    const log_filenames: Record<string, string> = {
      stdout: '.command.out',
      stderr: '.command.err',
      log: '.command.log',
      run: '.command.run',
      shell: '.command.sh',
      trace: '.command.trace',
      begin: '.command.begin'
    };
    const log_filename = log_filenames[log_type];
    if (!log_filename) {
      throw new Error(`Unknown log type: ${log_type}`);
    }
    const match = workID.match(/^([a-f0-9]{2})\/([a-f0-9]{6})$/);
    if (!match) {
      throw new Error(`Invalid work ID format: ${workID}`);
    }
    const prefix = match[1];
    const short_hash = match[2];
    const workFolder = path.join(local_instance.path, 'work', prefix);
    if (!safeFs.existsSync(workFolder)) {
      throw new Error(`Work folder ${workFolder} does not exist.`);
    }
    const readResult = safeFs.readdirSync(workFolder);
    if (!readResult.ok) {
      throw new Error(`Cannot read work folder ${workFolder}: ${readResult.error.message}`);
    }
    const candidates = readResult.data.filter((f) => f.startsWith(short_hash));
    if (candidates.length === 0) {
      throw new Error(`No work folders found matching ID: ${workID}`);
    } else if (candidates.length > 1) {
      console.warn(`Multiple work folders found matching ID: ${workID}, using first match.`);
    }
    const folderPath = path.join(workFolder, candidates[0]);
    const logFile = path.join(folderPath, log_filename);
    if (safeFs.existsSync(logFile)) {
      const s = await getShell();
      return s.openInEditor(logFile);
    }
  }

  getInstanceReportsList(instance: IWorkflowInstance): Record<string, string>[] {
    return locateReports(instance.path);
  }

  getPathReportsList(reportsPath: string): Record<string, string>[] {
    return locateReports(reportsPath);
  }

  getOutputPathForInstance(instance: IWorkflowInstance): string | null {
    // Look up the workflow to get owner/repo
    const workflow = this.workflows.find(
      (w) => w.id === instance.workflow_version.parent_id,
    );
    if (!workflow) return null;
    const version = instance.workflow_version.version || 'latest';
    const repoAndVersion = `${workflow.repo}@${version}`;
    const outputDir = path.join(getOutputPath(), workflow.owner, repoAndVersion, instance.name);
    if (!safeFs.existsSync(outputDir)) return null;
    return outputDir;
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
    const schemaResult = safeFs.readFileSync(schemaFile);
    if (schemaResult.ok) {
      try {
        const schema = JSON.parse(schemaResult.data);
        title = schema.title || instance.name;
        description = schema.description || '';
      } catch {
        title = instance.name;
        description = '';
      }
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
    const readResult = safeFs.readFileSync(readmeFile);
    if (readResult.ok) {
      return readResult.data;
    } else {
      throw new Error('No README.md file found for this workflow.');
    }
  }

  getWorkflowLicense(instance: IWorkflowInstance): string {
    if (!instance || !instance.workflow_version) {
      return 'Invalid workflow instance.';
    }
    const licenseFile = path.join(instance.workflow_version.path, 'LICENSE');
    const readResult = safeFs.readFileSync(licenseFile);
    if (readResult.ok) {
      return readResult.data;
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
    this.catalogues = [];
    this.catalogueParseErrors = [];

    if (!safeFs.existsSync(this.catalogues_path)) {
      console.log(`Catalogues path ${this.catalogues_path} does not exist.`);
      return;
    }
    const owners = safeFs.readdirSync(this.catalogues_path);
    if (!owners.ok) {
      console.warn(`Cannot read catalogues directory: ${owners.error.message}`);
      return;
    }
    for (const owner of owners.data) {
      try {
        const ownerPath = path.join(this.catalogues_path, owner);
        const ownerStat = safeFs.statSync(ownerPath);
        if (!ownerStat.ok || !ownerStat.data.isDirectory()) continue;
        const repoDirs = safeFs.readdirSync(ownerPath);
        if (!repoDirs.ok) continue;
        for (const repo of repoDirs.data) {
          try {
            const repoPath = path.join(ownerPath, repo);
            const repoStat = safeFs.statSync(repoPath);
            if (!repoStat.ok || !repoStat.data.isDirectory()) continue;

            const cat_file = path.join(repoPath, 'catalogue.json');
            const catRead = safeFs.readFileSync(cat_file);
            if (!catRead.ok) {
              this.catalogueParseErrors.push({
                source: `${owner}/${repo}`,
                error: `Failed to read catalogue.json: ${catRead.error.message}`
              });
              continue;
            }
            let cat_contents = catRead.data;
            let js: any;
            try {
              js = JSON.parse(cat_contents);
            } catch (err) {
              this.catalogueParseErrors.push({
                source: `${owner}/${repo}`,
                error: `Failed to parse catalogue.json: ${err}`
              });
              continue;
            }
            js['source'] = `${owner}/${repo}`;
            js['base_dir'] = repoPath;
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
            this.catalogues.push(js);
          } catch (err) {
            console.warn(`Skipping malformed catalogue repo ${owner}/${repo}: ${err}`);
            continue;
          }
        }
      } catch (err) {
        console.warn(`Skipping malformed catalogue owner ${owner}: ${err}`);
        continue;
      }
    }
  }

  async refreshCatalogues() {
    this.parseWorkflows();
    await this.parseCatalogues();
    await this.revertOrphanedWorkflows();
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
    const catRead = safeFs.readFileSync(cat_file);
    if (!catRead.ok) {
      throw new Error(`Failed to read catalogue.json from ${repo.path}: ${catRead.error.message}`);
    }
    const js = JSON.parse(catRead.data);
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
    safeFs.rmSync(cat_path, { recursive: true, force: true });
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

  async moveCatalogueWorkflowsToUser(
    catalogue_name: string,
    workflows: Array<{ section: string; name: string }>
  ): Promise<number> {
    const cat = this.catalogues.find((c) => c.name === catalogue_name);
    if (!cat) throw new Error(`Catalogue ${catalogue_name} not found.`);

    const user_cat_path = path.join(
      this.catalogues_path,
      'user_collection',
      'store',
      'catalogue.json'
    );
    let user_catalogue: Catalogue;
    if (safeFs.existsSync(user_cat_path)) {
      const readResult = safeFs.readFileSync(user_cat_path);
      if (readResult.ok) {
        try {
          user_catalogue = JSON.parse(readResult.data);
        } catch {
          user_catalogue = { name: 'User collection', source: 'local', sections: [] };
        }
      } else {
        user_catalogue = { name: 'User collection', source: 'local', sections: [] };
      }
    } else {
      user_catalogue = { name: 'User collection', source: 'local', sections: [] };
    }

    let moved = 0;
    for (const ref of workflows) {
      const srcSection = cat.sections.find((s) => s.name === ref.section);
      if (!srcSection) continue;
      const wf = srcSection.workflows.find((w) => w.name === ref.name);
      if (!wf) continue;

      let targetSection = user_catalogue.sections.find((s) => s.name === ref.section);
      if (!targetSection) {
        targetSection = { name: ref.section, workflows: [] };
        user_catalogue.sections.push(targetSection);
      }

      const alreadyExists = targetSection.workflows.some((w) => w.repo === wf.repo);
      if (!alreadyExists) {
        targetSection.workflows.push({ name: wf.name, repo: wf.repo, version: wf.version });
        moved++;
      }
    }

    if (moved > 0) {
      this.ensurePathExists(path.dirname(user_cat_path));
      safeFs.writeFileSync(user_cat_path, JSON.stringify(user_catalogue, null, 2));
      this.parseCatalogues();
    }

    return moved;
  }

  async uninstallCatalogueWorkflow(
    catalogue_name: string,
    section_name: string,
    workflow_name: string,
    workflow_version?: string
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
    const workflow_entry = section.workflows.find(
      (w) => w.name === workflow_name && (workflow_version ? w.version === workflow_version : true)
    );
    if (!workflow_entry) {
      throw new Error(
        `Workflow ${workflow_name} not found in section ${section_name} of catalogue ${catalogue_name}.`
      );
    }
    // Delete workflow repo files from disk — only the matching version(s)
    const { owner: wf_owner, repo: wf_repo } = parseRepoUrl(workflow_entry.repo);
    const wf_id = `${wf_owner}/${wf_repo}`;
    const wf = this.workflows.find((w) => w.id === wf_id);
    if (!wf) return;

    let versionsToRemove: IWorkflowVersion[];
    if (!workflow_entry.version || workflow_entry.version === 'latest') {
      versionsToRemove = wf.versions.filter((v) => v.sourceVersion === 'latest');
    } else {
      versionsToRemove = wf.versions.filter(
        (v) => v.version === workflow_entry.version && v.sourceVersion !== 'latest'
      );
    }

    // Kill any running processes for these workflow versions before removing files
    for (const version of versionsToRemove) {
      for (const inst of this.workflow_instances) {
        if (inst.workflow_version?.id === version.id && inst.processes.length > 0) {
          await this.killWorkflowInstance(inst);
        }
      }
    }

    for (const version of versionsToRemove) {
      if (safeFs.existsSync(version.path)) {
        safeFs.rmSync(version.path, { recursive: true, force: true });
      }
      const idx = wf.versions.indexOf(version);
      if (idx !== -1) wf.versions.splice(idx, 1);
    }

    // Remove workflow entirely if no versions remain
    if (wf.versions.length === 0) {
      const wf_idx = this.workflows.indexOf(wf);
      if (wf_idx !== -1) this.workflows.splice(wf_idx, 1);
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
    let availableVersion: string | null = null;
    if (workflow.version === 'latest') {
      const wf = this.workflows.find((w) => w.id === workflow.repo);
      if (wf) {
        const sortedTags = sortTagsBySemver(tags);
        const newestTag = sortedTags.length > 0 ? sortedTags[sortedTags.length - 1] : null;
        const installedVersion = wf.versions.find((v) => v.sourceVersion === 'latest');
        if (newestTag && installedVersion && installedVersion.version !== newestTag) {
          updated = true;
          availableVersion = newestTag;
        } else if (newestTag && !installedVersion) {
          updated = false;
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
    return { updated, availableVersion };
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
    const results: {
      name: string;
      repo: string;
      updated: boolean;
      error?: string;
      availableVersion?: string;
    }[] = [];
    const catRef = this.catalogues.find((c) => c.name === catalogue_name);
    if (!catRef) {
      throw new Error(`Catalogue ${catalogue_name} not found after refresh.`);
    }
    const seenRepos = new Set<string>();
    for (const section of catRef.sections || []) {
      for (const workflow of section.workflows || []) {
        if (seenRepos.has(workflow.repo)) continue;
        seenRepos.add(workflow.repo);
        if (workflow.version === 'latest') {
          const wf = this.workflows.find((w) => w.id === workflow.repo);
          if (wf) {
            const installedVersion = wf.versions.find((v) => v.sourceVersion === 'latest');
            if (installedVersion && installedVersion.path && fs.existsSync(installedVersion.path)) {
              try {
                const tags = await getRepoTags(workflow.repo);
                const sortedTags = sortTagsBySemver(tags || []);
                const newestTag = sortedTags.length > 0 ? sortedTags[sortedTags.length - 1] : null;
                if (newestTag && installedVersion.version !== newestTag) {
                  results.push({
                    name: workflow.name,
                    repo: workflow.repo,
                    updated: true,
                    availableVersion: newestTag
                  });
                } else {
                  const timeoutMs = 20000;
                  const timeout = new Promise<{ status: 'ok'; updated: false }>((resolve) =>
                    setTimeout(() => resolve({ status: 'ok', updated: false }), timeoutMs)
                  );
                  const syncResult: any = await Promise.race([
                    syncRepo(installedVersion.path),
                    timeout
                  ]);
                  if (syncResult.status === 'ok') {
                    results.push({
                      name: workflow.name,
                      repo: workflow.repo,
                      updated: syncResult.updated ?? false
                    });
                  } else {
                    results.push({
                      name: workflow.name,
                      repo: workflow.repo,
                      updated: false,
                      error: syncResult.message
                    });
                  }
                }
              } catch (err: unknown) {
                results.push({
                  name: workflow.name,
                  repo: workflow.repo,
                  updated: false,
                  error: String(err)
                });
              }
            } else {
              results.push({ name: workflow.name, repo: workflow.repo, updated: false });
            }
          } else {
            results.push({ name: workflow.name, repo: workflow.repo, updated: false });
          }
        } else {
          results.push({ name: workflow.name, repo: workflow.repo, updated: false });
        }
      }
    }
    return {
      total: results.length,
      updated: results.filter((r) => r.updated).length,
      upToDate: results.filter((r) => !r.updated && !r.error).length,
      errors: results.filter((r) => r.error).length,
      errorDetails: results.filter((r) => r.error).map((r) => `${r.name}: ${r.error}`),
      updates: results
        .filter((r) => r.updated)
        .map((r) => ({
          name: r.name,
          repo: r.repo,
          availableVersion: (r as any).availableVersion || ''
        }))
    };
  }

  async checkWorkflowUpdates(): Promise<
    Record<string, { name: string; currentVersion: string; availableVersion: string }>
  > {
    // Read-only check: fetch tags for all 'latest' workflows and compare
    // without syncing repos or writing to disk.
    const checkTargets: {
      repo: string;
      name: string;
      currentVersion: string;
    }[] = [];
    for (const cat of this.catalogues) {
      for (const section of cat.sections || []) {
        for (const wf of section.workflows || []) {
          if (wf.version === 'latest') {
            const installed = this.workflows.find((w) => w.id === wf.repo);
            if (installed) {
              const ver = installed.versions.find((v) => v.sourceVersion === 'latest');
              if (ver?.version) {
                checkTargets.push({
                  repo: wf.repo,
                  name: wf.name,
                  currentVersion: ver.version
                });
              }
            }
          }
        }
      }
    }
    const updates: Record<
      string,
      { name: string; currentVersion: string; availableVersion: string }
    > = {};
    for (const target of checkTargets) {
      try {
        const tags = await getRepoTags(target.repo);
        const sorted = sortTagsBySemver(tags || []);
        const newest = sorted.length > 0 ? sorted[sorted.length - 1] : null;
        if (newest && target.currentVersion !== newest) {
          updates[target.repo] = {
            name: target.name,
            currentVersion: target.currentVersion,
            availableVersion: newest
          };
        }
      } catch {
        // Skip errors (offline, invalid repo, etc.)
      }
    }
    return updates;
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
    if (safeFs.existsSync(user_cat_path)) {
      // Read existing catalogue
      const readResult = safeFs.readFileSync(user_cat_path);
      if (readResult.ok) {
        try {
          user_catalogue = JSON.parse(readResult.data);
        } catch {
          user_catalogue = { name: 'User collection', source: 'local', sections: [] };
        }
      } else {
        user_catalogue = { name: 'User collection', source: 'local', sections: [] };
      }
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
    safeFs.writeFileSync(user_cat_path, JSON.stringify(user_catalogue, null, 2));
    // Refresh catalogues
    this.parseCatalogues();
  }

  async getRepoTags(url: string): Promise<string[]> {
    const tags = await getRepoTags(url);
    return tags || [];
  }

  async getCatalogueParseResults() {
    const results: { source: string; success: boolean; error?: string }[] = [];
    for (const cat of this.catalogues) {
      results.push({ source: cat.source, success: true });
    }
    for (const err of this.catalogueParseErrors) {
      results.push({ source: err.source, success: false, error: err.error });
    }
    return results;
  }

  async revertOrphanedWorkflows() {
    const referencedRepos = new Set<string>();
    for (const cat of this.catalogues) {
      for (const section of cat.sections) {
        for (const wf of section.workflows) {
          referencedRepos.add(wf.repo);
        }
      }
    }

    const orphans = this.workflows.filter((wf) => !referencedRepos.has(wf.id));
    if (orphans.length === 0) return;

    let userCat = this.catalogues.find((c) => c.source === 'local');
    if (!userCat) {
      userCat = { name: 'User collection', source: 'local', sections: [] };
      this.catalogues.push(userCat);
    }

    let section = userCat.sections.find((s) => s.name === 'My Workflows');
    if (!section) {
      section = { name: 'My Workflows', workflows: [] };
      userCat.sections.push(section);
    }

    const existingRepos = new Set(section.workflows.map((w) => w.repo));
    for (const wf of orphans) {
      if (existingRepos.has(wf.id)) continue;
      section.workflows.push({ name: wf.name, repo: wf.id, version: 'latest' });
    }

    const user_cat_path = path.join(
      this.catalogues_path,
      'user_collection',
      'store',
      'catalogue.json'
    );
    this.ensurePathExists(path.dirname(user_cat_path));
    safeFs.writeFileSync(user_cat_path, JSON.stringify(userCat, null, 2));
  }

  async exportCatalogue(catalogueName: string, destPath: string): Promise<string> {
    const cat = this.catalogues.find((c) => c.name === catalogueName);
    if (!cat) throw new Error(`Catalogue ${catalogueName} not found.`);
    const { source: _source, base_dir: _base_dir, ...exportData } = cat;
    safeFs.writeFileSync(destPath, JSON.stringify(exportData, null, 2));
    return destPath;
  }

  async createCatalogueFromFile(filePath: string): Promise<string> {
    const raw = safeFs.readFileSync(filePath);
    if (!raw.ok) throw new Error(`Cannot read file: ${raw.error.message}`);
    const cat = JSON.parse(raw.data);
    if (!cat?.sections || !cat?.name)
      throw new Error('Invalid catalogue JSON: missing name or sections');
    const dest = path.join(this.catalogues_path, 'local', cat.name);
    const destFile = path.join(dest, 'catalogue.json');
    this.ensurePathExists(dest);
    safeFs.writeFileSync(destFile, JSON.stringify(cat, null, 2));
    await this.parseCatalogues();
    return cat.name;
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
      const ver = wf.versions.find((v) => v.sourceVersion === 'latest');
      if (ver) {
        return ver.version || '';
      }
      return '';
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

  async getInstalledWorkflowIds(): Promise<string[]> {
    return this.workflows.map((wf) => wf.id);
  }

  async importManifest(manifestPath: string) {
    const raw = safeFs.readFileSync(manifestPath);
    if (!raw.ok) {
      console.error(`Failed to read manifest: ${raw.error.message}`);
      return;
    }
    let manifest: any;
    try {
      manifest = JSON.parse(raw.data);
    } catch (err) {
      console.error(`Failed to parse manifest: ${err}`);
      return;
    }
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
