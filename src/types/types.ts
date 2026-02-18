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
