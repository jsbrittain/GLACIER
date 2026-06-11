import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Readable } from 'stream';

const mockContainer = vi.hoisted(() => ({
  start: vi.fn(() => Promise.resolve()),
  stop: vi.fn(() => Promise.resolve()),
  remove: vi.fn(() => Promise.resolve()),
  wait: vi.fn(() => Promise.resolve({ StatusCode: 0 })),
  attach: vi.fn(() =>
    Promise.resolve({ pipe: vi.fn(), destroy: vi.fn() })
  ),
  logs: vi.fn(),
  id: 'container-id-123',
}));

const mockBuildImage = vi.hoisted(() => vi.fn());
const mockListContainers = vi.hoisted(() => vi.fn());
const mockGetContainer = vi.hoisted(() => vi.fn(() => mockContainer));
const mockCreateContainer = vi.hoisted(() =>
  vi.fn(() => Promise.resolve(mockContainer))
);
const mockFollowProgress = vi.hoisted(() =>
  vi.fn((_stream, cb) => cb(null, 'success'))
);

vi.hoisted(() => {
  mockBuildImage.mockReset();
  mockListContainers.mockReset();
  mockGetContainer.mockReset();
  mockCreateContainer.mockReset();
  mockFollowProgress.mockReset();
  mockContainer.start.mockReset();
  mockContainer.stop.mockReset();
  mockContainer.remove.mockReset();
  mockContainer.wait.mockReset();
  mockContainer.attach.mockReset();
  mockContainer.logs.mockReset();
});

const mockDockerInstance = vi.hoisted(() => ({
  buildImage: mockBuildImage,
  listContainers: mockListContainers,
  getContainer: mockGetContainer,
  createContainer: mockCreateContainer,
  modem: { followProgress: mockFollowProgress },
}));

vi.mock('dockerode', () => ({
  default: vi.fn(() => mockDockerInstance),
}));

process.stdout.isTTY = false;

let docker;

describe('docker module', () => {
  beforeEach(async () => {
    mockContainer.start.mockReset();
    mockContainer.stop.mockReset();
    mockContainer.remove.mockReset();
    mockContainer.wait.mockReset();
    mockContainer.attach.mockReset();
    mockContainer.logs.mockReset();
    mockBuildImage.mockReset();
    mockListContainers.mockReset();
    mockGetContainer.mockReset();
    mockCreateContainer.mockReset();
    mockFollowProgress.mockReset();
    docker = await import('../../src/runners/docker/docker.js');
  });

  describe('buildAndRunContainer', () => {
    it('builds and starts container from folder', async () => {
      const tarStream = new Readable({ read() { this.push(null); } });
      mockBuildImage.mockResolvedValue(tarStream);
      mockContainer.start.mockResolvedValue(undefined);

      const id = await docker.buildAndRunContainer('/some/folder', 'my-image');

      expect(mockBuildImage).toHaveBeenCalledWith(
        { context: '/some/folder', src: ['Dockerfile'] },
        { t: 'my-image' }
      );
      expect(mockFollowProgress).toHaveBeenCalledWith(
        tarStream,
        expect.any(Function)
      );
      expect(mockCreateContainer).toHaveBeenCalledWith({
        Image: 'my-image',
        Cmd: ['echo', 'Container built and running'],
        Tty: true,
      });
      expect(mockContainer.start).toHaveBeenCalled();
      expect(id).toBe('container-id-123');
    });

    it('throws when buildImage fails', async () => {
      mockBuildImage.mockRejectedValue(new Error('Build failed'));

      await expect(
        docker.buildAndRunContainer('/some/folder', 'my-image')
      ).rejects.toThrow('Build failed');
    });
  });

  describe('listContainers', () => {
    it('returns list of containers', async () => {
      const containerList = [
        { Id: 'abc', State: 'running' },
        { Id: 'def', State: 'exited' },
      ];
      mockListContainers.mockResolvedValue(containerList);

      const result = await docker.listContainers();

      expect(result).toEqual(containerList);
    });

    it('rejects when Docker API fails', async () => {
      mockListContainers.mockRejectedValue(new Error('Docker not running'));

      await expect(docker.listContainers()).rejects.toThrow(
        'Docker not running'
      );
    });
  });

  describe('clearStoppedContainers', () => {
    it('removes stopped containers and returns their IDs', async () => {
      const mockRm = vi.fn(() => Promise.resolve());
      const stoppedContainer = {
        Id: 'stopped-1',
        State: 'exited',
      };
      mockGetContainer.mockReturnValue({
        ...mockContainer,
        remove: mockRm,
      });
      mockListContainers.mockResolvedValue([
        { Id: 'running-1', State: 'running' },
        stoppedContainer,
      ]);

      const result = await docker.clearStoppedContainers();

      expect(mockListContainers).toHaveBeenCalledWith({ all: true });
      expect(mockGetContainer).toHaveBeenCalledWith('stopped-1');
      expect(mockRm).toHaveBeenCalled();
      expect(result).toEqual(['stopped-1']);
    });

    it('returns empty array when no containers exist', async () => {
      mockListContainers.mockResolvedValue([]);

      const result = await docker.clearStoppedContainers();

      expect(result).toEqual([]);
    });

    it('propagates error from container removal', async () => {
      mockGetContainer.mockReturnValue({
        ...mockContainer,
        remove: vi.fn(() =>
          Promise.reject(new Error('Permission denied'))
        ),
      });
      mockListContainers.mockResolvedValue([
        { Id: 'bad-container', State: 'exited' },
      ]);

      await expect(docker.clearStoppedContainers()).rejects.toThrow(
        'Permission denied'
      );
    });
  });

  describe('runRepo_Docker', () => {
    it('builds image, creates container, returns its ID', async () => {
      const tarStream = new Readable({ read() { this.push(null); } });
      mockBuildImage.mockResolvedValue(tarStream);
      mockContainer.start.mockResolvedValue(undefined);

      const id = await docker.runRepo_Docker('/repo/path', 'my/repo', {});

      expect(mockBuildImage).toHaveBeenCalledWith(
        { context: '/repo/path', src: ['Dockerfile'] },
        { t: 'my-repo' }
      );
      expect(mockFollowProgress).toHaveBeenCalledWith(
        tarStream,
        expect.any(Function)
      );
      expect(mockCreateContainer).toHaveBeenCalledWith({
        Image: 'my-repo',
        Cmd: ['echo', 'Running my/repo'],
        Tty: true,
      });
      expect(mockContainer.start).toHaveBeenCalled();
      expect(id).toBe('container-id-123');
    });

    it('throws when build fails', async () => {
      mockBuildImage.mockRejectedValue(new Error('Build failed'));

      await expect(
        docker.runRepo_Docker('/repo/path', 'my/repo', {})
      ).rejects.toThrow('Build failed');
    });
  });

  describe('getContainerLogs', () => {
    it('returns concatenated log output', async () => {
      const logStream = Readable.from(['line1\n', 'line2\n']);
      mockContainer.logs.mockResolvedValue(logStream);

      const logs = await docker.getContainerLogs('some-id');

      expect(mockGetContainer).toHaveBeenCalledWith('some-id');
      expect(mockContainer.logs).toHaveBeenCalledWith({
        follow: false,
        stdout: true,
        stderr: true,
        timestamps: false,
      });
      expect(logs).toBe('line1\nline2\n');
    });

    it('returns empty string when no log data', async () => {
      const emptyStream = new Readable({
        read() {
          this.push(null);
        },
      });
      mockContainer.logs.mockResolvedValue(emptyStream);

      const logs = await docker.getContainerLogs('some-id');

      expect(logs).toBe('');
    });

    it('rejects when log stream errors', async () => {
      const errorStream = new Readable({ read() {} });
      mockContainer.logs.mockResolvedValue(errorStream);

      const promise = docker.getContainerLogs('some-id');
      setTimeout(() => errorStream.destroy(new Error('Stream error')), 5);
      await expect(promise).rejects.toThrow('Stream error');
    });
  });

  describe('stopContainer', () => {
    it('stops a running container', async () => {
      mockContainer.stop.mockResolvedValue(undefined);

      await docker.stopContainer('some-id');

      expect(mockGetContainer).toHaveBeenCalledWith('some-id');
      expect(mockContainer.stop).toHaveBeenCalled();
    });

    it('handles already stopped container (status 304)', async () => {
      const err = new Error('already stopped');
      err.statusCode = 304;
      mockContainer.stop.mockRejectedValue(err);

      await expect(docker.stopContainer('some-id')).resolves.toBeUndefined();
    });

    it('propagates non-304 errors', async () => {
      const err = new Error('Docker daemon unreachable');
      mockContainer.stop.mockRejectedValue(err);

      await expect(docker.stopContainer('some-id')).rejects.toThrow(
        'Docker daemon unreachable'
      );
    });
  });
});
