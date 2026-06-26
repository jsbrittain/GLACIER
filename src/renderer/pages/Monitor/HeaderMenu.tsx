import React from 'react';
import { Box, Typography } from '@mui/material';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { API } from '../../services/api.js';
import { useTranslation } from 'react-i18next';

export default function HeaderMenu({ instance, logMessage, onRestart }) {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const handleExecutionActionsMenuClose = () => {
    setAnchorEl(null);
  };

  const handleExecutionCancel = () => {
    handleExecutionActionsMenuClose();
    if (!window.confirm(t('monitor.execution.cancel-confirm'))) {
      return;
    }
    logMessage(`${t('monitor.execution.cancelling')}: ${instance.id}.`);
    API.cancelWorkflowInstance(instance).then(() => {
      // instance cancelled - refresh running status
    });
  };

  const handleExecutionResume = async () => {
    handleExecutionActionsMenuClose();
    if (!window.confirm(t('monitor.execution.resume-confirm'))) {
      return;
    }
    await API.runWorkflow(instance, {}, { resume: true });
    logMessage(`${t('monitor.execution.resuming')}: ${instance.id}.`);
  };

  const handleExecutionRestart = () => {
    handleExecutionActionsMenuClose();
    if (!window.confirm(t('monitor.execution.restart-confirm'))) {
      return;
    }
    logMessage(`${t('monitor.execution.restarting')}: ${instance.id}.`);
    API.cancelWorkflowInstance(instance)
      .then(() => {
        if (onRestart) onRestart(instance.id);
      })
      .catch((error) => {
        // Workflow may not be running, so just log the error and continue
        console.log('Error cancelling workflow (may not be running): ', error);
        if (onRestart) onRestart(instance.id);
      });
  };

  const handleExecutionKill = () => {
    handleExecutionActionsMenuClose();
    if (!window.confirm(t('monitor.execution.kill-confirm'))) {
      return;
    }
    logMessage(`${t('monitor.execution.killing')}: ${instance.id}.`);
    API.killWorkflowInstance(instance).then(() => {
      // instance killed - refresh running status
    });
  };

  const handleOpenResultsFolder = () => {
    API.openResultsFolder(instance);
  };

  return (
    <Box display="flex" justifyContent="space-between" alignItems="center" p={2}>
      <Button
        id="execution-actions-button"
        aria-controls={anchorEl ? 'execution-actions' : undefined}
        aria-haspopup="true"
        aria-expanded={anchorEl ? 'true' : undefined}
        onClick={(event) => setAnchorEl(event.currentTarget)}
        variant="contained"
      >
        {t('monitor.execution.actions')}
      </Button>
      <Menu
        id="execution-actions"
        aria-labelledby="execution-actions-label"
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleExecutionActionsMenuClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        <MenuItem value={0} onClick={() => handleExecutionCancel()}>
          {t('monitor.execution.cancel')}
        </MenuItem>
        <MenuItem value={1} onClick={() => handleExecutionResume()}>
          {t('monitor.execution.resume')}
        </MenuItem>
        <MenuItem value={2} onClick={() => handleExecutionRestart()}>
          {t('monitor.execution.restart')}
        </MenuItem>
        <MenuItem value={3} onClick={() => handleExecutionKill()}>
          {t('monitor.execution.kill')}
        </MenuItem>
      </Menu>

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          px: 2
        }}
      >
        <Typography variant="h6" sx={{ textAlign: 'center' }}>
          {instance.name}
        </Typography>
        <Typography variant="subtitle1" sx={{ textAlign: 'center' }}>
          {instance.workflow_version.name}
        </Typography>
      </Box>

      <Button
        id="open-results-folder-button"
        onClick={() => handleOpenResultsFolder()}
        variant="contained"
      >
        {t('monitor.open-results-folder')}
      </Button>
    </Box>
  );
}
