(faq)=

# FAQ / Troubleshooting

## General

### Where are my workflows and data stored?

- **Config directory**: catalogues, cloned workflow repositories, and the instances database.
- **Documents directory**: instance run directories (parameters, logs, work directories, reports).

You can view and change these paths in **Settings → General**.

### Can I use GLACIER without Docker?

No — Docker is required to run Nextflow pipelines. GLACIER checks for Docker on startup and shows a warning in the Library page if it is not found.

- **macOS / Linux**: Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) and ensure the daemon is running.
- **Windows**: Docker is bundled inside the WSL2 image. Follow the guided setup in **Settings → Environment** to configure WSL2.

### Can I use GLACIER for workflows that are not from the ARTIC Network?

Yes. You can add any GitHub repository that contains a valid Nextflow workflow (with a `nextflow_schema.json` file). Use **Actions → Add Repository** to add your own workflows.

## Catalogue issues

### I typed `artic-network` but nothing happened

The shorthand name works only if the organisation has a repository called `glacier-catalogue`. Try adding the catalogue using the full `owner/repo` form: `artic-network/glacier-catalogue`.

Adding a catalogue from GitHub requires internet access. If you are behind a corporate proxy, you may need to configure Git proxy settings.

If you do not have internet access, you can use {ref}`shards <shards>` — portable bundles that contain workflows, containers, and data — to load catalogues and workflows offline.

### Some workflows have broken URLs in the catalogue

The ARTIC Network catalogue intentionally includes some entries with invalid repository URLs (e.g. `artic-network/raccoon_nf` — note the underscore). These are used for testing error handling. Workflows with valid URLs will install normally.

## Workflow issues

### My workflow is stuck at "created"

The instance was created but never launched. Open the **Instances** page, click the status icon to open the Parameters page, and click **Launch**.

### My workflow failed — where do I look for errors?

1. **Monitor → Logs** tab — check `stderr` and `.nextflow.log` for error messages.
2. **Monitor → Progress** tab — look for process nodes with red error icons.
3. Click the **⋮** menu on a failed process and inspect `.command.err` and `.command.out` for task-level errors.

### How do I update an installed workflow?

On the workflow card in the Library, click the **⋮** menu and select **Check for updates**. If a newer commit is available on the default branch, GLACIER will pull the latest changes.

## Performance

### Why is the progress tree not updating?

The Progress tab refreshes every 5 seconds. If your workflow is very short, it may complete before the first refresh. Check the Logs tab for the final output.

### The Monitor page feels slow

The Logs tab refreshes every 1 second. For workflows with high-output processes, this can be demanding. Switch to the Progress or Reports tab if you do not need live log streaming.

## Environment

### Windows: WSL2 setup fails

Open **Settings → Environment** and use the guided WSL2 setup buttons:

1. **Install WSL2** — enables the Windows feature.
2. **Configure WSL2** — downloads Ubuntu 22.04 and installs Java, Docker, Nextflow.

If this fails, ensure Windows is up to date and virtualization is enabled in your BIOS.

### macOS: "Docker not found"

Install [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop/) and ensure it is running (the whale icon should appear in your menu bar).

## Web deployment

```{warning}
Web server mode is **experimental** and not fully supported. Some features may behave differently or be unavailable compared to the desktop application.
```

### The web server won't start

Make sure you have run `npm run build` first — the server depends on compiled output in `dist/`.

### Can I run the web server behind a reverse proxy?

Yes. The server listens on port 3030 by default. Configure nginx, Caddy, or another reverse proxy to forward requests to `http://localhost:3030`.
