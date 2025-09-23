import * as fs from 'fs';
import * as readline from 'readline';

const file = process.argv[2] ?? '.nextflow.log';

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
    re: /\[(\w+\/[0-9A-Fa-f]+)\]\s+Submitted process > ([^\s]+(?: \(\d+\))?)/
  },
  // Task completed > ... name: <proc>; status: <STATUS>;
  { t: 'completed' as const, re: /Task completed > .*?name:\s*([^;]+);\s*status:\s*([A-Z]+);/ },
  { t: 'error' as const, re: /Error executing process > '([^']+)'/ },
  { t: 'aborted' as const, re: /Session aborted -- Cause:\s*(.+)/ },
  { t: 'wf_done' as const, re: /Workflow completed/ }
];

const DEBUG = process.env.DEBUG === '1';

export async function parseNextflowLog(path: string) {
  const rl = readline.createInterface({
    input: fs.createReadStream(path, { encoding: 'utf8' }),
    crlfDelay: Infinity
  });

  let anyOutput = false;
  const progress: { workflow: any[]; process: { [key: string]: any[] } } = {
    workflow: [],
    process: {}
  };

  for await (const line0 of rl) {
    const line = line0.replace(/\x1b\[[0-9;]*m/g, ''); // strip ANSI color codes if present
    const ts = line.split('[', 1)[0].trim();

    let matched = false;

    for (const r of RES) {
      const m = r.re.exec(line);
      if (!m) continue;
      matched = true;
      anyOutput = true;

      const safeCreate = (obj: any, key: string) => {
        if (!obj['process'][key]) obj['process'][key] = [];
      };

      switch (r.t) {
        case 'created':
          safeCreate(progress, m[1]);
          progress['process'][m[1]].push({ time: ts, status: 'created' });
          break;
        case 'starting':
          safeCreate(progress, m[1]);
          progress['process'][m[1]].push({ time: ts, status: 'starting' });
          break;
        case 'submitted':
          safeCreate(progress, m[2]);
          progress['process'][m[2]].push({ time: ts, status: 'submitted', work: m[1] });
          break;
        case 'completed':
          safeCreate(progress, m[1]);
          progress['process'][m[1]].push({ time: ts, status: 'completed', result: m[2] });
          break;
        case 'error':
          safeCreate(progress, m[1]);
          progress['process'][m[1]].push({ time: ts, status: 'error' });
          break;
        case 'aborted':
          progress['workflow'].push({ time: ts, status: 'aborted', cause: m[1] });
          break;
        case 'wf_done':
          progress['workflow'].push({ time: ts, status: 'completed' });
          break;
      }
      break; // one event per line is enough
    }

    if (!matched && DEBUG) {
      // Helps debug when patterns miss a line you expected to match
      console.error('UNMATCHED:', line);
    }
  }

  if (!anyOutput) {
    console.error('No events matched. Tips:');
    console.error('  - Confirm you passed the correct log file path.');
    console.error('  - Try: DEBUG=1 node nf-parse.js .nextflow.log  (to see unmatched lines).');
    console.error(
      '  - Your log may have different wording; paste an example line and I’ll tweak the regex.'
    );
  }

  return progress;
}
