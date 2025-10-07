import * as os from 'os';
import * as path from 'path';
import * as fs_sync from 'fs';
import Docker from 'dockerode';
import { IRepo } from './types';
import { spawn } from 'child_process';
import { Readable, Duplex } from 'stream';
import { promises as fs } from 'fs';
import { IWorkflowInstance, IWorkflowParams } from './collection.js';

type paramsT = { [key: string]: any };

const isWindows = process.platform === 'win32';
export const docker = new Docker();

export async function buildAndRunContainer(folderPath: string, imageName: string) {
  const tarStream = await docker.buildImage(
    { context: folderPath, src: ['Dockerfile'] },
    { t: imageName }
  );
  await new Promise((resolve, reject) => {
    docker.modem.followProgress(tarStream, (err, res) => (err ? reject(err) : resolve(res)));
  });
  const container = await docker.createContainer({
    Image: imageName,
    Cmd: ['echo', 'Container built and running'],
    Tty: true
  });
  await container.start();
  return container.id;
}

export async function listContainers() {
  return await docker.listContainers();
}

export async function clearStoppedContainers() {
  const containers = await docker.listContainers({ all: true });
  const stopped = containers.filter((c) => c.State !== 'running');
  const results = [];
  for (const info of stopped) {
    const container = docker.getContainer(info.Id);
    await container.remove();
    results.push(info.Id);
  }
  return results;
}

function toDockerPath(p: string) {
  if (os.platform() === 'win32') {
    const resolved = path.resolve(p);
    return '/' + resolved.replace(/\\/g, '/').replace(/^([A-Za-z]):/, (_, d) => d.toLowerCase());
  }
  return path.resolve(p);
}

export async function runRepo_NextflowDocker(repoPath: string, name: string, params: paramsT) {
  const dockerPath = toDockerPath(repoPath);
  const platform = 'linux/amd64';

  console.log(`Building Docker image "nextflow-conda"...`);
  await new Promise((resolve, reject) => {
    docker.buildImage(
      {
        context: repoPath,
        src: ['Dockerfile']
      },
      { t: 'nextflow-conda', platform: platform },
      (err, output) => {
        if (err) return reject(err);
        if (!output) return reject(new Error('No output from Docker build'));
        output.pipe(process.stdout);
        output.on('end', resolve);
      }
    );
  });

  const binds = [
    '/tmp:/tmp',
    `${dockerPath}:${dockerPath}`,
    '/var/run/docker.sock:/var/run/docker.sock'
  ];

  console.log(`Running Nextflow in container from: ${dockerPath}`);

  const container = await docker.createContainer({
    Image: 'nextflow-conda',
    Tty: true,
    OpenStdin: true,
    AttachStdout: true,
    AttachStderr: true,
    HostConfig: {
      Binds: binds
    },
    WorkingDir: dockerPath,
    Cmd: ['nextflow', 'run', 'main.nf'],
    platform: platform
  });

  const stream = await container.attach({
    stream: true,
    stdout: true,
    stderr: true,
    stdin: true
  });

  stream.pipe(process.stdout);

  await container.start();

  // Handle SIGINT (Ctrl+C)
  process.on('SIGINT', async () => {
    console.log('\nInterrupted — stopping container...');
    try {
      await container.stop({ t: 5 });
      await container.remove();
    } catch (e) {
      if (e instanceof Error) {
        console.error('Failed to stop/remove container:', e.message);
      } else {
        console.error('Failed to stop/remove container:', e);
      }
    }
    process.exit(1);
  });

  const result = await container.wait();

  (stream as Duplex).destroy();

  console.log('Nextflow run complete');

  await container.start();
  return container.id;
}

interface IRunWorkflowOpts {
  resume?: boolean;
}

export async function runWorkflowNextflow(
  instance: IWorkflowInstance,
  params: paramsT,
  {
    resume = false,
  }: IRunWorkflowOpts = {}
) {
  // Launch nextflow natively on host system
  const name = instance.name;
  const instancePath = instance.path;
  const workPath = path.resolve(instancePath, 'work');
  await fs.mkdir(workPath, { recursive: true });
  const projectPath = instance.workflow_version?.path || instancePath;

  // Save parameters to a file in the instance folder
  const paramsFile = path.resolve(instancePath, 'params.json');
  fs.writeFile(paramsFile, JSON.stringify(params, null, 2), 'utf8');

  // Clear logs and set to append
  if (!fs_sync.existsSync(instancePath)) {
    fs_sync.mkdirSync(instancePath, { recursive: true });
  }
  if (!fs_sync.existsSync(path.resolve(instancePath, 'stdout.log'))) {
    fs_sync.writeFileSync(path.resolve(instancePath, 'stdout.log'), '');
  }
  fs_sync.truncateSync(path.resolve(instancePath, 'stdout.log'), 0);
  const stdout = fs_sync.openSync(path.resolve(instancePath, 'stdout.log'), 'a');
  if (!fs_sync.existsSync(path.resolve(instancePath, 'stderr.log'))) {
    fs_sync.writeFileSync(path.resolve(instancePath, 'stderr.log'), '');
  }
  fs_sync.truncateSync(path.resolve(instancePath, 'stderr.log'), 0);
  const stderr = fs_sync.openSync(path.resolve(instancePath, 'stderr.log'), 'a');

  const weblog_server = 'http://localhost:3000';
  const cmd = [
    'run',
    path.resolve(projectPath, 'main.nf'),
    '-work-dir',
    workPath,
    '-params-file',
    paramsFile,
    '-with-weblog',
    weblog_server,
    '-with-trace'
  ];

  console.log(`Spawning nextflow with command: nextflow ${cmd.join(' ')} from ${instancePath}`);
  const p = spawn('nextflow', cmd, {
    cwd: instancePath,
    stdio: ['ignore', stdout, stderr], // stdin ignored
    detached: true
  });

  p.unref(); // allow the parent to exit independently

  return p.pid;

  // let output = '';
  // p.stdout.on('data', (data: any) => {
  //   output += data.toString();
  //   process.stdout.write(data);
  // });

  // p.stderr.on('data', (data: any) => {
  //   output += data.toString();
  //   process.stderr.write(data);
  // });

  // p.on('close', (code) => {
  //   console.log(`Nextflow process exited with code ${code}`);
  // });
}

export async function runRepo_Docker(repoPath: string, name: string, params: paramsT) {
  const imageName = name.replace('/', '-');

  const tarStream = await docker.buildImage(
    { context: repoPath, src: ['Dockerfile'] },
    { t: imageName }
  );

  await new Promise((resolve, reject) => {
    docker.modem.followProgress(tarStream, (err, res) => (err ? reject(err) : resolve(res)));
  });

  const container = await docker.createContainer({
    Image: imageName,
    Cmd: ['echo', 'Running ' + name],
    Tty: true
  });

  await container.start();
  return container.id;
}

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

export async function getContainerLogs(containerId: string) {
  const container = docker.getContainer(containerId);
  const logStream = (await container.logs({
    follow: false,
    stdout: true,
    stderr: true,
    timestamps: false
  })) as unknown as Readable;

  return new Promise((resolve, reject) => {
    let logs = '';
    logStream.on('data', (chunk: Buffer) => {
      logs += chunk.toString();
    });
    logStream.on('end', () => resolve(logs));
    logStream.on('error', reject);
  });
}

export async function stopContainer(containerId: string) {
  const container = docker.getContainer(containerId);
  try {
    await container.stop();
  } catch (err) {
    if ((err as any).statusCode === 304) {
      // container already stopped
      return;
    }
    throw err;
  }
}
