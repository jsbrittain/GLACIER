import fs from 'fs';
import os from 'os';
import path from 'path';
import * as tar from 'tar';
import { spawn } from 'child_process';
import crypto from 'crypto';
import slash from 'slash';
import { ShardStatus, ShardStatusValue, shardStatusMessage } from '../types/shard.js';
import { settings } from './settings.js';

const is_windows = process.platform === 'win32';

const toPosixPath = (base: string) => {
  return slash(base.replace(/^([A-Za-z]):\\/, (_, drive) => `/mnt/${drive.toLowerCase()}/`));
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
    logs: shard?.log?.logs || []
  };
};

const shardRepository: Record<string, ImportShard> = {};

export const importShard = async (filePath: string, glacierPath: string) => {
  // New shard instance
  const shard = new ImportShard();
  shardRepository[shard.shardId] = shard;
  void shard.importShard(filePath, glacierPath);
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
  imported_workflows: Array<{ name: string; repo: string; version: string }> = [];

  constructor() {
    this.shardId = `shard-${Date.now()}`;
  }

  async importShard(filePath: string, glacierPath: string) {
    this.shardStatus = ShardStatus.Pending;
    console.log(`Importing shard from file ${filePath}`);

    // Create temporary staging area
    const stagingPath = await this.createStagingArea();

    try {
      // Decompress filePath (.shard, which is actually a .tar.gz) into staging area
      this.shardStatus = ShardStatus.ExtractingShard;
      this.shardPath = await this.extractTar(filePath, stagingPath);

      // Read manifest
      await this.readManifest();

      // Extract workflow files and move to GLACIER catalogue
      this.shardStatus = ShardStatus.ImportingWorkflows;
      const workflowPath = path.join(glacierPath, 'workflows');
      await this.extractWorkflows(workflowPath);

      // Install containers
      this.shardStatus = ShardStatus.InstallingContainers;
      const containersPath = path.join(glacierPath, 'containers');
      await this.installContainers(containersPath);

      // Import assets / data
      this.shardStatus = ShardStatus.ImportingAssets;
      const assetsPath = path.join(glacierPath, 'data');
      await this.importAssets(assetsPath);

      // Add catalogue entry
      this.shardStatus = ShardStatus.UpdatingCatalogue;
      const cataloguePath = path.join(glacierPath, 'catalogues');
      await this.addCatalogueEntry(cataloguePath);

      // Finished
      this.shardStatus = ShardStatus.Completed;
      this.log.success(`Shard import completed successfully`);
    } catch (err) {
      this.shardStatus = ShardStatus.Error;
      this.log.error(`Shard import failed: ${err}`);
      throw err;
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
    // Extract tarball (or gzipped tarball) to destination path
    fs.mkdirSync(destPath, { recursive: true });
    try {
      await tar.extract({
        file: tarPath,
        cwd: destPath
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
    for (const file of workflowFiles) {
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
        // add workflow to catalogue-import list
        this.imported_workflows.push({
          name: extracted_name,
          repo: `local/${extracted_name}`,
          version: 'main'
        });
      } else {
        // otherwise, ignore
        this.log.warning(`Ignoring unrecognized workflow file ${file}`);
        continue;
      }
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
    this.log.info(`Installing ${containers_list.length} containers from manifest`);
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
          const match = stdout.match(/(sha256:[a-f0-9]+)/i);
          if (!match) {
            reject(new Error('Could not determine loaded image ID'));
            return;
          }
          const imageId = match[1];
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
        const match = stdout.match(/(sha256:[a-f0-9]+)/i);
        if (!match) {
          reject(new Error('Could not determine loaded image ID'));
          return;
        }
        const imageId = match[1];
        const tagProc = spawn('docker', ['tag', imageId, tag], dockerEnv ? { env: dockerEnv } : {});
        tagProc.on('error', reject);
        tagProc.on('close', (tagCode) => {
          if (tagCode === 0) {
            resolve();
          } else {
            reject(new Error(`docker tag failed with code ${tagCode}`));
          }
        });
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
    for (const file of assetFiles) {
      // Skip hidden files
      if (file.startsWith('.')) {
        console.warn(`Skipping hidden file ${file}`);
        continue;
      }
      const srcPath = path.join(shardAssetsPath, file);
      const destPath = path.join(assetsPath, file);
      console.log(`Moving asset ${file} from ${srcPath} to ${destPath}`);
      fs.renameSync(srcPath, destPath);
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
      js.sections[0].workflows.push({
        name: workflow.name,
        repo: workflow.repo,
        version: workflow.version
      });
    }

    fs.mkdirSync(catalogueDir, { recursive: true });
    fs.writeFileSync(catalogueFile, JSON.stringify(js, null, 2));
  }
}
