import React, { useEffect } from 'react';
import { Box, Tabs, Tab, Paper } from '@mui/material';
import AnsiLog from './AnsiLog.js';
import { useTranslation } from 'react-i18next';
import { API } from '../../services/api.js';

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

const ShowLog = ({ instance, log_type }: { instance: any; log_type: string }) => {
  const [log, setLog] = React.useState('');

  useEffect(() => {
    const fetchLogs = () => {
      API.getWorkflowInstanceLogs(instance, log_type).then((result) => {
        if (result.ok) setLog(result.data);
      });
    };

    fetchLogs(); // initial fetch
    const timerId = setInterval(fetchLogs, 1 * SECOND);

    return () => {
      clearInterval(timerId);
    };
  }, [instance, log_type]);

  return <AnsiLog text={log} />;
};

export default function LogsPage({ instance }: { instance: any }) {
  const { t } = useTranslation();
  const [tabSelected, setTabSelected] = React.useState(0);

  const handleTabChange = (event, newValue) => {
    setTabSelected(newValue);
  };

  return (
    <Paper>
      <Tabs value={tabSelected} onChange={handleTabChange}>
        <Tab label={t('monitor.logs.stdout')} />
        <Tab label={t('monitor.logs.stderr')} />
        <Tab label={t('monitor.logs.nextflow-log')} />
      </Tabs>
      <TabPanel value={tabSelected} index={0}>
        <ShowLog instance={instance} log_type="stdout" />
      </TabPanel>
      <TabPanel value={tabSelected} index={1}>
        <ShowLog instance={instance} log_type="stderr" />
      </TabPanel>
      <TabPanel value={tabSelected} index={2}>
        <ShowLog instance={instance} log_type=".nextflow" />
      </TabPanel>
    </Paper>
  );
}
