(shards)=

# Shards

A **shard** (`.shard` file) is a portable bundle for distributing workflows, container images, and reference data together. Shards are useful for offline or air-gapped environments.

## Importing a shard

1. **Actions** → **Import Shard**.
2. Select a `.shard` file from your file system.

GLACIER extracts the archive and processes its contents:

1. **Workflows** — extracted to `<configPath>/workflows/local/`.
2. **Docker images** — loaded into the local Docker daemon via `docker load`.
3. **Data assets** — copied to `<configPath>/data/`.
4. **Catalogue entry** — created or amended in a **Local catalogue** stored at `<configPath>/catalogues/shards/local@main/catalogue.json`.

You can track import progress via the status dialog. Once complete, the imported workflows appear in the Library under the Local catalogue.

## Remote-aware updates

Workflows bundled into a shard are installed offline as `local/<name>`, so by default they have no remote and **Check for updates** cannot find new versions.

The shard generator already bundles the workflow as a shallow git clone and restores its `origin` remote, so GLACIER reads the source repository automatically from the extracted `.git/config` at import — **no manifest changes are required** for shards built by the current generator. When a remote is found, **Check for updates** fetches tags from it and, when you install a new version, clones it in place under `local/<name>@latest` while preserving your local copy until the update completes.

Shard builders can optionally override the derived remote by mapping each bundled workflow to its source repository in the manifest:

```json
{
  "name": "artic-network",
  "workflows": [{ "name": "artic-nf", "repo": "ARTIC-Network/artic-nf", "version": "0.3.0" }],
  "containers": []
}
```

`workflows[].name` must match the workflow tarball basename (e.g. `workflow/artic-nf.tar.gz`), and `repo` is the short-form (`owner/repo`) or full GitHub URL. This entry takes precedence over the git-derived remote.

When neither source provides a valid remote, the shard imports as before, with no update capability.
