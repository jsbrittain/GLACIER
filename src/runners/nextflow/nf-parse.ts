import * as fs from 'fs';
import * as fs_promises from 'fs/promises';
import * as readline from 'readline';
import path from 'path';
import { WorkflowStatus } from '../../types/types.js';

const file = process.argv[2] ?? 'nextflow.log';

// Simple timestamp prefix (optional) — grabs everything up to the first "]" block or start of line
const tsRe = /^(.*?)\s*(?:\[[^\]]+\]\s*)?/;

type Row =
  | { t: 'created'; ts: string; p: string }
  | { t: 'starting'; ts: string; p: string }
  | { t: 'submitted'; ts: string; p: string }
  | { t: 'completed'; ts: string; p: string; s: string }
  | { t: 'error'; ts: string; p: string }
  | { t: 'aborted'; ts: string; cause: string }
  | { t: 'wf_done'; ts: string };

const RES = [
  { t: 'created' as const, re: /Creating process '([^']+)'/ },
  { t: 'starting' as const, re: /Starting process > ([^\s]+)/ },
  {
    t: 'submitted' as const,
    re: /\[(\w+\/[0-9A-Fa-f]+)\]\s+Submitted process > ([^\s]+(?: \(.+\))?)/
  },
  // Task completed > ... name: <proc>; status: <STATUS>;
  { t: 'completed' as const, re: /Task completed > .*?name:\s*([^;]+);\s*status:\s*([A-Z]+);/ },
  { t: 'error' as const, re: /Error executing process > '([^']+)'/ },
  { t: 'aborted' as const, re: /Session aborted -- Cause:\s*(.+)/ },
  { t: 'config_error' as const, re: /ERROR.*Config parsing failed/ },
  { t: 'wf_done' as const, re: /Workflow completed/ }
];

const DEBUG = process.env.DEBUG === '1';

export async function readNextflowLog(path: string) {
  const root_path = path.split('/').slice(0, -1).join('/');
  const rl = readline.createInterface({
    input: fs.createReadStream(path, { encoding: 'utf8' }),
    crlfDelay: Infinity
  });

  let anyOutput = false;
  const progress: { workflow: any[]; group: any[] } = {
    workflow: [],
    group: []
  };

  const addProcess = (obj: any, key: string) => {
    const process_hierarchy = key.split(':');
    const last = process_hierarchy[process_hierarchy.length - 1];
    const bracketMatch = last.match(/(.*)\s*\(([^)]+)\)/);
    if (bracketMatch) {
      process_hierarchy[process_hierarchy.length - 1] = bracketMatch[1].trim();
      process_hierarchy.push(bracketMatch[2]);
    }

    for (const part of process_hierarchy) {
      obj = obj['group'];
      const obj_present = obj.find((o: any) => o.name === part);
      if (obj_present) {
        obj = obj_present;
      } else {
        obj.push({
          name: part,
          process: [],
          group: []
        });
        obj = obj[obj.length - 1];
      }
    }
    return obj;
  };

  const lines = rl[Symbol.asyncIterator]();
  let nextResult = await lines.next();

  while (!nextResult.done) {
    const line0 = nextResult.value;
    const line = line0.replace(/\x1b\[[0-9;]*m/g, '');
    const ts = line.split('[', 1)[0].trim();

    let matched = false;
    let errorBlockParsed = false;

    for (const r of RES) {
      const m = r.re.exec(line);
      if (!m) continue;
      matched = true;
      anyOutput = true;

      const process_label = m[1];

      let process_group = '';
      if (process_label) {
        process_group = process_label.replace(/\s*\(.*\)$/, '');
      }

      switch (r.t) {
        case 'created':
          addProcess(progress, process_label).process.push({
            time: ts,
            full_name: process_group,
            status: 'created'
          });
          break;
        case 'starting':
          addProcess(progress, process_label).process.push({
            time: ts,
            full_name: process_group,
            status: 'starting'
          });
          break;
        case 'submitted':
          let obj = addProcess(progress, m[2]);

          const old_process_label = obj.process.filter((p: any) => p.work !== undefined)[0]?.work;
          if (old_process_label && old_process_label !== process_label) {
            if (obj.group.length === 0) {
              obj.group.push({
                name: old_process_label,
                process: [],
                group: []
              });
              const work_items = obj.process.filter((p: any) => p.work !== undefined);
              obj.group[obj.group.length - 1].process.push(...work_items);
              const last_update = await lastUpdateTime(root_path, old_process_label, 'log');
              obj.group[obj.group.length - 1].last_update = last_update;
              obj.process = obj.process.filter((p: any) => p.work === undefined);
            }
            obj.group.push({
              name: process_label,
              process: [],
              group: []
            });
            obj = obj.group[obj.group.length - 1];
          }

          const last_update = await lastUpdateTime(root_path, process_label, 'log');
          const submitted_full_name = m[2].replace(/\s*\(.*\)$/, '');
          obj.process.push({
            time: ts,
            full_name: submitted_full_name,
            status: 'submitted',
            work: process_label,
            last_update: last_update
          });
          obj.last_update = last_update;
          break;
        case 'completed':
          addProcess(progress, process_label).process.push({
            time: ts,
            full_name: process_group,
            status: 'completed'
          });
          break;
        case 'error': {
          errorBlockParsed = true;

          const entry: any = {
            time: ts,
            full_name: process_group,
            status: 'error'
          };

          let exitStatus: string | undefined;
          let commandError: string[] = [];
          let cause: string | undefined;
          let inCommandError = false;
          let pendingField: 'cause' | 'exitStatus' | null = null;

          while (!(nextResult = await lines.next()).done) {
            const raw = nextResult.value.replace(/\x1b\[[0-9;]*m/g, '');
            const trimmed = raw.trim();
            if (!trimmed) continue;

            if (trimmed === 'Work dir:' || trimmed.startsWith('Work dir:')) break;

            if (trimmed === 'Caused by:') {
              pendingField = 'cause';
              inCommandError = false;
              continue;
            }

            if (trimmed === 'Command exit status:') {
              pendingField = 'exitStatus';
              inCommandError = false;
              continue;
            }

            if (trimmed === 'Command error:' || trimmed === 'Command error (stderr):') {
              pendingField = null;
              inCommandError = true;
              continue;
            }

            if (inCommandError) {
              commandError.push(trimmed);
              continue;
            }

            if (pendingField === 'cause' && !cause) {
              cause = trimmed;
              pendingField = null;
              continue;
            }

            if (pendingField === 'exitStatus' && !exitStatus) {
              exitStatus = trimmed;
              pendingField = null;
              continue;
            }
          }

          if (exitStatus) entry.exitStatus = exitStatus;
          if (cause) entry.cause = cause;
          if (commandError.length > 0) entry.commandError = commandError.join('\n');

          addProcess(progress, process_label).process.push(entry);
          break;
        }
        case 'aborted':
          progress['workflow'].push({ time: ts, status: WorkflowStatus.Failed, cause: m[1] });
          break;
        case 'config_error':
          progress['workflow'].push({ time: ts, status: WorkflowStatus.Failed, cause: 'Config parsing failed' });
          break;
        case 'wf_done':
          progress['workflow'].push({ time: ts, status: WorkflowStatus.Completed });
          break;
      }
      break;
    }

    if (!matched && DEBUG) {
      console.error('UNMATCHED:', line);
    }

    if (!errorBlockParsed) {
      nextResult = await lines.next();
    }
  }

  return progress;
}

const lastUpdateTime = async (instancePath: string, workID: string, log_type: string) => {
  const log_filenames = {
    stdout: '.command.out',
    log: '.command.log'
  };
  let log_filename;
  if (log_type in log_filenames) {
    log_filename = log_filenames[log_type as keyof typeof log_filenames];
  } else {
    throw new Error(`Unknown log type: ${log_type}`);
  }

  // nextflow work id: <2digits>/<first 6digits of hash>
  const match = workID.split('/');
  const prefix = match[0];
  const short_hash = match[1];
  const workFolder = path.join(instancePath, 'work', prefix);
  if (!fs.existsSync(workFolder)) {
    console.warn(`Work folder does not exist for prefix: ${prefix}`);
    return;
  }
  // Find matching folders
  const candidates = fs.readdirSync(workFolder).filter((f) => f.startsWith(short_hash));
  if (candidates.length === 0) {
    return;
  } else if (candidates.length > 1) {
    console.warn(`Multiple work folders found matching ID: ${workID}, using first match.`);
  }
  const folderPath = path.join(workFolder, candidates[0]);
  const logFile = path.join(folderPath, `${log_filename}`);
  // Get last modified time of the log file
  const stats = await fs_promises.stat(logFile);
  return new Date(stats.mtimeMs).toISOString();
};

export async function parseNextflowLog(path: string) {
  const progress = await readNextflowLog(path);
  return progress;
}
