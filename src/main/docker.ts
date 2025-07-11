import Docker from 'dockerode';
import { Readable } from 'stream';
import { Repo } from '../types.js';
import { promises as fs } from 'fs';

const isWindows = process.platform === 'win32';
const docker = new Docker({
  socketPath: isWindows ? '//./pipe/docker_engine' : '/var/run/docker.sock'
});

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

export const _docker = docker;

export async function runRepo_Nextflow(repoPath: string, name: string) {
  /* Run nextflow using Dockerfile */

  const imageName = name.replace('/', '-');
  const platform = 'linux/amd64';

  const tarStream = await docker.buildImage(
    { context: repoPath, src: ['Dockerfile'] },
    { t: imageName, platform: platform }
  );

  await new Promise((resolve, reject) => {
    docker.modem.followProgress(tarStream, (err, res) => (err ? reject(err) : resolve(res)));
  });

  const container = await docker.createContainer({
    Image: imageName,
    Tty: true,
    Volumes: {
      '/var/run/docker.sock': {},
      repoPath: {},
      '/tmp': {}
    },
    WorkingDir: repoPath
  });

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
