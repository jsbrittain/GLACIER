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
  const logPath = join(tmpDir, '.nextflow.log');
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
      const content = '2024-01-01 12:00:00.123 Creating process \'foo\'\n';
      const logPath = createLogFile(content);
      const result = await parseNextflowLog(logPath);

      expect(result.workflow).toEqual([]);
      expect(result.group).toHaveLength(1);
      expect(result.group[0].name).toBe('foo');
      expect(result.group[0].process).toHaveLength(1);
      expect(result.group[0].process[0].status).toBe('created');
    });

    it('adds process under nested group for colon-separated names', async () => {
      const content = '2024-01-01 12:00:00.123 Creating process \'foo:bar:baz\'\n';
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
      const content =
        '2024-01-01 12:00:00.123 Task completed > name: foo; status: COMPLETED;\n';
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
  });

  describe('aborted event', () => {
    it('adds a workflow entry with Failed status', async () => {
      const content =
        '2024-01-01 12:00:00.123 Session aborted -- Cause: Some error\n';
      const logPath = createLogFile(content);
      const result = await parseNextflowLog(logPath);

      expect(result.workflow).toHaveLength(1);
      expect(result.workflow[0].status).toBe('failed');
      expect(result.workflow[0].cause).toBe('Some error');
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
