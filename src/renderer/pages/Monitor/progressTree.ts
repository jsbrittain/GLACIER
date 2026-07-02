import { ProcessStatus } from '../../../types/types';

const STATUS_PRIORITY: Record<string, number> = {
  completed: 4,
  error: 3,
  submitted: 2,
  starting: 1,
  created: 0
};

export type TreeItemData = {
  id: string;
  label: string;
  last_update?: Date;
  logs_available?: boolean;
  status: ProcessStatus;
  progress: number;
  work_folder?: string;
  exitStatus?: string;
  commandError?: string;
  cause?: string;
};

export const isFinished = (status: ProcessStatus) =>
  status === ProcessStatus.Completed ||
  status === ProcessStatus.Error ||
  status === ProcessStatus.Stopped;

export const collectErrorPaths = (items: any[]): string[] => {
  const ids = new Set<string>();
  const walk = (nodes: any[], ancestorIds: string[]) => {
    for (const node of nodes) {
      const path = [...ancestorIds, node.id];
      if (node.status === ProcessStatus.Error) {
        path.forEach((id) => ids.add(id));
      }
      if (node.children?.length) {
        walk(node.children, path);
      }
    }
  };
  walk(items, []);
  return Array.from(ids);
};

export const addGroup = (
  parent: any[],
  group: any,
  itemIdRef: { current: number },
  processByFullName: Map<string, string>
) => {
  if (group?.process?.length) {
    group.process.forEach((p: any) => {
      const priority = STATUS_PRIORITY[p.status] ?? -1;
      const existingStatus = processByFullName.get(p.full_name);
      const existingPriority =
        existingStatus !== undefined ? (STATUS_PRIORITY[existingStatus] ?? -1) : -1;
      if (priority >= existingPriority) {
        processByFullName.set(p.full_name, p.status);
      }
    });
  }
  parent.push({
    id: String(itemIdRef.current++),
    label: group.name,
    children: [],
    last_update: group?.last_update,
    logs_available: group?.group?.length === 0,
    status: undefined,
    progress: undefined,
    work_folder: undefined,
    exitStatus: undefined,
    commandError: undefined,
    cause: undefined
  });
  const item = parent[parent.length - 1];
  if (group?.group?.length) {
    group.group.forEach((subgroup: any) =>
      addGroup(item.children, subgroup, itemIdRef, processByFullName)
    );
  }
  if (group?.process?.length > 0) {
    const lastProcess = group.process[group.process.length - 1];
    item.status = lastProcess.status;
    if (lastProcess.status === 'error') {
      item.exitStatus = lastProcess.exitStatus;
      item.commandError = lastProcess.commandError;
      item.cause = lastProcess.cause;
    }
  }
  const workFolders = group?.process?.filter((p: any) => p.work !== undefined);
  if (workFolders?.length === 1) {
    item.work_folder = workFolders[0].work;
  } else if (workFolders?.length > 1) {
    item.work_folder = workFolders[workFolders.length - 1].work;
  }
};

export const descendStatus = (child: any, status: ProcessStatus) => {
  child?.children?.forEach((grandChild: any) => {
    grandChild.status = status;
    descendStatus(grandChild, status);
  });
};

export const ascendStatus = (child: any, isWorkflowRunning: boolean): ProcessStatus => {
  if (isFinished(child.status)) {
    descendStatus(child, child.status);
  }
  if (child?.children?.length > 0) {
    const statusList = child.children.map((gc: any) => ascendStatus(gc, isWorkflowRunning));
    if (statusList.every((s: ProcessStatus) => s === ProcessStatus.Completed)) {
      child.status = ProcessStatus.Completed;
    } else if (statusList.includes(ProcessStatus.Error)) {
      child.status = ProcessStatus.Error;
    } else if (statusList.includes(ProcessStatus.Submitted)) {
      child.status = ProcessStatus.Submitted;
    } else if (!isWorkflowRunning) {
      child.status = ProcessStatus.Stopped;
    } else {
      child.status = undefined;
    }
    child.progress =
      (100 * statusList.filter((s: ProcessStatus) => s === ProcessStatus.Completed).length) /
      statusList.length;
  }
  if (!isFinished(child.status) && !isWorkflowRunning) {
    child.status = ProcessStatus.Stopped;
  }
  return child.status as ProcessStatus;
};

export const computeOverallProgress = (
  processByFullName: Map<string, string>
): { progress: number; total: number } => {
  let completed = 0;
  for (const status of processByFullName.values()) {
    if (status === 'completed') completed++;
  }
  const total = processByFullName.size;
  return {
    progress: total > 0 ? (completed / total) * 100 : 0,
    total
  };
};
