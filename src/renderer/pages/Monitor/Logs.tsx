import React, { useEffect } from 'react';
import { Alert, Box, Button, Tabs, Tab, Paper, Stack } from '@mui/material';
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
  const [openError, setOpenError] = React.useState<string | null>(null);
  const logTypes = ['stdout', 'stderr', 'nextflow'];

  const handleTabChange = (event, newValue) => {
    setTabSelected(newValue);
  };

  const handleOpenFolder = async () => {
    const result = await API.openResultsFolder(instance);
    if (!result.ok) {
      setOpenError(result.error?.message || 'Unable to open folder.');
      return;
    }
    setOpenError(null);
  };

  const handleOpenInEditor = async () => {
    const result = await API.openLogFile(instance, logTypes[tabSelected]);
    if (!result.ok) {
      setOpenError(result.error?.message || 'Unable to open log file.');
      return;
    }
    setOpenError(null);
  };

  return (
    <Paper>
      <Stack direction="row" alignItems="center" sx={{ width: '100%' }}>
        <Tabs value={tabSelected} onChange={handleTabChange} sx={{ flex: 1 }}>
          <Tab label={t('monitor.logs.stdout')} />
          <Tab label={t('monitor.logs.stderr')} />
          <Tab label={t('monitor.logs.nextflow-log')} />
        </Tabs>
        <Box sx={{ display: 'flex', gap: 1, px: 1 }}>
          <Button size="small" variant="outlined" onClick={handleOpenFolder}>
            {t('monitor.logs.open-folder')}
          </Button>
          <Button size="small" variant="outlined" onClick={handleOpenInEditor}>
            {t('monitor.logs.open-in-editor')}
          </Button>
        </Box>
      </Stack>
      {openError && (
        <Alert severity="error" sx={{ mx: 1, mb: 1 }} onClose={() => setOpenError(null)}>
          {openError}
        </Alert>
      )}
      <TabPanel value={tabSelected} index={0}>
        <ShowLog instance={instance} log_type="stdout" />
      </TabPanel>
      <TabPanel value={tabSelected} index={1}>
        <ShowLog instance={instance} log_type="stderr" />
      </TabPanel>
      <TabPanel value={tabSelected} index={2}>
        <ShowLog instance={instance} log_type="nextflow" />
      </TabPanel>
    </Paper>
  );
}
