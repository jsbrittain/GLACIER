export const ShardStatus = {
  Unknown: 'unknown',
  None: 'none',
  Pending: 'pending',
  ExtractingShard: 'extracting-shard',
  ImportingWorkflows: 'importing-workflows',
  InstallingContainers: 'installing-containers',
  ImportingAssets: 'importing-assets',
  UpdatingCatalogue: 'updating-catalogue',
  Error: 'error',
  Completed: 'completed',
  Failed: 'failed'
};

export const shardStatusMessage = {
  [ShardStatus.Unknown]: 'Unknown shard ID',
  [ShardStatus.None]: 'No shard import in progress',
  [ShardStatus.Pending]: 'Shard import pending',
  [ShardStatus.ExtractingShard]: 'Extracting shard contents',
  [ShardStatus.ImportingWorkflows]: 'Importing workflows',
  [ShardStatus.InstallingContainers]: 'Installing containers',
  [ShardStatus.ImportingAssets]: 'Importing assets',
  [ShardStatus.UpdatingCatalogue]: 'Updating catalogue',
  [ShardStatus.Error]: 'Shard import failed with error',
  [ShardStatus.Completed]: 'Shard import completed successfully',
  [ShardStatus.Failed]: 'Shard import failed'
};

export type ShardStatusValue = (typeof ShardStatus)[keyof typeof ShardStatus];
