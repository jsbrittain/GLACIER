(workflows)=

# Workflows

A **workflow** is a pipeline stored in a Git repository. GLACIER currently supports **Nextflow** workflows, detected by the presence of a `nextflow_schema.json` file.

## Installing a workflow

From the Library page, click **Install** on any workflow card. GLACIER clones the repository to your workflows directory at `<configPath>/workflows/<owner>/<repo>@<version>`.

The button label changes from *Install* to *Launch* once the clone completes.

## Configuring parameters

Click an installed workflow card to open the **Parameters** page. This page has three tabs:

### Info
Renders the workflow's `README.md` so you can review documentation before running.

### License
Shows the `LICENSE` file from the workflow repository.

### Params
The main configuration view. GLACIER reads the workflow's `nextflow_schema.json` and renders a JSON Forms form. You can:

- Edit parameter values directly in the form.
- **Load parameters** from a `.json` file on disk.
- **Save parameters** to a `.json` file for reuse.

### Execution profiles

The **Profiles** dropdown lists profiles extracted from `nextflow.config`. These map to Nextflow's `-profile` flag. The `standard` profile is selected by default.

If a `test` profile exists, a **Test launch** button appears alongside **Launch**. Use this to run the workflow with the `test` profile combined with your other selections.

## Launching a workflow

When you click **Launch**, GLACIER:

1. Validates parameters against the JSON Schema (unless disabled in Settings).
2. Creates a **workflow instance** — a named run directory containing the parameters file, logs, and work directory.
3. Spawns the Nextflow process using the bundled JRE and `nextflow.jar`.
4. Navigates to the **Monitor** page so you can follow progress in real time.

### Launch options

| Option | Behaviour |
|--------|-----------|
| **Launch** | Starts the pipeline with selected profiles and parameters. |
| **Test launch** | Available when a `test` profile exists. Runs with `test` plus any other selected profiles. |

## Resume and restart

- **Resume** (from Monitor page) — re-launches with Nextflow's `-resume` flag, continuing from the last checkpoint.
- **Restart** (from Monitor page) — cancels the running instance and opens the Parameters page so you can edit settings before re-launching.

## What happens after launch

Nextflow is invoked with the following flags:

```
java -jar nextflow.jar run <repo> \
  -work-dir <instance_path>/work \
  -profile <profiles> \
  -params-file <instance_path>/params.json \
  -name <instance_name>
```

Standard output and error are captured to `stdout.log` and `stderr.log` in the instance directory. Nextflow's own log goes to `nextflow.log`.
