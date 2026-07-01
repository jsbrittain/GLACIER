(catalogues)=

# Catalogues

A **catalogue** is a curated collection of workflow listings stored as a Git repository. Each catalogue contains a `catalogue.json` file that defines sections and the workflows within them.

## Adding a catalogue

1. Click the **Actions** button in the Library page.
2. Choose **Add a Catalogue**.
3. Enter the repository identifier in `owner/repo` format (e.g. `artic-network/glacier-catalogue`).

   You can also use a shorthand org name (e.g. `artic-network`), but this only works if that organisation has a repository named `glacier-catalogue`. When in doubt, use the full `owner/repo` form.

GLACIER clones the repository to your config directory and parses `catalogue.json` to display the catalogue.

## Browsing a catalogue

Catalogues are displayed as cards. The **ARTIC Network** catalogue is styled with a teal colour scheme and contains three sections:

### workshop
Contains:
- **amplicon-nf** — amplicon-based sequencing analysis (`artic-network/amplicon-nf`, latest version).
- **raccoon-nf** — recombinant analysis pipeline (`artic-network/raccoon-nf`, latest version).

### general
General-purpose workflows:
- **amplicon-nf** — same workflow as above, pinned to the `0.6.1` release.

### MPXV
Mpox virus analysis workflows with a distinct red colour scheme:
- **amplicon-nf** — MPXV-specific amplicon analysis.
- **squirrel-nf** — squirrel-related analysis (`artic-network/squirrel-nf`).

## Installing workflows from a catalogue

Each workflow card shows an **Install** button if the workflow is not yet cloned locally. Click it to clone the workflow repository.

You can also batch-install all workflows in a section or an entire catalogue using the **⋮** menu on the section or catalogue header, then selecting **Install all workflows**.

## Organising catalogue contents

Use the **⋮** menu on any section or workflow card:

| Action | Effect |
|--------|--------|
| **Hide section** | Collapses the section from view. Use *Show all workflows* on the catalogue menu to restore. |
| **Remove section** | Deletes the section from the local copy of `catalogue.json`. |
| **Hide repository** | Hides an individual workflow card. |
| **Remove repository** | Removes the workflow from its section in `catalogue.json`. |

> These modifications only affect your local copy of the catalogue. They are useful for decluttering.

## Checking for updates

For workflows tracked with `"version": "latest"`, GLACIER can check whether a newer commit is available on the default branch.

- Use **Check for updates** on a single workflow card, or on a section/catalogue to check all workflows at once.
- If an update is found, GLACIER will offer to pull the latest changes.

## Adding user workflows

You can add your own workflow repositories outside of any curated catalogue:

1. **Actions** → **Add Repository**.
2. Enter a display name, the GitHub URL, and optionally a version tag.
3. The workflow is added to a special **User collection** catalogue that GLACIER creates automatically.

## Removing a catalogue

Use the **⋮** menu on the catalogue card and select **Remove catalogue**. This deletes the cloned catalogue repository from disk — it does not affect any installed workflows.

## Default parameters

Each workflow entry in a catalogue can include a `parameters` object that provides default values for the Parameters form. When you create an instance from a catalogue entry that has default parameters, those values are pre-filled automatically.

Example `catalogue.json`:

```json
{
  "name": "My Catalog",
  "sections": [
    {
      "name": "Genomics",
      "workflows": [
        {
          "name": "amplicon-nf",
          "repo": "artic-network/amplicon-nf",
          "version": "main",
          "parameters": {
            "outdir": "./results",
            "primer_set": "SARS-CoV-2/V1200"
          }
        }
      ]
    }
  ]
}
```

The precedence for parameter values (highest to lowest) is:

1. **User settings** — Auto-resolved values like `outdir` and `store_dir` from GLACIER settings
2. **Catalogue defaults** — The `parameters` object in the catalogue entry
3. **Schema defaults** — Defaults defined in the workflow's `nextflow_schema.json`

This means catalogue defaults are a convenient starting point, and they can be overridden by GLACIER's auto-resolution settings or by direct changes in the Parameters form.
