import { describe, it, expect } from 'vitest';
import { findErrorHint } from '../../../src/renderer/pages/Monitor/errorHints';

describe('findErrorHint', () => {
  describe('OOM / memory', () => {
    it('detects "out of memory"', () => {
      expect(findErrorHint('Process \'foo\' terminated with out of memory error')).toBe(
        'monitor.progress.hint-oom'
      );
    });

    it('detects "OutOfMemoryError"', () => {
      expect(findErrorHint('Java.lang.OutOfMemoryError: Java heap space')).toBe(
        'monitor.progress.hint-oom'
      );
    });

    it('detects "cannot allocate memory"', () => {
      expect(findErrorHint('Cannot allocate memory')).toBe('monitor.progress.hint-oom');
    });

    it('detects "std::bad_alloc"', () => {
      expect(findErrorHint('terminate called after throwing an instance of std::bad_alloc')).toBe(
        'monitor.progress.hint-oom'
      );
    });

    it('detects "Killed"', () => {
      expect(findErrorHint('Process \'foo\' terminated with signal: Killed')).toBe(
        'monitor.progress.hint-oom'
      );
    });

    it('detects exit code 137', () => {
      expect(findErrorHint('Process \'foo\' terminated with exit code 137')).toBe(
        'monitor.progress.hint-oom'
      );
    });

    it('detects "exit status 137"', () => {
      expect(findErrorHint('Command exit status: 137')).toBe('monitor.progress.hint-oom');
    });

    it('detects exit code 134 (SIGABRT)', () => {
      expect(findErrorHint('Process \'foo\' terminated with exit code 134')).toBe(
        'monitor.progress.hint-oom'
      );
    });

    it('detects bare 137 in cause text', () => {
      expect(findErrorHint('Error 137 occurred')).toBe('monitor.progress.hint-oom');
    });

    it('detects "OOM" as a standalone word', () => {
      expect(findErrorHint('OOM error detected')).toBe('monitor.progress.hint-oom');
    });
  });

  describe('disk space', () => {
    it('detects "no space left"', () => {
      expect(findErrorHint('No space left on device')).toBe('monitor.progress.hint-disk');
    });

    it('detects "disk quota"', () => {
      expect(findErrorHint('Disk quota exceeded')).toBe('monitor.progress.hint-disk');
    });

    it('detects "DiskFull"', () => {
      expect(findErrorHint('DiskFull')).toBe('monitor.progress.hint-disk');
    });

    it('detects "quota exceeded"', () => {
      expect(findErrorHint('Home directory quota exceeded')).toBe('monitor.progress.hint-disk');
    });

    it('detects "cannot write"', () => {
      expect(findErrorHint('Cannot write to file')).toBe('monitor.progress.hint-disk');
    });
  });

  describe('timeout', () => {
    it('detects "timeout"', () => {
      expect(findErrorHint('Timeout error')).toBe('monitor.progress.hint-timeout');
    });

    it('detects "timed out"', () => {
      expect(findErrorHint('Process timed out')).toBe('monitor.progress.hint-timeout');
    });

    it('detects "time limit"', () => {
      expect(findErrorHint('Time limit reached')).toBe('monitor.progress.hint-timeout');
    });

    it('detects "TIME_LIMIT"', () => {
      expect(findErrorHint('DUE TO TIME_LIMIT')).toBe('monitor.progress.hint-timeout');
    });

    it('detects exit code 124', () => {
      expect(findErrorHint('Process \'foo\' terminated with exit code 124')).toBe(
        'monitor.progress.hint-timeout'
      );
    });
  });

  describe('permission', () => {
    it('detects "permission denied"', () => {
      expect(findErrorHint('Permission denied')).toBe('monitor.progress.hint-permission');
    });

    it('detects "PermissionDenied"', () => {
      expect(findErrorHint('PermissionDenied: access issue')).toBe(
        'monitor.progress.hint-permission'
      );
    });

    it('detects "EACCES"', () => {
      expect(findErrorHint('EACCES: cannot open file')).toBe('monitor.progress.hint-permission');
    });

    it('detects "access denied"', () => {
      expect(findErrorHint('Access denied to resource')).toBe('monitor.progress.hint-permission');
    });

    it('detects "not executable"', () => {
      expect(findErrorHint('File is not executable')).toBe('monitor.progress.hint-permission');
    });
  });

  describe('unknown causes', () => {
    it('returns undefined for empty string', () => {
      expect(findErrorHint('')).toBeUndefined();
    });

    it('returns undefined for generic error text', () => {
      expect(findErrorHint('Unknown error occurred')).toBeUndefined();
    });

    it('returns undefined for exit code 1', () => {
      expect(findErrorHint('Process \'foo\' terminated with exit code 1')).toBeUndefined();
    });

    it('returns undefined for exit code 139 (segfault)', () => {
      expect(findErrorHint('Process \'foo\' terminated with exit code 139')).toBeUndefined();
    });
  });

  describe('first match wins (priority order)', () => {
    it('returns OOM hint when both OOM and disk patterns match', () => {
      expect(
        findErrorHint('OutOfMemoryError: no space left on device')
      ).toBe('monitor.progress.hint-oom');
    });
  });
});
