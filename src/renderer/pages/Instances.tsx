import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  LinearProgress,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
  List,
  ListItem,
  ListItemText,
  TextField,
  InputAdornment,
  Select,
  FormControl,
  InputLabel,
  FormControlLabel,
  Checkbox
} from '@mui/material';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SearchIcon from '@mui/icons-material/Search';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import { API } from '../services/api.js';
import { useTranslation } from 'react-i18next';
import { WorkflowStatus } from '../../types/types';
import { SettingsKey } from '../../types/settings';
import MonitorPage from './Monitor/Monitor';
import ParametersPage from './Parameters/Parameters';
function formatDiskSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

function formatAbsoluteTime(ts: string | null | undefined): string {
  if (!ts) return '-';
  try {
    const d = new Date(ts);
    return d.toLocaleString();
  } catch {
    return ts;
  }
}

function formatDuration(start?: string | null, end?: string | null): string {
  if (!start) return '-';
  try {
    const from = new Date(start).getTime();
    if (isNaN(from)) return '-';
    let to: number;
    if (end) {
      to = new Date(end).getTime();
      if (isNaN(to)) return '-';
    } else {
      to = Date.now();
    }
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
    return '-';
  }
}

const statusColor = (status: string | undefined) => {
  switch (status) {
    case WorkflowStatus.Created:
      return 'primary';
    case WorkflowStatus.Running:
      return 'secondary';
    case WorkflowStatus.Completed:
      return 'success';
    case WorkflowStatus.Closed:
      return 'default';
    case WorkflowStatus.Failed:
      return 'error';
    default:
      return 'default';
  }
};

const InstanceAccordion = React.memo(function InstanceAccordion({
  instance,
  instanceName,
  workflowName,
  refreshInstancesList,
  setItem,
  setInitialMonitorTab,
  handleWipeInstance,
  expanded,
  onToggle
}) {
  const { t } = useTranslation();
  const [diskUsage, setDiskUsage] = useState<number | null>(null);
  const [diskLoading, setDiskLoading] = useState(false);
  const [hideDialogOpen, setHideDialogOpen] = useState(false);

  const status = instance.status || WorkflowStatus.Unknown;
  const progress = instance.progress ?? 0;

  const isCreated = status === WorkflowStatus.Created;

  const handleOpenReports = () => {
    setInitialMonitorTab(1);
    setItem(instanceName);
  };

  const handleOpenDetails = () => {
    setInitialMonitorTab(0);
    setItem(instanceName);
  };

  const handleHide = async () => {
    setHideDialogOpen(false);
    const result = await API.hideWorkflowInstance(instance);
    if (result.ok) refreshInstancesList();
  };

  const handleAccordionChange = async (_event, isExpanded) => {
    onToggle(isExpanded ? instanceName : null);
    if (isExpanded && diskUsage === null && !diskLoading) {
      setDiskLoading(true);
      const result = await API.getInstanceDiskUsage(instance);
      if (result.ok) setDiskUsage(result.data);
      setDiskLoading(false);
    }
  };

  return (
    <>
      <Accordion
        expanded={expanded}
        onChange={handleAccordionChange}
        sx={{ '&:before': { display: 'none' } }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              width: '100%',
              pr: 2
            }}
          >
            <Chip
              label={t('instances.statuses.' + status) || status}
              color={statusColor(status) as any}
              size="small"
              variant="outlined"
              sx={{ width: 80, flexShrink: 0, fontWeight: 500 }}
            />
            <Typography
              sx={{
                width: 180,
                flexShrink: 0,
                fontWeight: 500,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {instanceName}
            </Typography>
            <Typography
              sx={{
                width: 180,
                flexShrink: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
              color="text.secondary"
            >
              {workflowName}
            </Typography>
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              {isCreated ? (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ minWidth: 40, textAlign: 'right' }}
                >
                  {t('instances.not_started')}
                </Typography>
              ) : (
                <>
                  <LinearProgress
                    variant="determinate"
                    value={progress}
                    sx={{
                      flex: 1,
                      height: 8,
                      borderRadius: 4,
                      '& .MuiLinearProgress-bar': { borderRadius: 4 }
                    }}
                  />
                  <Typography variant="body2" sx={{ minWidth: 40, textAlign: 'right' }}>
                    {progress}%
                  </Typography>
                </>
              )}
            </Box>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pl: 1, pr: 1 }}>
            {/* Timing section */}
            <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  {t('instances.launch_time')}
                </Typography>
                <Typography variant="body2">{formatAbsoluteTime(instance.launch_time)}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  {t('instances.last_update')}
                </Typography>
                <Tooltip title={t('instances.last_update_tooltip')}>
                  <Typography variant="body2">
                    {formatAbsoluteTime(instance.last_update)}
                  </Typography>
                </Tooltip>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  {t('instances.duration')}
                </Typography>
                <Typography variant="body2">
                  {instance.status === WorkflowStatus.Created
                    ? '-'
                    : instance.status === WorkflowStatus.Running
                      ? formatDuration(instance.launch_time)
                      : instance.last_update
                        ? formatDuration(instance.launch_time, instance.last_update)
                        : '-'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  {t('instances.disk_usage')}
                </Typography>
                <Typography variant="body2">
                  {diskLoading
                    ? t('instances.disk_usage_loading')
                    : diskUsage !== null
                      ? formatDiskSize(diskUsage)
                      : '-'}
                </Typography>
              </Box>
            </Box>

            {/* Action buttons */}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
              <Button variant="outlined" size="small" onClick={handleOpenDetails}>
                {t('instances.view_details')}
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={handleOpenReports}
                disabled={isCreated}
              >
                {t('instances.open_reports')}
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={() => API.openResultsFolder(instance)}
              >
                {t('instances.open_output_folder')}
              </Button>
              <Box sx={{ flex: 1 }} />
              <Button
                variant="contained"
                size="small"
                color="error"
                onClick={() => handleWipeInstance(instance, instanceName)}
              >
                {t('instances.wipe')}
              </Button>
              <Button variant="outlined" size="small" onClick={() => setHideDialogOpen(true)}>
                {t('instances.hide')}
              </Button>
            </Box>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Hide confirmation dialog */}
      <Dialog
        open={hideDialogOpen}
        onClose={() => setHideDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t('instances.hide_title')}</DialogTitle>
        <DialogContent>
          <Typography>{t('instances.hide_confirm', { name: instanceName })}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {t('instances.hide_info')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHideDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleHide} variant="contained">
            {t('instances.hide')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
});

export default function InstancesPage({

  instancesList,
  refreshInstancesList,
  logMessage,
  item,
  setItem,
  showHiddenParams
}) {
  const { t } = useTranslation();

  const [editingInstance, setEditingInstance] = useState<string | null>(null);
  const [justLaunchedId, setJustLaunchedId] = useState<string | null>(null);
  const [initialMonitorTab, setInitialMonitorTab] = useState(0);
  const [wipeDialogOpen, setWipeDialogOpen] = useState(false);
  const [wipeTarget, setWipeTarget] = useState<{ instance: any; name: string } | null>(null);
  const [wipeOutputs, setWipeOutputs] = useState(false);
  const [wipeOutputAvailable, setWipeOutputAvailable] = useState(false);
  const [expandedAccordion, setExpandedAccordion] = useState<string | null>(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [hiddenDialogOpen, setHiddenDialogOpen] = useState(false);
  const [hiddenInstances, setHiddenInstances] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'launch-date'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const dirDefaults = { name: 'asc', 'launch-date': 'desc' } as const;

  // Load saved sort preferences on mount
  useEffect(() => {
    API.settingsGet(SettingsKey.InstanceSortBy).then((result) => {
      if (result.ok && result.data) {
        setSortBy(result.data as 'name' | 'launch-date');
      }
    });
    API.settingsGet(SettingsKey.InstanceSortDir).then((result) => {
      if (result.ok && result.data) {
        setSortDir(result.data as 'asc' | 'desc');
      }
    });
  }, []);

  // Save sort preferences on change
  useEffect(() => {
    API.settingsSet(SettingsKey.InstanceSortBy, sortBy);
  }, [sortBy]);
  useEffect(() => {
    API.settingsSet(SettingsKey.InstanceSortDir, sortDir);
  }, [sortDir]);

  // Reset direction to field default when sort field changes
  useEffect(() => {
    setSortDir(dirDefaults[sortBy]);
  }, [sortBy]);

  const onEditComplete = () => {
    setEditingInstance(null);
  };

  const onLaunchSuccess = (instanceId: string) => {
    setJustLaunchedId(instanceId);
  };

  useEffect(() => {
    if (item === '') setJustLaunchedId(null);
  }, [item]);

  // Poll instances list every 5 seconds when in list view
  useEffect(() => {
    if (item !== '') return;
    refreshInstancesList();
    const timer = setInterval(() => {
      refreshInstancesList();
    }, 5000);
    return () => clearInterval(timer);
  }, [item, refreshInstancesList]);

  const onRestart = (instanceId: string) => {
    setEditingInstance(instanceId);
    setItem(instanceId);
    const entry = instancesList.find(({ name }) => name === instanceId);
    if (entry) {
      API.resetWorkflowInstanceStatus(entry.instance);
    }
    refreshInstancesList();
  };

  const handleWipeInstance = useCallback((instance, name) => {
    setWipeTarget({ instance, name });
    setWipeOutputs(false);
    API.getOutputPathForInstance(instance).then((result) => {
      setWipeOutputAvailable(result.ok && !!result.data);
    });
    setWipeDialogOpen(true);
  }, []);

  const confirmWipe = async () => {
    if (!wipeTarget) return;
    const result = await API.deleteWorkflowInstance(wipeTarget.instance);
    if (result.ok) {
      if (wipeOutputs) {
        await API.deleteInstanceOutput(wipeTarget.instance);
      }
      logMessage(t('instances.wipe_success', { name: wipeTarget.name }), 'info');
      refreshInstancesList();
    }
    setWipeDialogOpen(false);
    setWipeTarget(null);
    setWipeOutputs(false);
    setWipeOutputAvailable(false);
  };

  const handleDeleteOrphaned = async () => {
    setMenuAnchorEl(null);
    if (!confirm(t('instances.delete_orphaned_confirm'))) return;
    const result = await API.deleteOrphanedInstances();
    if (result.ok) {
      logMessage(t('instances.delete_orphaned_success', { count: result.data }), 'info');
      refreshInstancesList();
    }
  };

  const handleOpenHiddenDialog = async () => {
    setMenuAnchorEl(null);
    const result = await API.listHiddenInstances();
    if (result.ok) {
      setHiddenInstances(result.data);
      setHiddenDialogOpen(true);
    }
  };

  const handleUnhide = async (inst) => {
    const result = await API.unhideWorkflowInstance(inst);
    if (result.ok) {
      const listResult = await API.listHiddenInstances();
      if (listResult.ok) setHiddenInstances(listResult.data);
    }
  };

  const handleUnhideAll = async () => {
    for (const inst of hiddenInstances) {
      await API.unhideWorkflowInstance(inst);
    }
    const listResult = await API.listHiddenInstances();
    if (listResult.ok) setHiddenInstances(listResult.data);
    refreshInstancesList();
  };

  // Reset monitor tab when returning to list view
  useEffect(() => {
    if (item === '') {
      setInitialMonitorTab(0);
      setExpandedAccordion(null);
    }
  }, [item]);

  const sortedList = useMemo(() => {
    let list = instancesList;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = instancesList.filter((entry) => {
        const status = entry.instance.status || '';
        return (
          entry.name.toLowerCase().includes(q) ||
          entry.instance.workflow_version.name.toLowerCase().includes(q) ||
          status.toLowerCase().includes(q)
        );
      });
    }
    return [...list].sort((a, b) => {
      let cmp: number;
      if (sortBy === 'launch-date') {
        const tA = a.instance.launch_time ?? '';
        const tB = b.instance.launch_time ?? '';
        cmp = tA.localeCompare(tB);
      } else {
        const wfA = a.instance.workflow_version.name.toLowerCase();
        const wfB = b.instance.workflow_version.name.toLowerCase();
        cmp =
          wfA !== wfB
            ? wfA.localeCompare(wfB)
            : a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [instancesList, searchQuery, sortBy, sortDir]);

  return (
    <Container sx={{ height: '100%' }}>
      {item === '' ? (
        <>
          {/* Triple-dot menu */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
            <IconButton onClick={(e) => setMenuAnchorEl(e.currentTarget)}>
              <MoreVertIcon />
            </IconButton>
            <Menu
              anchorEl={menuAnchorEl}
              open={Boolean(menuAnchorEl)}
              onClose={() => setMenuAnchorEl(null)}
            >
              <MenuItem onClick={handleDeleteOrphaned}>{t('instances.delete_orphaned')}</MenuItem>
              <MenuItem onClick={handleOpenHiddenDialog}>{t('instances.manage_hidden')}</MenuItem>
            </Menu>
          </Box>

          {/* Search and sort controls */}
          <Box sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
            <TextField
              fullWidth
              size="small"
              placeholder={t('instances.search_placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  )
                }
              }}
            />
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>{t('instances.sort_by')}</InputLabel>
              <Select
                value={sortBy}
                label={t('instances.sort_by')}
                onChange={(e) => setSortBy(e.target.value as 'name' | 'launch-date')}
              >
                <MenuItem value="name">{t('instances.sort_name')}</MenuItem>
                <MenuItem value="launch-date">{t('instances.sort_launch_date')}</MenuItem>
              </Select>
            </FormControl>
            <Tooltip title={sortDir === 'asc' ? t('instances.sort_asc') : t('instances.sort_desc')}>
              <IconButton
                size="small"
                onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
                sx={{
                  transform: sortDir === 'desc' ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.2s'
                }}
              >
                <ArrowUpwardIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

          {/* Accordion list */}
          {sortedList.length > 0 ? (
            <Box>
              {sortedList.map((entry) => (
                <InstanceAccordion
                  key={entry.name}
                  instance={entry.instance}
                  instanceName={entry.name}
                  workflowName={entry.instance.workflow_version.name}
                  refreshInstancesList={refreshInstancesList}
                  setItem={setItem}
                  setInitialMonitorTab={setInitialMonitorTab}
                  handleWipeInstance={handleWipeInstance}
                  expanded={expandedAccordion === entry.name}
                  onToggle={setExpandedAccordion}
                />
              ))}
            </Box>
          ) : (
            <Container>
              <Typography variant="h6" sx={{ mt: 1 }}>
                {searchQuery ? t('instances.no_results') : t('instances.no-instances')}
              </Typography>
            </Container>
          )}

          {/* Wipe confirmation dialog */}
          <Dialog
            open={wipeDialogOpen}
            onClose={() => setWipeDialogOpen(false)}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle>{t('instances.wipe_title')}</DialogTitle>
            <DialogContent>
              <Typography>
                {t('instances.wipe_confirm', { name: wipeTarget?.name || '' })}
              </Typography>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={wipeOutputs}
                    disabled={!wipeOutputAvailable}
                    onChange={(e) => setWipeOutputs(e.target.checked)}
                  />
                }
                label={t('instances.wipe_outputs')}
                sx={{ mt: 2 }}
              />
              <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                {t('instances.wipe_warning')}
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setWipeDialogOpen(false)}>{t('common.cancel')}</Button>
              <Button onClick={confirmWipe} variant="contained" color="error">
                {t('instances.wipe')}
              </Button>
            </DialogActions>
          </Dialog>

          {/* Manage hidden instances dialog */}
          <Dialog
            open={hiddenDialogOpen}
            onClose={() => setHiddenDialogOpen(false)}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle>{t('instances.manage_hidden')}</DialogTitle>
            <DialogContent>
              {hiddenInstances.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  {t('instances.no_hidden')}
                </Typography>
              ) : (
                <>
                  <Box sx={{ mb: 1 }}>
                    <Button size="small" variant="outlined" onClick={handleUnhideAll}>
                      {t('instances.show_all')}
                    </Button>
                  </Box>
                  <List dense>
                    {hiddenInstances.map((inst) => (
                      <ListItem key={inst.id} disableGutters>
                        <ListItemText primary={inst.name} secondary={inst.workflow_version?.name} />
                        <Button size="small" variant="outlined" onClick={() => handleUnhide(inst)}>
                          {t('instances.unhide')}
                        </Button>
                      </ListItem>
                    ))}
                  </List>
                </>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setHiddenDialogOpen(false)}>{t('common.close')}</Button>
            </DialogActions>
          </Dialog>
        </>
      ) : (
        /* Detail view for a selected instance */
        instancesList
          .filter(({ name }) => name === item)
          .map(({ name, instance }) => {
            const status = instancesList.find((r) => r.name === name)?.instance?.status;
            return status == WorkflowStatus.Created || editingInstance === name ? (
              <ParametersPage
                key={instance.id}
                instance={instance}
                refreshInstancesList={refreshInstancesList}
                showHiddenParams={showHiddenParams}
                logMessage={logMessage}
                onEditComplete={onEditComplete}
                onLaunchSuccess={onLaunchSuccess}
                startOnParamsTab={editingInstance === name}
              />
            ) : (
              <MonitorPage
                key={instance.id}
                instance={instance}
                logMessage={logMessage}
                onRestart={onRestart}
                initialTab={initialMonitorTab}
                showLaunchBanner={justLaunchedId === instance.id}
                onLaunchBannerDismissed={() => setJustLaunchedId(null)}
              />
            );
          })
      )}
    </Container>
  );
}
