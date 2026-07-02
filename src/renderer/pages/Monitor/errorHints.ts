export interface ErrorHintEntry {
  patterns: RegExp[];
  hintKey: string;
}

export const ERROR_HINTS: ErrorHintEntry[] = [
  {
    patterns: [
      /out\s*of\s*memory/i,
      /OutOfMemoryError/,
      /\boom\b/i,
      /cannot allocate memory/i,
      /requirement exceeds available memory/i,
      /exceeds available memory/i,
      /std::bad_alloc/,
      /\bKilled\b/,
      /exit\s*(?:code|status)\s*137/,
      /exit\s*(?:code|status)\s*134/,
      /137\b/
    ],
    hintKey: 'monitor.progress.hint-oom'
  },
  {
    patterns: [
      /no\s*space\s*left/i,
      /disk\s*quota/i,
      /[Dd]isk\s*[Ff]ull/,
      /quota\s*exceeded/i,
      /cannot write/i,
      /No space left on device/
    ],
    hintKey: 'monitor.progress.hint-disk'
  },
  {
    patterns: [
      /timeout/i,
      /timed?\s*out/i,
      /time.?limit/i,
      /TIME_LIMIT/,
      /exit\s*(?:code|status)\s*124/
    ],
    hintKey: 'monitor.progress.hint-timeout'
  },
  {
    patterns: [
      /permission\s*denied/i,
      /PermissionDenied/,
      /EACCES/,
      /access\s*denied/i,
      /not executable/i
    ],
    hintKey: 'monitor.progress.hint-permission'
  }
];

export function findErrorHint(cause: string): string | undefined {
  for (const entry of ERROR_HINTS) {
    for (const pattern of entry.patterns) {
      if (pattern.test(cause)) {
        return entry.hintKey;
      }
    }
  }
  return undefined;
}
