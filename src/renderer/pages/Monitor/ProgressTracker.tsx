import React, { useEffect, useState, useRef, useReducer } from 'react';
import {
  Box,
  Typography,
  Alert,
  IconButton,
  LinearProgress,
  TextField,
  Tooltip,
  Chip,
  Collapse,
  Menu,
  MenuItem,
} from '@mui/material';
import { RichTreeView } from '@mui/x-tree-view/RichTreeView';
import { TreeItem, TreeItemProps } from '@mui/x-tree-view/TreeItem';
import { useTreeItemModel } from '@mui/x-tree-view/hooks';
import DoneIcon from '@mui/icons-material/Done';
import CancelIcon from '@mui/icons-material/Cancel';
import PendingIcon from '@mui/icons-material/Pending';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import SearchIcon from '@mui/icons-material/Search';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { formatRelative } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { keyframes } from '@mui/system';

import { API } from '../../services/api.js';
import { WorkflowStatus, ProcessStatus } from '../../../types/types.js';
import { getDateLocale } from '../../../locales';
import { findErrorHint } from './errorHints.js';
import ProcessLogViewer from './ProcessLogViewer.js';
import {
  TreeItemData,
  isFinished,
  collectErrorPaths,
  addGroup,
  ascendStatus,
  computeOverallProgress,
} from './progressTree.js';

const SECOND = 1000;

const pulse = keyframes`
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(0.9); }
`;

const flash = keyframes`
  0% { background-color: rgba(255, 193, 7, 0.3); }
  100% { background-color: transparent; }
`;

const progressColor = (status: ProcessStatus | undefined) => {
  switch (status) {
    case ProcessStatus.Completed:
      return 'success';
    case ProcessStatus.Error:
      return 'error';
    case ProcessStatus.Submitted:
      return 'info';
    default:
      return 'inherit';
  }
};

const StatusIcon = ({ status }: { status: ProcessStatus | undefined }) => {
  const iconSx: Record<string, any> = { fontSize: 20, display: 'flex' };
  switch (status) {
    case ProcessStatus.Completed:
      return <DoneIcon sx={{ ...iconSx, color: 'success.main' }} />;
    case ProcessStatus.Error:
      return <CancelIcon sx={{ ...iconSx, color: 'error.main' }} />;
    case ProcessStatus.Submitted:
      return <PlayCircleIcon sx={{ ...iconSx, color: 'info.main', animation: `${pulse} 1.5s infinite` }} />;
    case ProcessStatus.Starting:
    case ProcessStatus.Created:
      return <HourglassEmptyIcon sx={{ ...iconSx, color: 'text.disabled' }} />;
    default:
      return <PendingIcon sx={{ ...iconSx, color: 'text.disabled' }} />;
  }
};

type LogIDContextType = { logID: string; setLogID: (id: string) => void };
const LogIDContext = React.createContext<LogIDContextType>(null as any);

type InstanceCtx = { instance: any; isWorkflowRunning: boolean };
const GetInstanceContext = React.createContext<InstanceCtx | null>(null);

const ChangedContext = React.createContext<Set<string>>(new Set());

interface CustomLabelProps {
  children: string;
  className: string;
  id: string;
  last_update: Date;
  logs_available: boolean;
  status: ProcessStatus;
  progress: number;
  work_folder?: string;
  exitStatus?: string;
  commandError?: string;
}

function CustomLabel({
  children,
  className,
  id,
  last_update,
  logs_available,
  status,
  progress: progressVal,
  work_folder,
  exitStatus,
  commandError,
}: CustomLabelProps) {
  const { t } = useTranslation();
  const [showLog, setShowLog] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [showError, setShowError] = useState(true);
  const { setLogID } = React.useContext(LogIDContext);
  const ctx = React.useContext(GetInstanceContext);
  const changedIds = React.useContext(ChangedContext);
  const instance = ctx?.instance;
  const isWorkflowRunning = ctx?.isWorkflowRunning ?? false;
  const currentLocale = getDateLocale();
  const menuOpen = Boolean(anchorEl);

  const handleViewLog = () => {
    setShowLog(true);
    setLogID(id);
    setAnchorEl(null);
  };

  const handleHideLog = () => {
    setShowLog(false);
    setAnchorEl(null);
  };

  const hasCustomError =
    status === ProcessStatus.Error && commandError && exitStatus;

  const finished = isFinished(status as ProcessStatus);

  return (
    <Box
      className={className}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        animation: changedIds.has(id) ? `${flash} 1.5s ease-out` : undefined,
        borderRadius: 1,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          gap: 1,
          py: 0.5,
        }}
      >
        <StatusIcon status={status} />

        <Typography
          variant="body2"
          sx={{
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontWeight: status === ProcessStatus.Error ? 600 : 400,
          }}
        >
          {children}
        </Typography>

        {last_update && (
          <Typography variant="caption" sx={{ color: 'text.secondary', flexShrink: 0 }}>
            {formatRelative(last_update, new Date(), { locale: currentLocale })}
          </Typography>
        )}

        {!finished && !isWorkflowRunning && (
          <Chip label={t('monitor.progress.stopped')} size="small" variant="outlined" color="warning" />
        )}

        {status !== ProcessStatus.Created && status !== ProcessStatus.Starting && (
          <Box sx={{ width: 90, flexShrink: 0 }}>
            {progressVal !== undefined ? (
              <Tooltip title={`${Math.round(progressVal)}%`}>
                <LinearProgress
                  variant="determinate"
                  value={progressVal}
                  color={progressColor(status) as any}
                  sx={{
                    height: 6,
                    borderRadius: 3,
                    transition: 'all 0.5s ease',
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 3,
                      transition: 'transform 0.5s ease',
                    },
                  }}
                />
              </Tooltip>
            ) : (
              isWorkflowRunning &&
              !finished && (
                <LinearProgress
                  sx={{
                    height: 6,
                    borderRadius: 3,
                    transition: 'all 0.5s ease',
                  }}
                />
              )
            )}
          </Box>
        )}

        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            setAnchorEl(e.currentTarget);
          }}
          disabled={!logs_available}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
        <Menu anchorEl={anchorEl} open={menuOpen} onClose={() => setAnchorEl(null)}>
          {showLog ? (
            <MenuItem onClick={handleHideLog}>{t('monitor.progress.hide-log')}</MenuItem>
          ) : (
            <MenuItem onClick={handleViewLog}>{t('monitor.progress.view-log')}</MenuItem>
          )}
        </Menu>
      </Box>

      {showLog && (
        <ProcessLogViewer
          instance={instance}
          workFolder={work_folder}
          onHide={handleHideLog}
        />
      )}

      {hasCustomError && (
        <Box
          sx={{
            border: '1px solid',
            borderColor: 'error.main',
            borderRadius: 1,
            mt: 1,
            width: '100%',
            bgcolor: 'error.light',
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              p: 1.5,
              pb: showError ? 0 : 1.5,
              cursor: 'pointer',
              userSelect: 'none',
            }}
            onClick={() => setShowError(!showError)}
          >
            <ErrorOutlineIcon fontSize="small" color="error" />
            <Typography variant="subtitle2" color="error">
              {t('monitor.progress.command-error')}
            </Typography>
            {exitStatus === '137' && (
              <Chip label={t('monitor.progress.oom-killed')} size="small" color="error" variant="outlined" />
            )}
            {exitStatus && exitStatus !== '137' && (
              <Chip
                label={t('monitor.progress.exit-status', { code: exitStatus })}
                size="small"
                color="error"
                variant="outlined"
              />
            )}
            <Box sx={{ flex: 1 }} />
            <IconButton size="small" sx={{ p: 0 }}>
              {showError ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </IconButton>
          </Box>
          <Collapse in={showError}>
            <Box
              component="pre"
              sx={{
                m: 0,
                p: 1.5,
                pt: 1,
                bgcolor: 'rgba(0,0,0,0.06)',
                fontSize: '0.8rem',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: 200,
                overflow: 'auto',
              }}
            >
              {commandError}
            </Box>
          </Collapse>
        </Box>
      )}
    </Box>
  );
}

const CustomTreeItem = React.forwardRef(function CustomTreeItem(
  props: TreeItemProps,
  ref: React.Ref<HTMLLIElement>
) {
  const item = useTreeItemModel<TreeItemData>(props.itemId)!;
  return (
    <TreeItem
      {...props}
      ref={ref}
      slots={{ label: CustomLabel }}
      slotProps={{
        label: {
          id: item.id,
          last_update: item?.last_update,
          logs_available: item?.logs_available,
          status: item?.status,
          progress: item?.progress,
          work_folder: item?.work_folder,
          exitStatus: item?.exitStatus,
          commandError: item?.commandError,
        } as CustomLabelProps,
      }}
    />
  );
});

const formatDuration = (start?: string, end?: string): string => {
  if (!start) return '';
  try {
    const from = new Date(start).getTime();
    if (isNaN(from)) return '';
    const to = end ? new Date(end).getTime() : Date.now();
    if (isNaN(to)) return '';
    const diffMs = Math.max(0, to - from);
    const totalSec = Math.floor(diffMs / 1000);
    if (totalSec === 0) return '< 1s';
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  } catch {
    return '';
  }
};

const FormatWorkflowStatus = ({
  workflowStatus,
  isWorkflowRunning,
  overallProgress,
  totalProcessCount,
  launchTime,
  lastUpdate,
  onCollapseAll,
  onExpandAll,
}: {
  workflowStatus: WorkflowStatus;
  isWorkflowRunning: boolean;
  overallProgress: number;
  totalProcessCount: number;
  launchTime?: string;
  lastUpdate?: string;
  onCollapseAll: () => void;
  onExpandAll: () => void;
}) => {
  const { t } = useTranslation();

  let chipColor: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' =
    'default';
  let chipLabel: string;
  let progressColor: 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' =
    'primary';

  const statusLabel =
    workflowStatus === WorkflowStatus.Undefined
      ? isWorkflowRunning
        ? 'running'
        : 'loading'
      : workflowStatus;

  chipLabel = t('monitor.progress.' + statusLabel);

  if (workflowStatus === WorkflowStatus.Failed) {
    chipColor = 'error';
    progressColor = 'error';
  } else if (workflowStatus === WorkflowStatus.Completed) {
    chipColor = 'success';
    progressColor = 'success';
  } else if (workflowStatus === WorkflowStatus.Running || workflowStatus === WorkflowStatus.Undefined) {
    chipColor = 'info';
    progressColor = 'info';
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Chip label={chipLabel} color={chipColor} size="small" variant="filled" />
          {overallProgress > 0 && (
            <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
              {Math.round(overallProgress)}%
            </Typography>
          )}
          {launchTime && workflowStatus !== WorkflowStatus.Created && (
            <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
              {isWorkflowRunning || !lastUpdate
                ? formatDuration(launchTime)
                : formatDuration(launchTime, lastUpdate)}
            </Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title={t('monitor.progress.collapse-all')}>
            <IconButton size="small" onClick={onCollapseAll}>
              <UnfoldLessIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={t('monitor.progress.expand-all')}>
            <IconButton size="small" onClick={onExpandAll}>
              <UnfoldMoreIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
      {totalProcessCount > 0 && (
        <LinearProgress
          variant="determinate"
          value={overallProgress}
          color={progressColor as any}
          sx={{
            height: 8,
            borderRadius: 4,
            transition: 'all 0.5s ease',
            '& .MuiLinearProgress-bar': {
              borderRadius: 4,
              transition: 'transform 0.5s ease',
            },
          }}
        />
      )}
    </Box>
  );
};

const filterTree = (items: any[], query: string): any[] => {
  if (!query) return items;
  const lower = query.toLowerCase();
  return items
    .map((item) => {
      const childMatch = item.children?.length
        ? filterTree(item.children, query)
        : [];
      const selfMatch = item.label.toLowerCase().includes(lower);
      if (selfMatch || childMatch.length > 0) {
        return { ...item, children: childMatch.length > 0 ? childMatch : item.children };
      }
      return null;
    })
    .filter(Boolean);
};

export default function ProgressTracker({ instance }: { instance: any }) {
  const { t } = useTranslation();
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus>(WorkflowStatus.Undefined);
  const [items, setItems] = useState<any[]>([]);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [hintKey, setHintKey] = useState<string | undefined>(undefined);
  const [logID, setLogID] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [changedItemIds, setChangedItemIds] = useState<Set<string>>(new Set());
  const itemIdRef = useRef(0);
  const prevItemsRef = useRef<any[]>([]);

  // Force re-render every second so live duration updates smoothly
  const [, forceRender] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    const timer = setInterval(() => forceRender(), 1000);
    return () => clearInterval(timer);
  }, [forceRender]);

  const isWorkflowRunning =
    workflowStatus !== WorkflowStatus.Completed && workflowStatus !== WorkflowStatus.Failed;

  const processByFullNameRef = useRef(new Map<string, string>());

  const { progress: overallProgress, total: totalProcessCount } = React.useMemo(
    () => computeOverallProgress(processByFullNameRef.current),
    [items]
  );

  useEffect(() => {
    const fetchAll = () => {
      API.getInstanceProgress(instance).then((result) => {
        if (!result.ok) return;
        const report = result.data;
        const workflowEvents = report?.workflow;
        let workflowStatus = WorkflowStatus.Undefined;
        if (workflowEvents && workflowEvents.length > 0) {
          let s: string = WorkflowStatus.Created;
          for (let i = workflowEvents.length - 1; i >= 0; i--) {
            if (s === WorkflowStatus.Completed && workflowEvents[i].status !== WorkflowStatus.Completed) {
              s = workflowEvents[i].status;
              break;
            } else {
              s = workflowEvents[i].status;
            }
          }
          workflowStatus = s as WorkflowStatus;
        }
        setWorkflowStatus(workflowStatus);

        let hint: string | undefined;
        if (workflowStatus === WorkflowStatus.Failed && workflowEvents) {
          const failedEvent = workflowEvents.find((e: any) => e.status === WorkflowStatus.Failed);
          const cause: string | undefined = failedEvent?.cause;
          if (cause) hint = findErrorHint(cause);
        }
        setHintKey(hint);

        const isRunning =
          workflowStatus !== WorkflowStatus.Completed && workflowStatus !== WorkflowStatus.Failed;

        itemIdRef.current = 0;
        const newItems: any[] = [];
        const newProcessMap = new Map<string, string>();
        report?.group?.forEach((group: any) =>
          addGroup(newItems, group, itemIdRef, newProcessMap),
        );
        processByFullNameRef.current = newProcessMap;
        newItems.forEach((group) => ascendStatus(group, isRunning));

        setExpandedItems((prev) => {
          const errors = collectErrorPaths(newItems);
          return errors.length ? Array.from(new Set([...prev, ...errors])) : prev;
        });

        const prev = prevItemsRef.current;
        const changed = new Set<string>();
        const walk = (nodes: any[], prevNodes: any[]) => {
          nodes.forEach((node, i) => {
            const prevNode = prevNodes[i];
            if (prevNode && node.status !== prevNode.status) {
              changed.add(node.id);
            }
            if (node.children?.length && prevNode?.children?.length) {
              walk(node.children, prevNode.children);
            }
          });
        };
        walk(newItems, prev);
        if (changed.size > 0) {
          setChangedItemIds(changed);
          setTimeout(() => setChangedItemIds(new Set()), 1500);
        }
        prevItemsRef.current = newItems;
        setItems(newItems);
      });
    };

    fetchAll();
    const interval = setInterval(fetchAll, 5 * SECOND);
    return () => clearInterval(interval);
  }, [instance]);

  const filteredItems = React.useMemo(() => filterTree(items, searchQuery), [items, searchQuery]);

  const handleCollapseAll = () => setExpandedItems([]);
  const handleExpandAll = () => {
    const ids = items.flatMap((item) => {
      const collect = (node: any): string[] => {
        const result = [node.id];
        if (node.children?.length) {
          node.children.forEach((c: any) => result.push(...collect(c)));
        }
        return result;
      };
      return collect(item);
    });
    setExpandedItems(ids);
  };

  return (
    <Box sx={{ display: 'flex', gap: 2, height: '100%' }}>
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
        <FormatWorkflowStatus
          workflowStatus={workflowStatus}
          isWorkflowRunning={isWorkflowRunning}
          overallProgress={overallProgress}
          totalProcessCount={totalProcessCount}
          launchTime={instance.launch_time}
          lastUpdate={instance.last_update}
          onCollapseAll={handleCollapseAll}
          onExpandAll={handleExpandAll}
        />
        {hintKey && (
          <Alert severity="warning" sx={{ mt: 1 }}>
            {t(hintKey)}
          </Alert>
        )}

        {items.length > 0 && (
          <TextField
            size="small"
            placeholder={t('monitor.progress.search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ mt: 1 }}
            slotProps={{
              input: {
                startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />,
              },
            }}
          />
        )}

        <Box sx={{ flex: 1, minHeight: 0, minWidth: 0, overflow: 'auto', mt: 1 }}>
          {filteredItems.length > 0 ? (
            <LogIDContext.Provider value={{ logID, setLogID }}>
              <GetInstanceContext.Provider value={{ instance, isWorkflowRunning }}>
                <ChangedContext.Provider value={changedItemIds}>
                <RichTreeView
                  items={filteredItems}
                  slots={{ item: CustomTreeItem }}
                  expandedItems={expandedItems}
                  onExpandedItemsChange={(event, value) => setExpandedItems(value)}
                />
                </ChangedContext.Provider>
              </GetInstanceContext.Provider>
            </LogIDContext.Provider>
          ) : searchQuery ? (
            <Typography sx={{ color: 'text.secondary', mt: 2 }}>
              {t('monitor.progress.no-search-results')}
            </Typography>
          ) : workflowStatus === WorkflowStatus.Failed ? (
            <Typography color="error">{t('monitor.progress.workflow-failure')}</Typography>
          ) : (
            <Typography sx={{ color: 'text.secondary' }}>
              {t('monitor.progress.waiting-for-report')}
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
}
