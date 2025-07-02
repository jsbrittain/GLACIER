import Docker from 'dockerode';

const isWindows = process.platform === 'win32';
const docker = new Docker({
  socketPath: isWindows ? '//./pipe/docker_engine' : '/var/run/docker.sock'
});

async function buildAndRunContainer(folderPath, imageName) {
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
