import * as os from 'os';
import * as path from 'path';
import Docker from 'dockerode';
import { Repo } from '../types.js';
import { Readable, Duplex } from 'stream';
import { promises as fs } from 'fs';

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

export async function runRepo_Nextflow(repoPath: string, name: string) {
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

export async function runRepo_Docker(repoPath: string, name: string) {
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

export async function runRepo({ name, path: repoPath }: Repo) {
  if (!repoPath || !(await fs.stat(repoPath)).isDirectory()) {
    throw new Error(`Invalid repository path: ${repoPath}`);
  }

  // Identify repository type (nextflow, docker, etc.)
  const nextflowPAth = `${repoPath}/nextflow.config`;
  const dockerfilePath = `${repoPath}/Dockerfile`;
  const nextflowExists = await fs
    .stat(nextflowPAth)
    .then(() => true)
    .catch(() => false);
  const dockerExists = await fs
    .stat(dockerfilePath)
    .then(() => true)
    .catch(() => false);

  if (nextflowExists) {
    return runRepo_Nextflow(repoPath, name);
  } else if (dockerExists) {
    return runRepo_Docker(repoPath, name);
  } else {
    throw new Error(`Unsupported repository type in ${repoPath}`);
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
