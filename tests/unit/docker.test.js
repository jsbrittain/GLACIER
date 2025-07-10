import os from 'os';
import { describe, it, expect } from 'vitest';
import * as docker from '../../src/main/docker.js';

const isDockerSupported = os.platform() === 'linux'

describe(isDockerSupported ? 'docker module' : 'docker module (skipped on non-Linux)', () => {
  if (!isDockerSupported) {
    it.skip('skipped due to unsupported platform', () => {})
    return
  }

  it('builds and starts a container from a minimal Dockerfile', async () => {
    const path = './tests/unit/fixtures/minimal-docker';
    const imageName = `test-image-${Date.now()}`;
    const id = await docker.buildAndRunContainer(path, imageName);
    expect(typeof id).toBe('string');
  });

  it('removes stopped containers', async () => {
    const container = await docker._docker.createContainer({
      Image: 'alpine',
      Cmd: ['true'], // container exits immediately
      Tty: false
    });

    await container.start();
    await container.wait(); // Wait for it to exit

    const result = await docker.clearStoppedContainers();
    expect(Array.isArray(result)).toBe(true);
    expect(result).toContain(container.id);
  });

  it('lists running containers', async () => {
    const containers = await docker.listContainers();
    expect(Array.isArray(containers)).toBe(true);
  });

  it('throws when Docker build fails', async () => {
    const badPath = './tests/unit/fixtures/broken-docker';
    const imageName = `test-bad-image-${Date.now()}`;
    await expect(docker.buildAndRunContainer(badPath, imageName)).rejects.toThrow();
  }, 60000); // 60 seconds timeout
});
