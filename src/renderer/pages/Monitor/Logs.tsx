import React from 'react';
import { Box, Tabs, Tab, Paper } from '@mui/material';
import AnsiLog from './AnsiLog.js';
import { useTranslation } from 'react-i18next';

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

export default function LogsPage({ stdOut, stdErr, nextflowLog }) {
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
        <AnsiLog text={stdOut} />
      </TabPanel>
      <TabPanel value={tabSelected} index={1}>
        <AnsiLog text={stdErr} />
      </TabPanel>
      <TabPanel value={tabSelected} index={2}>
        <AnsiLog text={nextflowLog} />
      </TabPanel>
    </Paper>
  );
}
