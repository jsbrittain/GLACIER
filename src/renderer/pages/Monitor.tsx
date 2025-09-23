import React, { useEffect } from 'react';
import { Box, Tabs, Tab, Paper, Typography } from '@mui/material';
import DoneIcon from '@mui/icons-material/Done';
import CancelIcon from '@mui/icons-material/Cancel';
import RefreshIcon from '@mui/icons-material/Refresh';
import AnsiLog from './AnsiLog.js';
import { API } from '../services/api.js';

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
  const [stdOut, setStdOut] = React.useState('');
  const [stdErr, setStdErr] = React.useState('');
  const [nextflowLog, setNextflowLog] = React.useState('');
  const [nextflowProgress, setNextflowProgress] = React.useState('');
  const [tabSelected, setTabSelected] = React.useState(1);

  useEffect(() => {
    const fetchLogs = () => {
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
        console.log('progress:', progress);
        const report = {};
        const processes = progress['process'] || {};
        Object.keys(processes).forEach((name) => {
          // last entry - should sort by timestamp for most recent
          const proc = processes[name][processes[name].length - 1];
          report[name] = {
            status: proc['status']
          };
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
      <Tabs value={tabSelected} onChange={handleTabChange}>
        <Tab label="Progress" />
        <Tab label="Standard Out" />
        <Tab label="Standard Error" />
        <Tab label="Nextflow Log" />
      </Tabs>
      <TabPanel value={tabSelected} index={0}>
        {
          // display each process and its status
          Object.keys(nextflowProgress).map((procName) => (
            <Box key={procName} display="flex" alignItems="center" mb={1}>
              <Box mr={2}>
                {STATUS_ICONS[nextflowProgress[procName]['status']] || (
                  <RefreshIcon style={{ color: 'grey' }} />
                )}
              </Box>
              <Typography variant="body1">
                {procName}: {nextflowProgress[procName]['status']}
              </Typography>
            </Box>
          ))
        }
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
