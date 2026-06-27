import React, { useState, useEffect } from 'react';
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
  ListItemText
} from '@mui/material';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { API } from '../services/api.js';
import { useTranslation } from 'react-i18next';
import { WorkflowStatus } from '../../types/types';
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

const InstanceAccordion = ({
  instance,
  instanceName,
  workflowName,
  refreshInstancesList,
  setItem,
  setInitialMonitorTab,
  handleWipeInstance,
  expanded,
  onToggle
}) => {
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
                <Typography variant="body2" color="text.secondary" sx={{ minWidth: 40, textAlign: 'right' }}>
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
            {/* Progress section */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                {t('instances.progress')}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {isCreated ? (
                  <Typography variant="body2" color="text.secondary">
                    {t('instances.not_started')}
                  </Typography>
                ) : (
                  <>
                    <LinearProgress
                      variant="determinate"
                      value={progress}
                      sx={{ flex: 1, height: 12, borderRadius: 6 }}
                    />
                    <Typography variant="body2" sx={{ minWidth: 48, textAlign: 'right' }}>
                      {progress}%
                    </Typography>
                  </>
                )}
              </Box>
            </Box>

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
                  <Typography variant="body2">{formatAbsoluteTime(instance.last_update)}</Typography>
                </Tooltip>
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
              <Button variant="text" size="small" onClick={handleOpenDetails}>
                {t('instances.view_details')}
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
              <Button
                variant="outlined"
                size="small"
                onClick={() => setHideDialogOpen(true)}
              >
                {t('instances.hide')}
              </Button>
            </Box>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Hide confirmation dialog */}
      <Dialog open={hideDialogOpen} onClose={() => setHideDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('instances.hide_title')}</DialogTitle>
        <DialogContent>
          <Typography>
            {t('instances.hide_confirm', { name: instanceName })}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {t('instances.hide_info')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHideDialogOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleHide} variant="contained">
            {t('instances.hide')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default function InstancesPage({
  instancesList,
  refreshInstancesList,
  logMessage,
  item,
  setItem,
  showHiddenParams
}) {
  const { t } = useTranslation();

  const [rows, setRows] = useState([]);
  const [editingInstance, setEditingInstance] = useState<string | null>(null);
  const [initialMonitorTab, setInitialMonitorTab] = useState(0);
  const [wipeDialogOpen, setWipeDialogOpen] = useState(false);
  const [wipeTarget, setWipeTarget] = useState<{ instance: any; name: string } | null>(null);
  const [expandedAccordion, setExpandedAccordion] = useState<string | null>(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [hiddenDialogOpen, setHiddenDialogOpen] = useState(false);
  const [hiddenInstances, setHiddenInstances] = useState<any[]>([]);

  const onEditComplete = () => {
    setEditingInstance(null);
  };

  useEffect(() => {
    setRows(
      instancesList.map((item) =>
        createData(
          item.instance.status,
          item.instance.id,
          item.name,
          item.instance.workflow_version.name
        )
      )
    );
  }, [instancesList]);

  // Poll instances list every 5 seconds when in list view
  useEffect(() => {
    if (item !== '') return;
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

  const createData = (status: string, id: string, name: string, workflow: string) => {
    return { status, id, name, workflow };
  };

  const handleWipeInstance = (instance, name) => {
    setWipeTarget({ instance, name });
    setWipeDialogOpen(true);
  };

  const confirmWipe = async () => {
    if (!wipeTarget) return;
    const result = await API.deleteWorkflowInstance(wipeTarget.instance);
    if (result.ok) {
      logMessage(
        t('instances.wipe_success', { name: wipeTarget.name }),
        'info'
      );
      refreshInstancesList();
    }
    setWipeDialogOpen(false);
    setWipeTarget(null);
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
              <MenuItem onClick={handleDeleteOrphaned}>
                {t('instances.delete_orphaned')}
              </MenuItem>
              <MenuItem onClick={handleOpenHiddenDialog}>
                {t('instances.manage_hidden')}
              </MenuItem>
            </Menu>
          </Box>

          {/* Accordion list */}
          {rows.length > 0 ? (
            <Box>
              {instancesList.map((entry) => (
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
                {t('instances.no-instances')}
              </Typography>
            </Container>
          )}

          {/* Wipe confirmation dialog */}
          <Dialog open={wipeDialogOpen} onClose={() => setWipeDialogOpen(false)} maxWidth="sm" fullWidth>
            <DialogTitle>{t('instances.wipe_title')}</DialogTitle>
            <DialogContent>
              <Typography>
                {t('instances.wipe_confirm', { name: wipeTarget?.name || '' })}
              </Typography>
              <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                {t('instances.wipe_warning')}
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setWipeDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
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
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={handleUnhideAll}
                    >
                      {t('instances.show_all')}
                    </Button>
                  </Box>
                  <List dense>
                  {hiddenInstances.map((inst) => (
                    <ListItem key={inst.id} disableGutters>
                      <ListItemText
                        primary={inst.name}
                        secondary={inst.workflow_version?.name}
                      />
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => handleUnhide(inst)}
                      >
                        {t('instances.unhide')}
                      </Button>
                    </ListItem>
                  ))}
                </List>
                </>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setHiddenDialogOpen(false)}>
                {t('common.close')}
              </Button>
            </DialogActions>
          </Dialog>
        </>
      ) : (
        /* Detail view for a selected instance */
        instancesList
          .filter(({ name }) => name === item)
          .map(({ name, instance }) => {
            const status = rows.find((r) => r.name === name)?.status;
            return status == WorkflowStatus.Created || editingInstance === name ? (
              <ParametersPage
                key={instance.id}
                instance={instance}
                refreshInstancesList={refreshInstancesList}
                showHiddenParams={showHiddenParams}
                logMessage={logMessage}
                onEditComplete={onEditComplete}
                startOnParamsTab={editingInstance === name}
              />
            ) : (
              <MonitorPage
                key={instance.id}
                instance={instance}
                logMessage={logMessage}
                onRestart={onRestart}
                initialTab={initialMonitorTab}
              />
            );
          })
      )}
    </Container>
  );
}
