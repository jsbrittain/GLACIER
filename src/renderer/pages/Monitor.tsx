import React, { useEffect } from 'react';
import { Box, Tabs, Tab, Paper, Typography } from '@mui/material';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import DoneIcon from '@mui/icons-material/Done';
import CancelIcon from '@mui/icons-material/Cancel';
import RefreshIcon from '@mui/icons-material/Refresh';
import AnsiLog from './AnsiLog.js';
import { API } from '../services/api.js';
import { useTranslation } from 'react-i18next';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';

import HeaderMenu from './Monitor/HeaderMenu';
import ProgressTracker from './Monitor/ProgressTracker';

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

export default function MonitorPage({ instance, logMessage }) {
  const { t } = useTranslation();

  const [stdOut, setStdOut] = React.useState('');
  const [stdErr, setStdErr] = React.useState('');
  const [nextflowLog, setNextflowLog] = React.useState('');
  const [nextflowProgress, setNextflowProgress] = React.useState('');
  const [tabSelected, setTabSelected] = React.useState(0);
  const [workflowStatus, setWorkflowStatus] = React.useState('unknown');

  useEffect(() => {
    const fetchLogs = () => {
      API.updateWorkflowInstanceStatus(instance).then((status) => {
        setWorkflowStatus(status || 'unknown');
      });
      API.getWorkflowInstanceLogs(instance, 'stdout').then((logs) => {
        setStdOut(logs);
      });
      API.getWorkflowInstanceLogs(instance, 'stderr').then((logs) => {
        setStdErr(logs);
      });
      API.getWorkflowInstanceLogs(instance, '.nextflow').then((logs) => {
        setNextflowLog(logs);
      });
      API.getInstanceProgress(instance).then((progress) => {
        const report = {};
        const processes = progress['process'] || {};
        Object.keys(processes).forEach((name) => {
          // last entry - should sort by timestamp for most recent
          const proc = processes[name][processes[name].length - 1];
          report[name] = {
            status: proc['status']
          };
          if (proc['work'] !== undefined) {
            report[name]['work'] = proc['work'];
          }
        });
        setNextflowProgress(report);
      });
    };

    const timerId = setInterval(fetchLogs, 1 * SECOND);

    return () => {
      clearInterval(timerId);
    };
  }, [instance]);

  const handleTabChange = (event, newValue) => {
    setTabSelected(newValue);
  };

  return (
    <Paper>
      <HeaderMenu instance={instance} logMessage={logMessage} />
      <Tabs value={tabSelected} onChange={handleTabChange}>
        <Tab label={t('monitor.progress.title')} />
        <Tab label={t('monitor.stdout')} />
        <Tab label={t('monitor.stderr')} />
        <Tab label={t('monitor.nextflow-log')} />
      </Tabs>
      <TabPanel value={tabSelected} index={0}>
        <ProgressTracker
          instance={instance}
          nextflowProgress={nextflowProgress}
          workflowStatus={workflowStatus}
        />
      </TabPanel>
      <TabPanel value={tabSelected} index={1}>
        <AnsiLog text={stdOut} />
      </TabPanel>
      <TabPanel value={tabSelected} index={2}>
        <AnsiLog text={stdErr} />
      </TabPanel>
      <TabPanel value={tabSelected} index={3}>
        <AnsiLog text={nextflowLog} />
      </TabPanel>
    </Paper>
  );
}
