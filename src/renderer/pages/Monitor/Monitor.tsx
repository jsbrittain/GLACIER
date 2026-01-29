import React, { useEffect } from 'react';
import { Box, Tabs, Tab, Paper } from '@mui/material';
import HtmlReports from './HtmlReports.js';
import LogsPage from './Logs.js';
import { API } from '../../services/api.js';
import { useTranslation } from 'react-i18next';

import HeaderMenu from './HeaderMenu';
import ProgressTracker from './ProgressTracker';

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

    fetchLogs(); // initial fetch
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
        <Tab label={t('monitor.reports')} />
        <Tab label={t('monitor.logs.title')} />
      </Tabs>
      <TabPanel value={tabSelected} index={0}>
        <ProgressTracker
          instance={instance}
          nextflowProgress={nextflowProgress}
          workflowStatus={workflowStatus}
        />
      </TabPanel>
      <TabPanel value={tabSelected} index={1}>
        <HtmlReports instance={instance} />
      </TabPanel>
      <TabPanel value={tabSelected} index={2}>
        <LogsPage stdOut={stdOut} stdErr={stdErr} nextflowLog={nextflowLog} />
      </TabPanel>
    </Paper>
  );
}
