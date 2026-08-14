import fs from 'fs';
import os from 'os';
import path from 'path';
import * as tar from 'tar';
import { spawn } from 'child_process';
import crypto from 'crypto';
import slash from 'slash';
import { ShardStatus, ShardStatusValue, shardStatusMessage } from '../types/shard.js';
import { parseRepoUrl } from './repo.js';
import { settings } from './settings.js';

const is_windows = process.platform === 'win32';

const toPosixPath = (base: string) => {
  return slash(base.replace(/^([A-Za-z]):\\/, (_, drive) => `/mnt/${drive.toLowerCase()}/`));
};

// Read the origin remote URL from a git repository's .git/config. Returns
// undefined when the repo has no .git, no origin remote, or the config is
// unreadable. Never throws — this is best-effort metadata for update checks.
const readGitRemote = (repoPath: string): string | undefined => {
  const configPath = path.join(repoPath, '.git', 'config');
  if (!fs.existsSync(configPath)) return undefined;
  let section = '';
  try {
    for (const line of fs.readFileSync(configPath, 'utf8').split('\n')) {
      const trimmed = line.trim();
      const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
      if (sectionMatch) {
        const remoteMatch = sectionMatch[1].match(/^remote\s+"([^"]+)"$/);
        section = remoteMatch ? remoteMatch[1] : '';
        continue;
      }
      if (section === 'origin' && trimmed.startsWith('url')) {
        const eq = trimmed.indexOf('=');
        if (eq !== -1) {
          const value = trimmed.slice(eq + 1).trim();
          if (value) return value;
        }
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
};

// Normalize a remote reference to short-form owner/repo (accepting GitHub
// https URLs, git@github.com SSH URLs, or short form). Returns undefined for
// anything invalid or non-GitHub.
const normalizeRemote = (remote: string | undefined): string | undefined => {
  if (!remote) return undefined;
  let r = remote.trim();
  if (r.startsWith('git@')) {
    r = r.replace(/^git@([^:]+):(.*)$/, (_, host, path) => `https://${host}/${path}`);
  }
  try {
    const { owner, repo } = parseRepoUrl(r);
    return `${owner}/${repo}`;
  } catch {
    return undefined;
  }
};

export const queryShardStatus = async (shardId: string) => {
  const shard = shardRepository[shardId];
  let status = shard?.shardStatus;
  if (!shard) {
    status = ShardStatus.Unknown;
  }
  return {
    status: status,
    message: shardStatusMessage[status],
    logs: shard?.log?.logs || [],
    totalStages: shard?.totalStages || 0,
    currentStage: shard?.currentStage || 0,
    stageProgress: shard?.stageProgress || 0,
    stageItemsTotal: shard?.stageItemsTotal || 0,
    stageItemsCompleted: shard?.stageItemsCompleted || 0
  };
};

const shardRepository: Record<string, ImportShard> = {};

export const importShard = async (filePath: string, glacierPath: string, documentsPath: string) => {
  // New shard instance
  const shard = new ImportShard();
  shardRepository[shard.shardId] = shard;
  void shard.importShard(filePath, glacierPath, documentsPath);
  return shard.shardId;
};

interface PlatformInfo {
  path: string;
  sha256: string;
}

interface ContainerInfo {
  image: string;
  platforms: Record<string, PlatformInfo>;
}

class Logger {
  logs: Record<string, string>[] = [];

  async logMessage(level: string, message: string) {
    this.logs.push({
      timestamp: new Date().toISOString(),
      level: level,
      message: message
    });
  }

  async info(message: string) {
    console.log(message);
    await this.logMessage('info', message);
  }

  async warning(message: string) {
    console.warn(message);
    await this.logMessage('warning', message);
  }

  async error(message: string) {
    console.error(message);
    await this.logMessage('error', message);
  }

  async success(message: string) {
    console.log(message);
    await this.logMessage('success', message);
  }
}

class ImportShard {
  shardId: string;
  shardStatus: ShardStatusValue = ShardStatus.None;
  shardPath: string = '';
  manifest: any;
  log: Logger = new Logger();
  imported_workflows: Array<{ name: string; repo: string; version: string; url?: string }> = [];

  totalStages: number = 5;
  currentStage: number = 0;
  stageProgress: number = 0;
  stageItemsTotal: number = 0;
  stageItemsCompleted: number = 0;

  constructor() {
    this.shardId = `shard-${Date.now()}`;
  }

  private setStage(stage: number, status: ShardStatusValue, itemsTotal: number = 0) {
    this.currentStage = stage;
    this.shardStatus = status;
    this.stageProgress = 0;
    this.stageItemsTotal = itemsTotal;
    this.stageItemsCompleted = 0;
  }

  private advanceItem() {
    this.stageItemsCompleted++;
    if (this.stageItemsTotal > 0) {
      this.stageProgress = Math.round((this.stageItemsCompleted / this.stageItemsTotal) * 100);
    }
  }

  async importShard(filePath: string, glacierPath: string, documentsPath?: string) {
    this.shardStatus = ShardStatus.Pending;
    console.log(`Importing shard from file ${filePath}`);

    // Create temporary staging area
    const stagingPath = await this.createStagingArea();

    try {
      // Decompress filePath (.shard, which is actually a .tar.gz) into staging area
      this.setStage(1, ShardStatus.ExtractingShard);
      this.shardPath = await this.extractTar(filePath, stagingPath);

      // Read manifest
      await this.readManifest();

      // Extract workflow files and move to GLACIER catalogue
      this.setStage(2, ShardStatus.ImportingWorkflows);
      const workflowPath = path.join(glacierPath, 'workflows');
      await this.extractWorkflows(workflowPath);

      // Install containers
      this.setStage(3, ShardStatus.InstallingContainers);
      const containersPath = path.join(glacierPath, 'containers');
      await this.installContainers(containersPath);

      // Import assets / data
      this.setStage(4, ShardStatus.ImportingAssets);
      const assetsPath = path.join(documentsPath || glacierPath, 'data');
      await this.importAssets(assetsPath);

      // Add catalogue entry
      this.setStage(5, ShardStatus.UpdatingCatalogue);
      const cataloguePath = path.join(glacierPath, 'catalogues');
      await this.addCatalogueEntry(cataloguePath);

      // Finished
      this.shardStatus = ShardStatus.Completed;
      this.currentStage = this.totalStages + 1;
      this.stageProgress = 100;
      this.stageItemsCompleted = 1;
      this.stageItemsTotal = 1;
      this.log.success(`Shard import completed successfully`);
    } catch (err) {
      this.shardStatus = ShardStatus.Error;
      this.log.error(`Shard import failed: ${err}`);
    } finally {
      // Clean-up staging area
      this.cleanupStagingArea(stagingPath);
    }
  }

  async readManifest() {
    // Read manifest.json
    const manifestPath = path.join(this.shardPath, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      this.log.warning(`No manifest.json found in shard directory ${this.shardPath}`);
      return;
    }
    this.manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  }

  async createStagingArea() {
    // Create temporary staging area
    const stagingPath = fs.mkdtempSync(path.join(os.tmpdir(), 'shard-staging-'));
    console.log(`Created staging directory at ${stagingPath}`);
    return stagingPath;
  }

  async reportContents(dir: string) {
    const contents = fs.readdirSync(dir);
    console.log(`Contents of ${dir}: ${contents.join(', ')}`);
    for (const item of contents) {
      const itemPath = path.join(dir, item);
      if (fs.statSync(itemPath).isDirectory()) {
        await this.reportContents(itemPath);
      }
    }
  }

  cleanupStagingArea(stagingPath: string) {
    // Remove staging area and all contents
    fs.rmSync(stagingPath, { recursive: true, force: true });
    console.log(`Cleaned up staging directory at ${stagingPath}`);
  }

  async extractTar(tarPath: string, destPath: string) {
    fs.mkdirSync(destPath, { recursive: true });
    const { size: totalBytes } = fs.statSync(tarPath);
    let bytesRead = 0;

    try {
      await new Promise<void>((resolve, reject) => {
        const readStream = fs.createReadStream(tarPath);
        const extractor = tar.extract({ cwd: destPath });

        readStream.on('data', (chunk) => {
          bytesRead += chunk.length;
          this.stageProgress = Math.round((bytesRead / totalBytes) * 100);
        });

        readStream.on('error', reject);
        extractor.on('error', reject);
        extractor.on('finish', resolve);

        readStream.pipe(extractor);
      });
    } catch (err) {
      console.error(`Error extracting tarball ${tarPath}: ${err}`);
      this.shardStatus = ShardStatus.Error;
      throw err;
    }
    // Check for top-level folder and return
    const topLevelFiles = fs.readdirSync(destPath).filter((file) => !file.startsWith('.'));
    let decompressPath = destPath;
    if (
      topLevelFiles.length === 1 &&
      fs.statSync(path.join(destPath, topLevelFiles[0])).isDirectory()
    ) {
      decompressPath = path.join(destPath, topLevelFiles[0]);
    }
    console.log(`Extracted ${tarPath} to ${decompressPath}`);
    return decompressPath;
  }

  async extractWorkflows(workflowPath: string) {
    // Traverse workflows folder for .bundle or .tar or .tar.gz files
    console.log(`Extracting workflows from shard directory ${this.shardPath}`);
    const shardWorkflowPath = path.join(this.shardPath, 'workflow');
    if (!fs.existsSync(shardWorkflowPath)) {
      console.info('No workflow directory found');
      return;
    }
    const workflowFiles = fs.readdirSync(shardWorkflowPath).filter((file) => !file.startsWith('.'));
    console.log(`Found workflow files: ${workflowFiles.join(', ')}`);
    this.log.info(`Extracting ${workflowFiles.length} workflows from shard`);
    this.stageItemsTotal = workflowFiles.length;
    for (const file of workflowFiles) {
      this.stageProgress = Math.round((this.stageItemsCompleted / this.stageItemsTotal) * 100);
      const ext = path.extname(file);
      if (ext === '.bundle') {
        // git bundle
        throw new Error('Git bundle workflow importing not implemented');
      } else if (ext === '.tar' || path.extname(path.basename(file, '.gz')) === '.tar') {
        // tarball --- decompress to sub-folder
        const basename =
          path.basename(file, '.tar.gz') === file
            ? path.basename(path.basename(file, '.gz'), '.tar')
            : path.basename(file, '.tar.gz');
        const srcFolder = path.join(workflowPath, 'local', basename);
        console.log(`Decompressing tarball ${file} to ${srcFolder}`);
        let target_folder = await this.extractTar(
          path.join(this.shardPath, 'workflow', file),
          srcFolder
        );
        if (path.basename(target_folder) !== basename) {
          // Move target folder up a level
          const new_target_folder = path.join(workflowPath, 'local', `${basename}@main`);
          if (fs.existsSync(new_target_folder)) {
            this.log.warning(`Target folder ${new_target_folder} already exists, overwriting`);
            fs.rmSync(new_target_folder, { recursive: true, force: true });
          }
          fs.cpSync(target_folder, new_target_folder, {
            recursive: true,
            force: true
          });
          fs.rmSync(target_folder, { recursive: true, force: true });
          target_folder = new_target_folder;
        } else {
          // Add tag to folder name
          const new_target_folder = `${target_folder}@main`;
          if (fs.existsSync(new_target_folder)) {
            this.log.warning(`Target folder ${new_target_folder} already exists, overwriting`);
            fs.rmSync(new_target_folder, { recursive: true, force: true });
          }
          fs.renameSync(target_folder, new_target_folder);
          target_folder = new_target_folder;
        }
        const extracted_name = path.basename(target_folder.slice(0, -5)); // remove tag
        // Determine the source remote so the imported workflow can be checked
        // for updates online even though it was installed offline. An explicit
        // manifest entry overrides the origin recorded in the bundled repo's
        // .git/config (which the shard generator already embeds).
        const manifest_workflows = Array.isArray(this.manifest?.workflows)
          ? this.manifest.workflows
          : [];
        const manifest_remote = manifest_workflows.find(
          (w: { name: string }) => w.name === extracted_name
        )?.repo;
        const url =
          normalizeRemote(manifest_remote) ?? normalizeRemote(readGitRemote(target_folder));
        // add workflow to catalogue-import list
        this.imported_workflows.push({
          name: extracted_name,
          repo: `local/${extracted_name}`,
          version: 'main',
          ...(url ? { url } : {})
        });
      } else {
        // otherwise, ignore
        this.log.warning(`Ignoring unrecognized workflow file ${file}`);
      }
      this.advanceItem();
    }
  }

  async installContainers(containersPath: string) {
    // Traverse containers folder for .tar or .tar.gz files
    console.log(`Installing containers from shard directory ${this.shardPath}`);
    const shardContainersPath = path.join(this.shardPath, 'containers');
    if (!fs.existsSync(shardContainersPath)) {
      console.info('No containers directory found');
      return;
    }
    fs.mkdirSync(containersPath, { recursive: true });
    // Traverse containers list in manifest
    const containers_list: ContainerInfo[] = this.manifest?.containers || [];
    const totalPlatforms = containers_list.reduce(
      (sum, c) => sum + Object.keys(c.platforms || {}).length,
      0
    );
    this.stageItemsTotal = totalPlatforms;
    this.log.info(`Installing ${totalPlatforms} container images from manifest`);
    for (const container of containers_list) {
      const imageRef = container.image;
      const imageTag = imageRef.split('@')[0];
      for (const info of Object.values(container.platforms) as PlatformInfo[]) {
        /* const info = container.platforms[hostPlatform];
        if (!info) {
          this.log.error(`Container ${imageRef} does not support host platform ${hostPlatform}, skipping install.`);
          continue;
        }*/
        const filePath = info.path;
        const sha256 = info.sha256;
        // Move container to GLACIER path
        const srcPath = path.join(this.shardPath, filePath);
        const destPath = path.join(containersPath, path.basename(filePath));
        console.log(`Moving container ${filePath} from ${srcPath} to ${destPath}`);
        fs.renameSync(srcPath, destPath);
        await this.verifyFileIntegrity(destPath, sha256);
        console.log(`Loading container ${filePath} into Docker`);
        await this.loadDockerImage(destPath, imageTag);
        this.advanceItem();
      }
    }
  }

  async loadDockerImage(imagePath: string, tag: string): Promise<void> {
    return new Promise((resolve, reject) => {
      let stdout = '';

      const spawnOpts = is_windows ? { windowsHide: true, detached: true } : {};
      let extraPaths = '';
      try {
        extraPaths = (settings.get('extraPaths') || '').trim();
      } catch {}
      const dockerEnv =
        extraPaths && !is_windows
          ? { ...process.env, PATH: `${extraPaths}:${process.env.PATH || ''}` }
          : undefined;

      if (is_windows) {
        const posixPath = toPosixPath(imagePath);
        const cmd = `docker load -i ${posixPath}`;
        const docker = spawn('wsl.exe', ['-d', 'glacier', '-e', 'bash', '-lc', cmd], spawnOpts);
        docker.stdout.on('data', (data) => {
          const text = data.toString().replace(/\0/g, '');
          stdout += text;
          process.stdout.write(text);
        });
        docker.stderr.on('data', (data) => {
          process.stderr.write(data);
        });
        docker.on('error', reject);
        docker.on('close', (code) => {
          if (code !== 0) {
            reject(new Error(`docker load failed with code ${code}`));
            return;
          }
          const shaMatch = stdout.match(/(sha256:[a-f0-9]+)/i);
          if (shaMatch) {
            const imageId = shaMatch[1];
            const tagCmd = `docker tag ${imageId} ${tag}`;
            const tagProc = spawn(
              'wsl.exe',
              ['-d', 'glacier', '-e', 'bash', '-lc', tagCmd],
              spawnOpts
            );
            tagProc.on('error', reject);
            tagProc.on('close', (tagCode) => {
              if (tagCode === 0) {
                resolve();
              } else {
                reject(new Error(`docker tag failed with code ${tagCode}`));
              }
            });
            return;
          }
          const loadedMatch = stdout.match(/Loaded image:\s*(\S+)/i);
          if (loadedMatch) {
            const loadedRef = loadedMatch[1];
            if (loadedRef === tag) {
              resolve();
              return;
            }
            const tagCmd = `docker tag ${loadedRef} ${tag}`;
            const tagProc = spawn(
              'wsl.exe',
              ['-d', 'glacier', '-e', 'bash', '-lc', tagCmd],
              spawnOpts
            );
            tagProc.on('error', reject);
            tagProc.on('close', (tagCode) => {
              if (tagCode === 0) {
                resolve();
              } else {
                reject(new Error(`docker tag failed with code ${tagCode}`));
              }
            });
            return;
          }
          reject(new Error('Could not determine loaded image ID'));
        });
        return;
      }

      const docker = spawn('docker', ['load', '-i', imagePath], {
        ...spawnOpts,
        ...(dockerEnv ? { env: dockerEnv } : {})
      });
      docker.stdout.on('data', (data) => {
        stdout += data.toString();
        process.stdout.write(data);
      });
      docker.stderr.on('data', (data) => {
        process.stderr.write(data);
      });
      docker.on('error', reject);
      docker.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`docker load failed with code ${code}`));
          return;
        }
        const shaMatch = stdout.match(/(sha256:[a-f0-9]+)/i);
        if (shaMatch) {
          const imageId = shaMatch[1];
          const tagProc = spawn(
            'docker',
            ['tag', imageId, tag],
            dockerEnv ? { env: dockerEnv } : {}
          );
          tagProc.on('error', reject);
          tagProc.on('close', (tagCode) => {
            if (tagCode === 0) {
              resolve();
            } else {
              reject(new Error(`docker tag failed with code ${tagCode}`));
            }
          });
          return;
        }
        const loadedMatch = stdout.match(/Loaded image:\s*(\S+)/i);
        if (loadedMatch) {
          const loadedRef = loadedMatch[1];
          if (loadedRef === tag) {
            resolve();
            return;
          }
          const tagProc = spawn(
            'docker',
            ['tag', loadedRef, tag],
            dockerEnv ? { env: dockerEnv } : {}
          );
          tagProc.on('error', reject);
          tagProc.on('close', (tagCode) => {
            if (tagCode === 0) {
              resolve();
            } else {
              reject(new Error(`docker tag failed with code ${tagCode}`));
            }
          });
          return;
        }
        reject(new Error('Could not determine loaded image ID'));
      });
    });
  }

  async verifyFileIntegrity(filePath: string, expectedSha256: string): Promise<void> {
    console.log(`Verifying SHA256 of ${path.basename(filePath)}`);
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    for await (const chunk of stream) {
      hash.update(chunk);
    }
    const fileSha256 = hash.digest('hex');
    if (fileSha256 !== expectedSha256) {
      throw new Error(
        `SHA256 mismatch for ${path.basename(filePath)}: expected ${expectedSha256}, got ${fileSha256}`
      );
    }
    console.log(`SHA256 verified for ${path.basename(filePath)}`);
  }

  async importAssets(assetsPath: string) {
    // Traverse assets folder and import files to GLACIER asset store
    const shardAssetsPath = path.join(this.shardPath, 'data');
    if (!fs.existsSync(shardAssetsPath)) {
      console.info(`No assets folder found in shard directory ${this.shardPath}`);
      return;
    }
    fs.mkdirSync(assetsPath, { recursive: true });
    const assetFiles = fs.readdirSync(shardAssetsPath);
    console.log(`Found asset files: ${assetFiles.join(', ')}`);
    this.stageItemsTotal = assetFiles.length;
    for (const file of assetFiles) {
      // Skip hidden files
      if (file.startsWith('.')) {
        console.warn(`Skipping hidden file ${file}`);
        this.advanceItem();
        continue;
      }
      const srcPath = path.join(shardAssetsPath, file);
      const destPath = path.join(assetsPath, file);
      console.log(`Moving asset ${file} from ${srcPath} to ${destPath}`);
      fs.renameSync(srcPath, destPath);
      this.advanceItem();
    }
  }

  async addCatalogueEntry(cataloguePath: string) {
    // Add or amend catalogue.json with shard manifest
    const owner = 'shards';
    const repo = 'local';
    const tag = 'main';

    const repo_tag = `${repo}@${tag}`;
    const catalogueDir = path.join(cataloguePath, owner, repo_tag);
    const catalogueFile = path.join(catalogueDir, 'catalogue.json');

    let js;
    if (fs.existsSync(catalogueFile)) {
      js = JSON.parse(fs.readFileSync(catalogueFile, 'utf-8'));
    }

    if (!js) {
      js = {
        name: 'Local catalogue',
        description: '',
        sections: [
          {
            name: this.manifest?.name || 'Default shard',
            description: '',
            workflows: [] as Array<{
              name: string;
              repo: string;
              version: string;
            }>
          }
        ]
      };
    }

    for (const workflow of this.imported_workflows) {
      const entry: { name: string; repo: string; version: string; url?: string } = {
        name: workflow.name,
        repo: workflow.repo,
        version: workflow.version
      };
      if (workflow.url) {
        entry.url = workflow.url;
      }
      js.sections[0].workflows.push(entry);
    }

    fs.mkdirSync(catalogueDir, { recursive: true });
    fs.writeFileSync(catalogueFile, JSON.stringify(js, null, 2));
  }
}
