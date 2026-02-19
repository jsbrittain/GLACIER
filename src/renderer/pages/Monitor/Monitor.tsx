import React from 'react';
import { Box, Tabs, Tab, Paper } from '@mui/material';
import HtmlReports from './HtmlReports.js';
import LogsPage from './Logs.js';
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

export default function MonitorPage({ instance, logMessage }) {
  const { t } = useTranslation();
  const [tabSelected, setTabSelected] = React.useState(0);

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
        <ProgressTracker instance={instance} />
      </TabPanel>
      <TabPanel value={tabSelected} index={1}>
        <HtmlReports instance={instance} />
      </TabPanel>
      <TabPanel value={tabSelected} index={2}>
        <LogsPage instance={instance} />
      </TabPanel>
    </Paper>
  );
}
