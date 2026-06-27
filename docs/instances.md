(instances)=

# Instances

An **instance** is a single execution of a workflow. Each instance gets a unique auto-generated name based on adjective-animal pairs, such as `brave-lion`, `swift-otter`, or `calm-raven`.

## Instances page

Open the **Instances** page from the left sidebar (the storage icon). It lists all workflow instances in a table with these columns:

| Column | Description |
|--------|-------------|
| **Status** | Colour-coded icon: running (blue), completed (green), failed (red), created (grey), closed (grey). |
| **Instance** | The auto-generated name of the instance. |
| **Workflow** | The workflow name and version (e.g. `amplicon-nf@latest`). |
| **Actions** | **Delete** button to remove the instance. |

The list auto-refreshes every 5 seconds.

## Viewing instance details

Click the status icon of any instance to open its detail page. Depending on the instance status you will see either:

- **The Parameters page** — for instances with status `created` (allows reconfiguration before launch).
- **The Monitor page** — for instances with status `running`, `completed`, or `failed`.

## Deleting an instance

Use the **Delete** button in the Actions column. If the instance is still running, GLACIER will kill the processes first. This removes the instance directory and all its contents (work directory, logs, reports, parameters).

> Deleting a *completed* instance is safe — your pipeline outputs should be moved elsewhere first if you want to keep them.

## Instance directory layout

Each instance is stored at:

```
<documentsPath>/instances/<owner>/<repo>@<version>/<instance_name>/
```

```
params.json        -- Parameters used for the run
stdout.log         -- Nextflow standard output
stderr.log         -- Nextflow standard error
.nextflow.log      -- Nextflow internal log
work/              -- Nextflow work directory (per-task outputs)
<reports>          -- HTML report files (e.g. articMinIONReport.html)
```
