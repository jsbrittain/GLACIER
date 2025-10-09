import * as os from 'os';
import * as path from 'path';
import * as fs_sync from 'fs';
import { IRepo } from './types';
import { spawn } from 'child_process';
import { Readable, Duplex } from 'stream';
import { promises as fs } from 'fs';
import { IWorkflowInstance, IWorkflowParams } from './collection.js';
import {
  IRunWorkflowOpts,
  runWorkflow as runWorkflowNextflow
} from '../runners/nextflow/nextflow.js';
import { runRepo_Docker } from '../runners/docker/docker.js';

interface IRunWorkflowArgs {
  instance: IWorkflowInstance;
  params: IWorkflowParams;
  opts?: IRunWorkflowOpts;
}

export async function runWorkflow({ instance, params, opts }: IRunWorkflowArgs) {
  const projectPath = instance.workflow_version.path;

  if (!projectPath || !(await fs.stat(projectPath)).isDirectory()) {
    throw new Error(`Invalid repository path: ${projectPath}`);
  }

  // Identify repository type (nextflow, docker, etc.)
  const nextflowPAth = `${projectPath}/nextflow_schema.json`;
  const dockerfilePath = `${projectPath}/Dockerfile`;
  const nextflowExists = await fs
    .stat(nextflowPAth)
    .then(() => true)
    .catch(() => false);
  const dockerExists = await fs
    .stat(dockerfilePath)
    .then(() => true)
    .catch(() => false);

  if (nextflowExists) {
    return runWorkflowNextflow(instance, params, opts);
  } else if (dockerExists) {
    return runRepo_Docker(projectPath, instance.name, params || {});
  } else {
    throw new Error(`Unsupported repository type in ${projectPath}`);
  }
}
