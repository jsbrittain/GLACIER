// Frontend-backend data exchange contract
type Success<T> = {
  ok: true;
  data: T;
};

type Failure = {
  ok: false;
  error: {
    message: string;
    code?: string;
  };
};

export type Result<T> = Success<T> | Failure;

// Workflow status enumeration
export enum WorkflowStatus {
  Created = 'created',
  Running = 'running',
  Completed = 'completed',
  Closed = 'closed',
  Failed = 'failed',
  Unknown = 'unknown',
  Undefined = 'undefined'
}

// Persistent handle to an OS process (or Docker container) for lifecycle management.
// Augments a bare PID with enough metadata to detect PID reuse across restarts.
export interface ProcessDescriptor {
  pid: number;
  /** Human-readable command line used to spawn the process (for PID reuse detection) */
  cmd?: string;
  /** ISO timestamp of when this descriptor was first captured */
  startTime?: string;
  /** Docker container ID (if this is a container-backed workflow) */
  containerId?: string;
}

// Process status enumeration
export enum ProcessStatus {
  Created = 'created',
  Starting = 'starting',
  Submitted = 'submitted',
  Completed = 'completed',
  Error = 'error',
  Stopped = 'stopped',
  Unknown = 'unknown',
  Undefined = 'undefined'
}
