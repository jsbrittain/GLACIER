(settings)=

# Settings

Open the **Settings** page from the left sidebar (the gear icon). It has six tabs:

## General

| Setting | Description |
|---------|-------------|
| **Config folder path** | Location where catalogues and workflow repos are stored. |
| **Documents folder path** | Location where instance run data is stored. |
| **Permit add catalogues** | Allow adding new catalogues (on/off). |
| **Permit modify catalogues** | Allow hiding/removing catalogue sections and workflows (on/off). |
| **Permit import shards** | Allow importing `.shard` files (on/off). |
| **Permit add repos** | Allow adding user workflow repositories (on/off). |

The config and documents paths default to:

- **Packaged app**: Electron's `userData` and `documents` directories.
- **Web mode**: `~/GLACIER` and `~/Documents/GLACIER`.

## Visual options

| Setting | Description |
|---------|-------------|
| **Dark mode** | Toggle between light and dark themes. |

## Language

GLACIER supports multiple languages. Currently available:

- **English**
- **Français**

Select your preferred language from the dropdown. The UI updates immediately.

## Environment

This tab shows system resource information and provides tools for managing dependencies:

| Section | Details |
|---------|---------|
| **System resources** | CPU cores and total memory detected on your machine. |
| **Nextflow** | Status check — whether Nextflow is accessible (via the bundled JRE). |
| **Docker** | Status check — whether Docker is installed and running. |
| **WSL2** (Windows only) | Guided setup to install or configure the WSL2 glacier distro with Java, Docker, and Nextflow. |

Action buttons on this tab allow you to:

- **Download Docker Desktop** (macOS/Linux) — opens the Docker website.
- **Install WSL2** (Windows) — enables the WSL2 Windows feature.
- **Configure WSL2** (Windows) — downloads Ubuntu 22.04, creates the glacier distro, and installs required dependencies.

## Advanced options

| Setting | Description |
|---------|-------------|
| **Disable schema validation** | Bypass `nextflow_schema.json` validation when launching workflows. Use this if a workflow has a malformed schema. |
| **Show hidden params** | Display parameters that the workflow schema marks as hidden. |
| **Auto-resolve store_dir** | When creating an instance of a workflow that defines a `store_dir`, `storedir`, or `store-dir` parameter, automatically set it to `{documentsPath}/store_dir` and create the directory. The parameter is overwritten even if it carries a default from the schema. Note: this is a custom parameter convention, *not* Nextflow's built-in `storeDir` process directive. |

## Licenses

Lists open-source licenses for GLACIER and its dependencies.
