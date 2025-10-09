import React, { useEffect } from 'react';
import { Box, Tabs, Tab, Paper, Typography } from '@mui/material';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import DoneIcon from '@mui/icons-material/Done';
import CancelIcon from '@mui/icons-material/Cancel';
import RefreshIcon from '@mui/icons-material/Refresh';
import AnsiLog from '../AnsiLog.js';
import { API } from '../../services/api.js';
import { useTranslation } from 'react-i18next';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <Box role="tabpanel" hidden={value !== index} id={`tabpanel-${index}`} {...other}>
      {value === index && <Box>{children}</Box>}
    </Box>
  );
}

const SECOND = 1000;

const STATUS_ICONS = {
  created: <RefreshIcon style={{ color: 'gray' }} />,
  starting: <RefreshIcon style={{ color: 'gray' }} />,
  submitted: <RefreshIcon style={{ color: 'blue' }} />,
  completed: <DoneIcon style={{ color: 'green' }} />,
  error: <CancelIcon style={{ color: 'red' }} />
};

export default function HeaderMenu({ instance, logMessage }) {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [processRunning, setProcessRunning] = React.useState(true); // ####### check if the process is running
  const [processHasRunHistory, setProcessHasRunHistory] = React.useState(true); // ####### check if the process has run history

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
    const id = await API.runWorkflow(instance, {}, { resume: true });
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
        return API.runWorkflow(instance, {}, { restart: true });
      })
      .catch((error) => {
        // Workflow may not be running, so just log the error and continue
        console.log('Error cancelling workflow (may not be running): ', error);
        return API.runWorkflow(instance, {}, { restart: true });
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
        <MenuItem value={0} onClick={() => handleExecutionCancel()} disabled={!processRunning}>
          {t('monitor.execution.cancel')}
        </MenuItem>
        <MenuItem
          value={1}
          onClick={() => handleExecutionResume()}
          disabled={processRunning && processHasRunHistory}
        >
          {t('monitor.execution.resume')}
        </MenuItem>
        <MenuItem
          value={2}
          onClick={() => handleExecutionRestart()}
          disabled={!processHasRunHistory}
        >
          {t('monitor.execution.restart')}
        </MenuItem>
        <MenuItem value={3} onClick={() => handleExecutionKill()} disabled={!processRunning}>
          {t('monitor.execution.kill')}
        </MenuItem>
      </Menu>

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
