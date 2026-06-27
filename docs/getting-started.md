# Getting started

## Prerequisites

- **Docker** — required for running pipelines. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) for macOS or Linux.

GLACIER bundles its own Java Runtime Environment and Nextflow, so you do not need to install those separately.

> **Windows users**: GLACIER uses WSL2 under the hood for Nextflow execution. Docker is bundled inside the WSL2 image — you do not need to install Docker Desktop separately. The Settings → Environment tab provides guided setup for installing and configuring WSL2.

## Installation

Download the latest GLACIER release for your platform from the [GitHub Releases page](https://github.com/ARTIC-Kraemer-Lab/GLACIER/releases).

| Platform | Format |
|----------|--------|
| macOS (Intel) | `.dmg` |
| macOS (Apple Silicon) | `.dmg` |
| Windows | `.exe` installer |
| Linux | `.AppImage` or `.deb` |

Open the downloaded file and follow the installer prompts. Once installed, launch GLACIER from your Applications folder, Start menu, or desktop shortcut.

> **Developers**: If you want to build from source, see {ref}`building-from-source`.

## First launch

When you start GLACIER for the first time you will see an empty Library page. Your first step is to add a catalogue.

1. Click the **Actions** button in the top-left corner.
2. Select **Add a Catalogue**.
3. Enter `artic-network/glacier-catalogue` and click **Add**.

GLACIER will clone the catalogue repository and display its contents. You should see three sections: **workshop**, **general**, and **MPXV**, each containing workflow cards.

> A shorthand name like `artic-network` works if the organisation has a repository called `glacier-catalogue`. When in doubt, use the full `owner/repo` format.

## Quick start walkthrough

1. In the **workshop** section, find the **amplicon-nf** workflow card.
2. Click **Install** to clone the workflow repository.
3. Once installed, click the workflow card. The Parameters page opens.
4. Review the parameters (they are populated from the workflow's `nextflow_schema.json`), or accept the defaults.
5. Select an execution profile (e.g. `standard`) from the dropdown.
6. Click **Launch** to start the pipeline.

GLACIER will create a named instance (e.g. `brave-lion`) and navigate to the Monitor page where you can track progress, view logs, and inspect reports.

(building-from-source)=

## Building from source

If you prefer to build the application yourself:

```bash
git clone https://github.com/ARTIC-Kraemer-Lab/GLACIER.git
cd GLACIER
npm install
npm start
```

You will need **Node.js 18+** and **npm** installed. The first build may take a minute while TypeScript compiles the backend and Vite bundles the frontend.

## Next steps

- {ref}`tutorial` — walk through a complete workflow lifecycle with raccoon-nf.
- {ref}`catalogues` — learn how to browse, organise, and maintain catalogues.
- {ref}`workflows` — detailed guide to installing, configuring, and launching workflows.
- {ref}`monitor` — monitoring pipeline execution and inspecting outputs.
- {ref}`settings` — configuring GLACIER to suit your environment.
