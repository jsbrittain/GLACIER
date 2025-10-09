// renderers.ts
import { materialRenderers } from '@jsonforms/material-renderers';
import { FilePathControl } from './FilePathControl';
import { filePathTester, directoryPathTester } from './filePath.tester';

export const renderers = [
  ...materialRenderers,
  { tester: filePathTester, renderer: FilePathControl },
  { tester: directoryPathTester, renderer: FilePathControl }
];
