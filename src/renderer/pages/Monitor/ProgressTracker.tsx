import React, { useEffect, useState } from 'react';
import { Box, Typography, Alert } from '@mui/material';
import { Select } from '@mui/material';
import { Button } from '@mui/material';
import IconButton from '@mui/material/IconButton';
import { API } from '../../services/api.js';
import { WorkflowStatus, ProcessStatus } from '../../../types/types.js';
import { useTranslation } from 'react-i18next';
import { RichTreeView } from '@mui/x-tree-view/RichTreeView';
import LinearProgress from '@mui/material/LinearProgress';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { formatRelative } from 'date-fns';
import { TreeItem, TreeItemProps } from '@mui/x-tree-view/TreeItem';
import { useTreeItemModel } from '@mui/x-tree-view/hooks';
import { getDateLocale } from '../../../locales';
import DoneIcon from '@mui/icons-material/Done';
import CancelIcon from '@mui/icons-material/Cancel';
import PendingIcon from '@mui/icons-material/Pending';
import AnsiLog from './AnsiLog.js';
import { findErrorHint } from './errorHints.js';

const SECOND = 1000;

const log_types = ['log', 'stdout', 'stderr', 'run', 'shell', 'trace', 'begin'];

const STATUS_ICONS = {
  created: <PendingIcon style={{ color: 'gray' }} />,
  starting: <PendingIcon style={{ color: 'gray' }} />,
  submitted: <PendingIcon style={{ color: 'blue' }} />,
  completed: <DoneIcon style={{ color: 'green' }} />,
  error: <CancelIcon style={{ color: 'red' }} />,
  stopped: <CancelIcon style={{ color: 'gray' }} />
};

const is_finished = (status: ProcessStatus) => {
  return (
    status === ProcessStatus.Completed ||
    status === ProcessStatus.Error ||
    status === ProcessStatus.Stopped
  );
};

type LogIDContextType = {
  logID: string;
  setLogID: (id: string) => void;
};

const LogIDContext = React.createContext<LogIDContextType>(null);
const GetInstanceContext = React.createContext<{ instance: any; isWorkflowRunning: boolean } | null>(null);

// X-Tree-View customisation: https://mui.com/x/react-tree-view/tree-item-customization/
type TreeItemWithLabel = {
  id: string;
  label: string;
  last_update?: Date;
  logs_available?: boolean;
  status: ProcessStatus;
  progress: number;
  work_folder?: string;
};

interface CustomLabelProps {
  children: string;
  className: string;
  id: string;
  last_update: Date;
  logs_available: boolean;
  status: ProcessStatus;
  progress: number;
  work_folder?: string;
}

function CustomLabel({
  children,
  className,
  id,
  last_update,
  logs_available,
  status,
  progress,
  work_folder
}: CustomLabelProps) {
  const { t } = useTranslation();
  const [showLog, setShowLog] = useState(false);
  const [logText, setLogText] = useState('');
  const [anchorEl, setAnchorEl] = useState(null);
  const [logType, setLogType] = useState(log_types[0]);
  const { logID, setLogID } = React.useContext(LogIDContext);
  const ctx = React.useContext(GetInstanceContext);
  const instance = ctx?.instance;
  const is_workflow_running = ctx?.isWorkflowRunning ?? false;
  const current_locale = getDateLocale();
  const menuIsOpen = Boolean(anchorEl);
  let logInterval;

  useEffect(() => {
    // Close log view if another log is opened
    if (logID !== id) {
      setShowLog(false);
      setLogText('');
    }
  }, [logID]);

  useEffect(() => {
    if (logInterval) {
      clearInterval(logInterval);
    }

    if (showLog) {
      logInterval = setInterval(() => refreshWorkLog(logType), 5 * SECOND);
    }

    return () => {
      if (logInterval) {
        clearInterval(logInterval);
      }
    };
  }, [showLog, logType]);

  const handleMenuOpen = (event) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = (event) => {
    event.stopPropagation();
    setAnchorEl(null);
  };

  const handleOpenFolder = (event) => {
    API.openWorkFolder(instance, work_folder).then((result) => {
      if (!result.ok) console.error(result.error.message);
    });
    if (event) handleMenuClose(event);
  };

  const handleOpenInEditor = (event) => {
    API.openWorkLogFile(instance, work_folder, logType).then((result) => {
      if (!result.ok) console.error(result.error.message);
    });
    if (event) handleMenuClose(event);
  };

  const handleViewLog = (event) => {
    setShowLog(true);
    refreshWorkLog(logType);
    setLogID(id);
    handleMenuClose(event);
  };

  const handleHideLog = (event) => {
    setShowLog(false);
    setLogText('');
    handleMenuClose(event);
  };

  const handleLogTypeChange = (event, log_type_index) => {
    setLogType(log_types[log_type_index.props.value]);
    refreshWorkLog(log_types[log_type_index.props.value]);
    event.stopPropagation();
  };

  const refreshWorkLog = (log_type) => {
    API.getWorkLog(instance, work_folder, log_type || logType).then((result) => {
      if (result.ok) {
        setLogText(result.data === '' ? t('monitor.progress.no-logs') : result.data);
      } else {
        setLogText(t('monitor.progress.no-logs'));
      }
    });
  };

  return (
    <Box className={className} sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {/* Regular display */}
      <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
        <Box sx={{ mr: 1 }}>
          {status ? STATUS_ICONS[status] : <PendingIcon style={{ color: 'grey' }} />}
        </Box>

        <Box sx={{ flex: 1 }}>
          <Typography>{children}</Typography>
        </Box>

        {last_update && (
          <Typography variant="caption" sx={{ m: 1, color: 'gray' }}>
            {formatRelative(last_update, new Date(), { locale: current_locale })}
          </Typography>
        )}

        <Box
          sx={{
            width: '100px',
            m: 1
          }}
        >
          {status !== ProcessStatus.Created &&
            status !== ProcessStatus.Starting &&
            (progress !== undefined ? (
              <LinearProgress variant="determinate" value={progress} />
            ) : (
              is_workflow_running && !is_finished(status) && <LinearProgress />
            ))}
        </Box>

        <IconButton onClick={handleMenuOpen} disabled={!logs_available}>
          <MoreVertIcon />
        </IconButton>
        <Menu anchorEl={anchorEl} open={menuIsOpen} onClose={handleMenuClose}>
          {showLog ? (
            <MenuItem onClick={handleHideLog}>{t('monitor.progress.hide-log')}</MenuItem>
          ) : (
            <MenuItem onClick={handleViewLog}>{t('monitor.progress.view-log')}</MenuItem>
          )}
          <MenuItem onClick={handleOpenFolder}>{t('monitor.progress.open-folder')}</MenuItem>
          <MenuItem onClick={handleOpenInEditor}>{t('monitor.progress.open-in-editor')}</MenuItem>
        </Menu>
      </Box>

      {/* Log display */}
      {logText && (
        <Box
          sx={{ border: '1px solid lightgray', borderRadius: '4px', p: 1, mt: 1, width: '100%' }}
        >
          <Box
            sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}
          >
            <Select
              value={log_types.indexOf(logType)}
              onChange={handleLogTypeChange}
              variant="standard"
              sx={{ mb: 1 }}
            >
              {log_types.map((log_type, index) => {
                return (
                  <MenuItem key={log_type} value={index}>
                    {t('monitor.logs.' + log_type)}
                  </MenuItem>
                );
              })}
            </Select>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button variant="outlined" size="small" onClick={() => handleOpenFolder()}>
                {t('monitor.progress.open-folder')}
              </Button>
              <Button variant="outlined" size="small" onClick={() => handleOpenInEditor()}>
                {t('monitor.progress.open-in-editor')}
              </Button>
              <Button variant="outlined" size="small" onClick={handleHideLog}>
                {t('monitor.progress.hide-log')}
              </Button>
            </Box>
          </Box>
          <AnsiLog text={logText} />
        </Box>
      )}
    </Box>
  );
}

const CustomTreeItem = React.forwardRef(function CustomTreeItem(
  props: TreeItemProps,
  ref: React.Ref<HTMLLIElement>
) {
  const item = useTreeItemModel<TreeItemWithLabel>(props.itemId)!;
  return (
    <TreeItem
      {...props}
      ref={ref}
      slots={{
        label: CustomLabel
      }}
      slotProps={{
        label: {
          id: item.id,
          last_update: item?.last_update,
          logs_available: item?.logs_available,
          status: item?.status,
          progress: item?.progress,
          work_folder: item?.work_folder
        } as CustomLabelProps
      }}
    />
  );
});

const FormatWorkflowStatus = ({ workflowStatus, isWorkflowRunning }: { workflowStatus: WorkflowStatus; isWorkflowRunning: boolean }) => {
  const { t } = useTranslation();

  let color_palette = 'info';
  if (workflowStatus === WorkflowStatus.Failed) {
    color_palette = 'error';
  } else if (workflowStatus === WorkflowStatus.Completed) {
    color_palette = 'success';
  }
  return (
    <Typography variant="h6" color={color_palette} gutterBottom>
      {workflowStatus === WorkflowStatus.Undefined
        ? isWorkflowRunning
          ? t('monitor.progress.running')
          : t('monitor.progress.loading')
        : t('monitor.progress.' + workflowStatus)}
    </Typography>
  );
};

const addGroup = (parent, group, itemIdRef) => {
  parent.push({
    id: String(itemIdRef.current++),
    label: group.name,
    children: [],
    last_update: group?.last_update,
    logs_available: group?.group?.length === 0,
    status: undefined,
    progress: undefined,
    work_folder: undefined
  });
  const item = parent[parent.length - 1];
  // Sub-groups
  group?.group.forEach((subgroup) => {
    addGroup(item.children, subgroup, itemIdRef);
  });
  // Extract last process state
  if (group?.process.length > 0) {
    item.status = group.process[group.process.length - 1].status;
  }
  // Extract work folder
  const work_folders = group?.process.filter((process) => process.work !== undefined);
  if (work_folders?.length === 1) {
    item.work_folder = work_folders[0].work;
  } else if (work_folders?.length > 1) {
    console.warn(
      'Multiple work folders found for process ' +
        group.name +
        ', using most recent: ' +
        work_folders
    );
    item.work_folder = work_folders[work_folders.length - 1].work;
  }
};

const descendStatus = (child, status) => {
  child?.children?.forEach((grand_child) => {
    grand_child.status = status;
    descendStatus(grand_child, status);
  });
};

const ascendStatus = (child, isWorkflowRunning) => {
  if (is_finished(child.status)) {
    descendStatus(child, child.status);
  }
  if (child?.children.length > 0) {
    const status_list = child.children.map((grand_child) => ascendStatus(grand_child, isWorkflowRunning));
    if (status_list.every((status) => status === ProcessStatus.Completed)) {
      child.status = ProcessStatus.Completed;
    } else if (status_list.includes(ProcessStatus.Error)) {
      child.status = ProcessStatus.Error;
    } else if (status_list.includes(ProcessStatus.Submitted)) {
      child.status = ProcessStatus.Submitted;
    } else if (!isWorkflowRunning) {
      // Workflow is no longer active
      child.status = ProcessStatus.Stopped;
    } else {
      child.status = undefined;
    }
    child.progress =
      (100 * status_list.filter((status) => status === ProcessStatus.Completed).length) /
      status_list.length;
  }
  if (!is_finished(child.status) && !isWorkflowRunning) {
    // Workflow is no longer active
    child.status = ProcessStatus.Stopped;
  }
  // Returns leaf status, or aggregated status for (above) children
  return child.status as ProcessStatus;
};

export default function ProgressTracker({ instance }) {
  const { t } = useTranslation();
  const [workflowStatus, setWorkflowStatus] = React.useState<WorkflowStatus>(
    WorkflowStatus.Undefined
  );
  const [items, setItems] = React.useState<any[]>([]);
  const [hintKey, setHintKey] = React.useState<string | undefined>(undefined);
  const [logID, setLogID] = React.useState<string>('');
  const itemIdRef = React.useRef(0);

  const isWorkflowRunning =
    workflowStatus !== WorkflowStatus.Completed && workflowStatus !== WorkflowStatus.Failed;

  useEffect(() => {
    const fetchAll = () => {
      API.getInstanceProgress(instance).then((result) => {
        if (!result.ok) return;
        const report = result.data;
        // Determine if workflow is still active before ascending process statuses.
        // Backward-scan to match updateWorkflowInstanceStatus logic: if the last event
        // is 'completed' but an earlier event was 'failed', report 'failed'.
        const workflowEvents = report?.workflow;
        let workflow_status = WorkflowStatus.Undefined;
        if (workflowEvents && workflowEvents.length > 0) {
          let s: string = WorkflowStatus.Created;
          for (let i = workflowEvents.length - 1; i >= 0; i--) {
            if (
              s === WorkflowStatus.Completed &&
              workflowEvents[i].status !== WorkflowStatus.Completed
            ) {
              s = workflowEvents[i].status;
              break;
            } else {
              s = workflowEvents[i].status;
            }
          }
          workflow_status = s as WorkflowStatus;
        }
        setWorkflowStatus(workflow_status);

        let hint: string | undefined;
        if (workflow_status === WorkflowStatus.Failed && workflowEvents) {
          const failedEvent = workflowEvents.find(
            (e: any) => e.status === WorkflowStatus.Failed
          );
          const cause: string | undefined = failedEvent?.cause;
          if (cause) {
            hint = findErrorHint(cause);
          }
        }
        setHintKey(hint);

        const isRunning =
          workflow_status !== WorkflowStatus.Completed && workflow_status !== WorkflowStatus.Failed;

        // Parse report into custom TreeView structure (groups and processes)
        itemIdRef.current = 0;
        const items = [];
        report?.group.forEach((group) => addGroup(items, group, itemIdRef));
        // Ascend leaf status to parent groups, and calculate progress
        items.forEach((group) => ascendStatus(group, isRunning));
        setItems(items);
      });
    };

    fetchAll(); // Initial fetch
    const interval = setInterval(fetchAll, 5 * SECOND);
    return () => clearInterval(interval);
  }, [instance]);

  return (
    <Box sx={{ display: 'flex', gap: 2, height: '100%' }}>
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
          <Box>
            <FormatWorkflowStatus workflowStatus={workflowStatus} isWorkflowRunning={isWorkflowRunning} />
            {hintKey && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                {t(hintKey)}
              </Alert>
            )}
          </Box>
          <Box sx={{ flex: 1, minHeight: 0, minWidth: 0, overflow: 'auto' }}>
          {items?.length > 0 ? (
            <LogIDContext.Provider value={{ logID, setLogID }}>
              <GetInstanceContext.Provider value={{ instance, isWorkflowRunning }}>
                <RichTreeView items={items} slots={{ item: CustomTreeItem }} />
              </GetInstanceContext.Provider>
            </LogIDContext.Provider>
          ) : workflowStatus === WorkflowStatus.Failed ? (
            <Typography color="error">{t('monitor.progress.workflow-failure')}</Typography>
          ) : (
            <Typography>{t('monitor.progress.waiting-for-report')}</Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
}
