import React, {useEffect} from 'react';
import {
  Box,
  Tabs,
  Tab,
  Paper,
  Typography,
} from '@mui/material';
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
    <Box
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      {...other}
    >
      {value === index && (
        <Box>
          {children}
        </Box>
      )}
    </Box>
  );
}

const SECOND = 1000;

export default function MonitorPage({
  instance,
  logMessage,
}) {
  const [stdOut, setStdOut] = React.useState('');
  const [stdErr, setStdErr] = React.useState('');
  const [nextflowLog, setNextflowLog] = React.useState('');
  const [tabSelected, setTabSelected] = React.useState(0);

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
    <Box>
      <Tabs value={tabSelected} onChange={handleTabChange}>
        <Tab label="Standard Out" />
        <Tab label="Standard Error" />
        <Tab label="Nextflow Log" />
      </Tabs>
      <TabPanel value={tabSelected} index={0}>
        <AnsiLog text={stdOut} />
      </TabPanel>
      <TabPanel value={tabSelected} index={1}>
        <AnsiLog text={stdErr} />
      </TabPanel>
      <TabPanel value={tabSelected} index={2}>
        <AnsiLog text={nextflowLog} />
      </TabPanel>
    </Box>
  );
}
