import Docker from 'dockerode';
import { Readable } from 'stream';
import { Repo } from '../types.js';

const isWindows = process.platform === 'win32';
const docker = new Docker({
  socketPath: isWindows ? '//./pipe/docker_engine' : '/var/run/docker.sock'
});

async function buildAndRunContainer(folderPath: string, imageName: string) {
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

async function listContainers() {
  return await docker.listContainers();
}

async function clearStoppedContainers() {
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

export { buildAndRunContainer, listContainers, clearStoppedContainers };
export const _docker = docker;

export async function runRepo({ name, path: repoPath }: Repo) {
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
