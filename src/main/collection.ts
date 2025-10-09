// Main Collection store for workflows and instances

import pkg from 'electron';
const { shell } = pkg;
import path from 'path';
import fs from 'fs';
import { IRepo } from './types.js';
import { generateUniqueName } from './repo.js';
import { cloneRepo, ICloneRepo } from './repo.js';
import { runWorkflow } from './runner.js';
import { syncRepo, getWorkflowParams, getWorkflowSchema } from './repo.js';
import { getCollectionsPath, getDefaultCollectionsDir } from './paths.js';
import store from './store.js';

// Should remove imports from specific runners
import { getAvailableProfiles as getAvailableProfiles_Nextflow } from '../runners/nextflow/nextflow.js';
import { parseNextflowLog } from '../runners/nextflow/nf-parse.js';
//

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
  parent?: IWorkflow; // reference to parent workflow
}

class WorkflowVersion implements IWorkflowVersion {
  id: string;
  name: string;
  type: IWorkflowType;
  version: string | undefined;
  path: string;
  parent?: IWorkflow; // reference to parent workflow

  constructor({ id, name, type, version, path, parent }: IWorkflowVersion) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.version = version;
    this.path = path;
    this.parent = parent;
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

  project: IProject | null = null; // reference to project if applicable

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
}

class WorkflowInstance implements IWorkflowInstance {
  id: string;
  name: string;
  workflow_version: WorkflowVersion;
  path: string;
  params?: IWorkflowParams;

  pid: number[] = [];

  constructor({ id, name, workflow_version, path, params = {} }: IWorkflowInstance) {
    this.id = id;
    this.name = name;
    this.workflow_version = workflow_version;
    this.path = path;
    this.params = params;
  }

  attachPID(pid: number) {
    this.pid.push(pid);
  }

  async getProgress(): Promise<Record<string, any>> {
    // Read .nextflow.log and parse
    const logFile = path.join(this.path, '.nextflow.log');
    if (fs.existsSync(logFile)) {
      return await parseNextflowLog(logFile);
    } else {
      return { status: 'No log file found' };
    }
  }
}

// A project is a collection of workflows, mainly used for branding
export interface IProject {
  id: string;
  name: string;
  workflows: IWorkflow[];
}

class Project implements IProject {
  id: string;
  name: string;
  workflows: IWorkflow[];

  constructor({ id, name, workflows = [] }: IProject) {
    this.id = id;
    this.name = name;
    this.workflows = workflows;
  }
}

// Singleton class
export class Collection {
  // --- Class management --------------------------------------------------------------
  // Ensure a singleton instance that can be referenced from anywhere

  private static singleton: Collection; // single instance of class

  // private constructor to prevent direct instantiation
  private constructor() {
    this.root_path = getCollectionsPath();
    this.parseCollection();
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

  projects: Project[] = [];
  workflows: Workflow[] = [];
  workflow_instances: WorkflowInstance[] = [];

  // --- Convenience setters/getters ---------------------------------------------------

  get workflow_path(): string {
    return path.join(this.root_path, 'workflows');
  }

  get instances_path(): string {
    return path.join(this.root_path, 'instances');
  }

  // --- Logic -------------------------------------------------------------------------

  parseCollection() {
    this.parseWorkflows();
    this.parseInstances();
  }

  private parseWorkflows() {
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
          parent: wf
        } as WorkflowVersion);
      }
    }
  }

  private parseInstances() {
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
        // Find the corresponding workflow version
        const wf = this.workflows.find((wf) => wf.id === `${owner}/${repo}`);
        if (wf === undefined) continue;
        const wf_version = wf.versions.find((v) => v.version === version);
        if (wf_version === undefined) continue;
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
  }

  ensurePathExists(folder: string) {
    if (!this.root_path || !folder) {
      throw new Error('Root path or workflow path is not set.');
    }
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }
  }

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

  createWorkflowInstance(workflow_id: string): IWorkflowInstance {
    const workflow = this.workflows.find((wf) => wf.id === workflow_id);
    if (!workflow) {
      throw new Error(`Workflow ${workflow_id} not found.`);
    }
    if (!workflow.versions || workflow.versions.length === 0) {
      throw new Error(`Workflow ${workflow_id} has no versions.`);
    }
    const workflow_version = workflow.versions[0]; // First listed version as default
    const owner = workflow.owner;
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
    return instance;
  }

  listWorkflowInstances(): IWorkflowInstance[] {
    return this.workflow_instances;
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
    const filename = path.join(local_instance.path, 'params.json');
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
    const workflow_progress = progress.workflow;
    // get status of last item
    if (!workflow_progress || workflow_progress.length === 0) {
      return 'running';
    } else {
      const last = workflow_progress[workflow_progress.length - 1];
      if (last.status) {
        return last.status;
      }
    }
    return 'unknown';
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
      } catch (e) {
        // Fallback: try the single process
        try {
          process.kill(pid, sig);
          return true;
        } catch (_) {
          return false;
        }
      }
    }
  };

  async cancelWorkflowInstance(instance: IWorkflowInstance): Promise<void> {
    // Find instance
    console.log(`Cancelling instance ${instance.id}`);
    const local_instance = this.workflow_instances.find((inst) => inst.id === instance.id);
    if (!local_instance) {
      throw new Error(`Instance ${instance.id} not found in collection.`);
    }
    if (local_instance.pid.length === 0) {
      throw new Error(`Instance ${instance.id} has no running process.`);
    }
    for (const pid of local_instance.pid) {
      try {
        const success = this.killPID(pid, 'graceful');
        if (!success) {
          console.error(`Failed to stop process ${pid} for instance ${instance.id}`);
        }
      } catch (err) {
        console.error(`Failed to stop process ${pid} for instance ${instance.id}: ${err}`);
      }
    }
    local_instance.pid = [];
  }

  async killWorkflowInstance(instance: IWorkflowInstance): Promise<void> {
    // Find instance
    console.log(`Cancelling instance ${instance.id}`);
    const local_instance = this.workflow_instances.find((inst) => inst.id === instance.id);
    if (!local_instance) {
      throw new Error(`Instance ${instance.id} not found in collection.`);
    }
    if (local_instance.pid.length === 0) {
      throw new Error(`Instance ${instance.id} has no running process.`);
    }
    for (const pid of local_instance.pid) {
      try {
        const success = this.killPID(pid, 'kill');
        if (!success) {
          console.error(`Failed to kill process ${pid} for instance ${instance.id}`);
        }
      } catch (err) {
        console.error(`Failed to kill process ${pid} for instance ${instance.id}: ${err}`);
      }
    }
    local_instance.pid = [];
  }

  openResultsFolder(instance: IWorkflowInstance) {
    const local_instance = this.workflow_instances.find((inst) => inst.id === instance.id);
    if (!local_instance) {
      throw new Error(`Instance ${instance.id} not found in collection.`);
    }
    const folderPath = local_instance.path;
    if (fs.existsSync(folderPath)) {
      shell.openPath(folderPath);
    } else {
      throw new Error(`Results folder ${folderPath} does not exist.`);
    }
  }

  openWorkFolder(instance: IWorkflowInstance, word_id: string) {
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
    shell.openPath(folderPath);
  }

  getWorkLog(instance: IWorkflowInstance, workID: string, log_type: string): string {
    const log_filenames = {
      stdout: '.command.out'
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
    return await getAvailableProfiles_Nextflow(local_instance);
  }

  async cloneRepo(url: string): Promise<IWorkflowVersion> {
    const branch = null;
    const tag = null;
    const repo: ICloneRepo = await cloneRepo(url, this.workflow_path, branch, tag);
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
    }
    // Check if version already exists
    let version = wf.versions.find((v) => v.version === repo.version);
    if (version !== undefined) {
      throw new Error(`Workflow ${wf_id}@{repo.version} already exists.`);
    }
    version = new WorkflowVersion({
      id: `${wf_id}@${repo.version}`,
      name: repo.version,
      type: this.determineWorkflowType(repo.path),
      version: repo.version,
      path: repo.path,
      parent: wf
    });
    wf.versions.push(version);
    this.workflows.push(wf);
    return version;
  }

  setCollectionsPath(path: string) {
    this.root_path = path;
    store.set('collectionsPath', path);
  }

  getWorkflowsList(): IRepo[] {
    return this.workflows.map((wf) => ({
      id: wf.id,
      name: wf.name,
      path: wf.versions[0].path, // assume first version for now
      url: wf.url
    })) as IRepo[];
  }

  async runWorkflow(instance: IWorkflowInstance, params: IWorkflowParams = {}, opts = {}) {
    const local_instance = this.workflow_instances.find((inst) => inst.id === instance.id);
    if (!local_instance) {
      throw new Error(`Instance ${instance.id} not found in collection.`);
    }
    const pid = await runWorkflow({
      instance: instance,
      params: params,
      opts: opts
    });
    if (!pid) {
      throw new Error('Failed to start workflow.');
    }
    local_instance.attachPID(pid as number);
    this.recordRunWorkflow(instance);
    return pid;
  }

  recordRunWorkflow(instance: IWorkflowInstance, status = 'running') {
    // Save metadata to DB
    const local_instance = this.workflow_instances.find((inst) => inst.id === instance.id);
    if (!local_instance) {
      throw new Error(`Instance ${instance.id} not found in collection.`);
    }
    // Read database from glacier root
    const db_path = path.join(this.root_path, 'db.json');
    let db: any = { runs: [] };
    if (fs.existsSync(db_path)) {
      db = JSON.parse(fs.readFileSync(db_path, 'utf-8'));
    }
    // Find existing run
    const existing_run = db.runs.find((r: any) => r.id === local_instance.id);
    if (existing_run) {
      // Append new run
      existing_run.runs.push({
        datetime: new Date().toISOString(),
        pids: local_instance.pid,
        status: status
      });
    } else {
      // Create instance
      db.runs.push({
        id: local_instance.id,
        name: local_instance.name,
        workflow: local_instance.workflow_version.id,
        runs: [
          {
            datetime: new Date().toISOString(),
            pids: local_instance.pid,
            status: status
          }
        ]
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

  getWorkflowSchema(repoPath: string) {
    return getWorkflowSchema(repoPath);
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
}
