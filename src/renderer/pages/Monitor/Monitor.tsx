import React from 'react';
import { Box, Tabs, Tab, Paper, Alert } from '@mui/material';
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

  const isActive = value === index;

  return (
    <Box
      role="tabpanel"
      hidden={!isActive}
      id={`tabpanel-${index}`}
      sx={{
        display: isActive ? 'flex' : 'none',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden'
      }}
      {...other}
    >
      {isActive && (
        <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          {children}
        </Box>
      )}
    </Box>
  );
}

export default function MonitorPage({
  instance,
  logMessage,
  onRestart,
  initialTab = 0,
  showLaunchBanner = false,
  onLaunchBannerDismissed
}) {
  const { t } = useTranslation();
  const [tabSelected, setTabSelected] = React.useState(initialTab);
  const [bannerOpen, setBannerOpen] = React.useState(showLaunchBanner);

  React.useEffect(() => {
    if (!bannerOpen) return;
    const timer = setTimeout(() => {
      setBannerOpen(false);
      if (onLaunchBannerDismissed) onLaunchBannerDismissed();
    }, 15000);
    return () => clearTimeout(timer);
  }, [bannerOpen]);

  const handleDismissBanner = () => {
    setBannerOpen(false);
    if (onLaunchBannerDismissed) onLaunchBannerDismissed();
  };

  const handleTabChange = (event, newValue) => {
    setTabSelected(newValue);
  };

  return (
    <Paper sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <HeaderMenu instance={instance} logMessage={logMessage} onRestart={onRestart} />
      {bannerOpen && (
        <Alert severity="info" onClose={handleDismissBanner} sx={{ mx: 2, mt: 1 }}>
          {t('monitor.banner')}
        </Alert>
      )}
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
