import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, writeSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { parseNextflowLog } from '../../src/runners/nextflow/nf-parse.js';

let tmpDir;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'nf-parse-test-'));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function createLogFile(content) {
  const logPath = join(tmpDir, 'nextflow.log');
  writeFileSync(logPath, content, 'utf8');
  return logPath;
}

function createWorkDir(workID) {
  const [prefix, hash] = workID.split('/');
  const workFolder = join(tmpDir, 'work', prefix);
  mkdirSync(workFolder, { recursive: true });
  const targetFolder = join(workFolder, hash + 'somehash');
  mkdirSync(targetFolder, { recursive: true });
  writeFileSync(join(targetFolder, '.command.log'), 'log content', 'utf8');
  return targetFolder;
}

describe('nf-parse', () => {
  describe('created event', () => {
    it('adds a process with created status', async () => {
      const content = "2024-01-01 12:00:00.123 Creating process 'foo'\n";
      const logPath = createLogFile(content);
      const result = await parseNextflowLog(logPath);

      expect(result.workflow).toEqual([]);
      expect(result.group).toHaveLength(1);
      expect(result.group[0].name).toBe('foo');
      expect(result.group[0].process).toHaveLength(1);
      expect(result.group[0].process[0].status).toBe('created');
    });

    it('adds process under nested group for colon-separated names', async () => {
      const content = "2024-01-01 12:00:00.123 Creating process 'foo:bar:baz'\n";
      const logPath = createLogFile(content);
      const result = await parseNextflowLog(logPath);

      expect(result.group).toHaveLength(1);
      expect(result.group[0].name).toBe('foo');
      expect(result.group[0].group).toHaveLength(1);
      expect(result.group[0].group[0].name).toBe('bar');
      expect(result.group[0].group[0].group).toHaveLength(1);
      expect(result.group[0].group[0].group[0].name).toBe('baz');
      const baz = result.group[0].group[0].group[0];
      expect(baz.process[0].status).toBe('created');
    });
  });

  describe('starting event', () => {
    it('adds a process with starting status', async () => {
      const content = '2024-01-01 12:00:00.123 Starting process > foo\n';
      const logPath = createLogFile(content);
      const result = await parseNextflowLog(logPath);

      expect(result.group[0].name).toBe('foo');
      expect(result.group[0].process[0].status).toBe('starting');
    });
  });

  describe('submitted event', () => {
    it('adds a process with submitted status and work ID', async () => {
      createWorkDir('ab/123456');
      const content = '2024-01-01 12:00:00.123 [ab/123456] Submitted process > foo\n';
      const logPath = createLogFile(content);
      const result = await parseNextflowLog(logPath);

      expect(result.group[0].name).toBe('foo');
      expect(result.group[0].process[0].status).toBe('submitted');
      expect(result.group[0].process[0].work).toBe('ab/123456');
      expect(result.group[0].process[0].last_update).toBeTruthy();
      expect(result.group[0].last_update).toBeTruthy();
    });

    it('strips trailing bracket from process name, creating subgroup', async () => {
      createWorkDir('ab/123456');
      const content = '2024-01-01 12:00:00.123 [ab/123456] Submitted process > foo (2)\n';
      const logPath = createLogFile(content);
      const result = await parseNextflowLog(logPath);

      expect(result.group[0].name).toBe('foo');
      expect(result.group[0].group).toHaveLength(1);
      expect(result.group[0].group[0].name).toBe('2');
      expect(result.group[0].group[0].process[0].status).toBe('submitted');
    });

    it('creates subgroup when duplicate work IDs exist', async () => {
      createWorkDir('ab/123456');
      createWorkDir('cd/789012');
      const content = [
        '2024-01-01 12:00:00.123 [ab/123456] Submitted process > foo',
        '2024-01-01 12:00:01.456 [cd/789012] Submitted process > foo'
      ].join('\n');
      const logPath = createLogFile(content);
      const result = await parseNextflowLog(logPath);

      expect(result.group[0].name).toBe('foo');
      expect(result.group[0].group).toHaveLength(2);
      expect(result.group[0].group[0].name).toBe('ab/123456');
      expect(result.group[0].group[1].name).toBe('cd/789012');
      expect(result.group[0].group[0].process[0].work).toBe('ab/123456');
      expect(result.group[0].group[1].process[0].work).toBe('cd/789012');
    });

    it('adds colons as nested groups', async () => {
      createWorkDir('ab/123456');
      const content = '2024-01-01 12:00:00.123 [ab/123456] Submitted process > foo:bar\n';
      const logPath = createLogFile(content);
      const result = await parseNextflowLog(logPath);

      expect(result.group[0].name).toBe('foo');
      expect(result.group[0].group[0].name).toBe('bar');
      expect(result.group[0].group[0].process[0].status).toBe('submitted');
    });
  });

  describe('completed event', () => {
    it('adds a process with completed status', async () => {
      const content = '2024-01-01 12:00:00.123 Task completed > name: foo; status: COMPLETED;\n';
      const logPath = createLogFile(content);
      const result = await parseNextflowLog(logPath);

      expect(result.group[0].name).toBe('foo');
      expect(result.group[0].process[0].status).toBe('completed');
    });
  });

  describe('error event', () => {
    it('adds a process with error status', async () => {
      const content = "2024-01-01 12:00:00.123 Error executing process > 'foo'\n";
      const logPath = createLogFile(content);
      const result = await parseNextflowLog(logPath);

      expect(result.group[0].name).toBe('foo');
      expect(result.group[0].process[0].status).toBe('error');
    });

    it('parses exit status and command error from error block', async () => {
      const content = [
        "2024-01-01 12:00:00.123 Error executing process > 'OOMER'",
        '',
        'Caused by:',
        '  Process `OOMER` terminated with an error exit status (137)',
        '',
        'Command executed:',
        '  echo "Simulating out-of-memory error: process killed (exit code 137)"',
        '  exit 137',
        '',
        'Command exit status:',
        '  137',
        '',
        'Command output:',
        '  Simulating out-of-memory error: process killed (exit code 137)',
        '',
        'Command error:',
        '  Simulating out-of-memory error: process killed (exit code 137)',
        '',
        'Work dir:',
        '  /path/to/work/dir',
        '',
        'Tip: view the complete command output by changing to the process work dir'
      ].join('\n');
      const logPath = createLogFile(content);
      const result = await parseNextflowLog(logPath);

      expect(result.group[0].name).toBe('OOMER');
      expect(result.group[0].process).toHaveLength(1);
      const entry = result.group[0].process[0];
      expect(entry.status).toBe('error');
      expect(entry.exitStatus).toBe('137');
      expect(entry.commandError).toBe(
        'Simulating out-of-memory error: process killed (exit code 137)'
      );
      expect(entry.cause).toBe('Process `OOMER` terminated with an error exit status (137)');
    });

    it('parses multi-line command error', async () => {
      const content = [
        "2024-01-01 12:00:00.123 Error executing process > 'test'",
        '',
        'Caused by:',
        '  Process `test` terminated with an error exit status (1)',
        '',
        'Command exit status:',
        '  1',
        '',
        'Command error:',
        '  line 1: some error',
        '  line 2: more details',
        '  line 3: stack trace',
        '',
        'Work dir:',
        '  /path/to/work/dir'
      ].join('\n');
      const logPath = createLogFile(content);
      const result = await parseNextflowLog(logPath);

      const entry = result.group[0].process[0];
      expect(entry.exitStatus).toBe('1');
      expect(entry.commandError).toBe(
        'line 1: some error\nline 2: more details\nline 3: stack trace'
      );
    });

    it('handles error without command error section', async () => {
      const content = [
        "2024-01-01 12:00:00.123 Error executing process > 'bare'",
        '',
        'Caused by:',
        '  Process terminated',
        '',
        'Work dir:',
        '  /path/to/work/dir'
      ].join('\n');
      const logPath = createLogFile(content);
      const result = await parseNextflowLog(logPath);

      const entry = result.group[0].process[0];
      expect(entry.status).toBe('error');
      expect(entry.exitStatus).toBeUndefined();
      expect(entry.commandError).toBeUndefined();
      expect(entry.cause).toBe('Process terminated');
    });

    it('parses multiple error blocks in sequence', async () => {
      const content = [
        "2024-01-01 12:00:00.123 Error executing process > 'first'",
        '',
        'Command exit status:',
        '  1',
        '',
        'Command error:',
        '  first failure',
        '',
        'Work dir:',
        '  /path/to/work/dir',
        '',
        "2024-01-01 12:00:01.456 Error executing process > 'second'",
        '',
        'Command exit status:',
        '  137',
        '',
        'Command error:',
        '  out of memory',
        '',
        'Work dir:',
        '  /path/to/work/dir2'
      ].join('\n');
      const logPath = createLogFile(content);
      const result = await parseNextflowLog(logPath);

      expect(result.group).toHaveLength(2);
      expect(result.group[0].name).toBe('first');
      expect(result.group[0].process[0].exitStatus).toBe('1');
      expect(result.group[0].process[0].commandError).toBe('first failure');
      expect(result.group[1].name).toBe('second');
      expect(result.group[1].process[0].exitStatus).toBe('137');
      expect(result.group[1].process[0].commandError).toBe('out of memory');
    });
  });

  describe('aborted event', () => {
    it('adds a workflow entry with Failed status', async () => {
      const content = '2024-01-01 12:00:00.123 Session aborted -- Cause: Some error\n';
      const logPath = createLogFile(content);
      const result = await parseNextflowLog(logPath);

      expect(result.workflow).toHaveLength(1);
      expect(result.workflow[0].status).toBe('failed');
      expect(result.workflow[0].cause).toBe('Some error');
    });

    it('captures OOM cause from exit code 137', async () => {
      const content =
        "2024-01-01 12:00:00.123 Session aborted -- Cause: Process 'foo' terminated with exit code 137\n";
      const logPath = createLogFile(content);
      const result = await parseNextflowLog(logPath);

      expect(result.workflow[0].cause).toBe("Process 'foo' terminated with exit code 137");
    });

    it('captures OOM cause from OutOfMemoryError', async () => {
      const content =
        '2024-01-01 12:00:00.123 Session aborted -- Cause: Java.lang.OutOfMemoryError: Java heap space\n';
      const logPath = createLogFile(content);
      const result = await parseNextflowLog(logPath);

      expect(result.workflow[0].cause).toBe('Java.lang.OutOfMemoryError: Java heap space');
    });

    it('captures disk full cause', async () => {
      const content = '2024-01-01 12:00:00.123 Session aborted -- Cause: No space left on device\n';
      const logPath = createLogFile(content);
      const result = await parseNextflowLog(logPath);

      expect(result.workflow[0].cause).toBe('No space left on device');
    });

    it('captures timeout cause', async () => {
      const content =
        "2024-01-01 12:00:00.123 Session aborted -- Cause: Process 'foo' terminated with exit code 124\n";
      const logPath = createLogFile(content);
      const result = await parseNextflowLog(logPath);

      expect(result.workflow[0].cause).toBe("Process 'foo' terminated with exit code 124");
    });

    it('captures permission denied cause', async () => {
      const content = '2024-01-01 12:00:00.123 Session aborted -- Cause: Permission denied\n';
      const logPath = createLogFile(content);
      const result = await parseNextflowLog(logPath);

      expect(result.workflow[0].cause).toBe('Permission denied');
    });

    it('captures cause with exit code and process name', async () => {
      const content =
        "2024-01-01 12:00:00.123 Session aborted -- Cause: Process 'foo' terminated with an error exit code -- Check the process logs\n";
      const logPath = createLogFile(content);
      const result = await parseNextflowLog(logPath);

      expect(result.workflow[0].cause).toBe(
        "Process 'foo' terminated with an error exit code -- Check the process logs"
      );
    });
  });

  describe('wf_done event', () => {
    it('adds a workflow entry with Completed status', async () => {
      const content = '2024-01-01 12:00:00.123 Workflow completed\n';
      const logPath = createLogFile(content);
      const result = await parseNextflowLog(logPath);

      expect(result.workflow).toHaveLength(1);
      expect(result.workflow[0].status).toBe('completed');
    });
  });

  describe('multiple events', () => {
    it('processes mixed events in sequence', async () => {
      createWorkDir('ab/123456');
      const content = [
        "2024-01-01 12:00:00 Creating process 'foo'",
        '2024-01-01 12:00:01 Starting process > foo',
        '[2024-01-01 12:00:02] [ab/123456] Submitted process > foo',
        '2024-01-01 12:00:03 Task completed > name: foo; status: COMPLETED;',
        '2024-01-01 12:00:04 Workflow completed'
      ].join('\n');
      const logPath = createLogFile(content);
      const result = await parseNextflowLog(logPath);

      expect(result.group[0].name).toBe('foo');
      expect(result.group[0].process).toHaveLength(4);
      expect(result.group[0].process[0].status).toBe('created');
      expect(result.group[0].process[1].status).toBe('starting');
      expect(result.group[0].process[2].status).toBe('submitted');
      expect(result.group[0].process[3].status).toBe('completed');
      expect(result.workflow).toHaveLength(1);
      expect(result.workflow[0].status).toBe('completed');
    });
  });

  describe('ANSI stripping', () => {
    it('strips ANSI color codes before matching', async () => {
      createWorkDir('ab/123456');
      const content =
        '\x1b[32m2024-01-01 12:00:00.123\x1b[0m [ab/123456] Submitted process > foo\n';
      const logPath = createLogFile(content);
      const result = await parseNextflowLog(logPath);

      expect(result.group[0].process[0].status).toBe('submitted');
    });
  });

  describe('empty log', () => {
    it('returns empty workflow and group arrays', async () => {
      const content = '';
      const logPath = createLogFile(content);
      const result = await parseNextflowLog(logPath);

      expect(result.workflow).toEqual([]);
      expect(result.group).toEqual([]);
    });
  });

  describe('unmatched lines', () => {
    it('ignores lines that do not match any pattern', async () => {
      const content = [
        '2024-01-01 12:00:00 Some random log line',
        '2024-01-01 12:00:01 Another line that does not match',
        '2024-01-01 12:00:02 Workflow completed'
      ].join('\n');
      const logPath = createLogFile(content);
      const result = await parseNextflowLog(logPath);

      expect(result.workflow).toHaveLength(1);
      expect(result.workflow[0].status).toBe('completed');
    });
  });
});
