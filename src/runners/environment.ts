import { EnvironmentKey } from '../types/environment.js';
import { nextflowStatus, nextflowAction } from '../runners/nextflow/environment.js';

export async function getEnvironmentStatus(key: string) {
  switch (key) {
    case EnvironmentKey.Nextflow:
      return nextflowStatus();
    default:
      throw new Error(`Unknown environment key: ${key}`);
  }
}

export async function performEnvironmentAction(
  key: string,
  action: string,
  onProgress?: (msg: string) => void
) {
  switch (key) {
    case EnvironmentKey.Nextflow:
      return nextflowAction(action, onProgress);
    default:
      throw new Error(`Unknown environment key: ${key}`);
  }
}
