// filePath.tester.ts
import { and, isControl, rankWith, schemaMatches } from '@jsonforms/core';

export const filePathTester = rankWith(
  6,
  and(
    isControl,
    schemaMatches(
      (s) => s?.type === 'string' && (s?.format === 'file-path' || s?.format === 'path')
    )
  )
);

export const directoryPathTester = rankWith(
  6,
  and(
    isControl,
    schemaMatches((s) => s?.type === 'string' && s?.format === 'directory-path')
  )
);
