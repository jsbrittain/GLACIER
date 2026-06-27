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
