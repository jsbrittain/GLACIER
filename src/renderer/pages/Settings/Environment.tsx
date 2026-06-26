import React, { useEffect } from 'react';
import { Box, Button, Typography, Stack, Paper, LinearProgress } from '@mui/material';
import { API } from '../../services/api.js';
import { EnvironmentKey } from '../../../types/environment.js';
import { useTranslation } from 'react-i18next';

export default function EnvironmentPage() {
  const { t } = useTranslation();
  const [nextflowStatus, setNextflowStatus] = React.useState([]);
  const [performingAction, setPerformingAction] = React.useState(null);
  const [systemResources, setSystemResources] = React.useState(null);

  const getEnvironmentStatus = async () => {
    API.getEnvironmentStatus(EnvironmentKey.Nextflow).then((result) => {
      if (result.ok) setNextflowStatus(result.data);
    });
  };

  const getSystemResources = async () => {
    API.getSystemResources().then((result) => {
      if (result?.ok) setSystemResources(result.data || null);
    });
  };

  useEffect(() => {
    getEnvironmentStatus();
    getSystemResources();
  }, []);

  const handlePerformAction = async (id: string) => {
    setPerformingAction(id);
    API.performEnvironmentAction(EnvironmentKey.Nextflow, id).then((result) => {
      if (!result.ok) console.error(result.error.message);
      getEnvironmentStatus(); // refresh status after action
      setPerformingAction(null);
    });
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Box sx={{ mb: 2 }}>
      <>
        {systemResources && (
          <Paper sx={{ mb: 2, p: 2 }}>
            <Typography variant="h6">{t('settings.environment.system-resources')}</Typography>
            <Typography variant="body1">
              {t('settings.environment.cpu-cores')}: {systemResources.cpuCores}
            </Typography>
            <Typography variant="body1">
              {t('settings.environment.free-memory')}: {formatBytes(systemResources.freeMem)}
            </Typography>
            <Typography variant="body1">
              {t('settings.environment.total-memory')}: {formatBytes(systemResources.totalMem)}
            </Typography>
          </Paper>
        )}
        {nextflowStatus.length > 0 ? (
          <Stack spacing={2}>
            {nextflowStatus.map((item, index) => (
              <Paper key={index}>
                <Typography key={index} variant="h6" sx={{ px: 1, pt: 1 }}>
                  {item.title}
                </Typography>
                <Typography key={index} variant="body1" sx={{ px: 1, pt: 1 }}>
                  {item.description}
                </Typography>
                {(item?.actions || []).map((action) => (
                  <Box
                    sx={{
                      display: 'inline-flex',
                      flexDirection: 'column',
                      alignItems: 'stretch',
                      p: 1
                    }}
                  >
                    <Button
                      variant="contained"
                      size="small"
                      disabled={performingAction !== null}
                      onClick={() => handlePerformAction(action.action)}
                    >
                      {action.label}
                    </Button>
                    {performingAction === action.action && <LinearProgress sx={{ mt: -0.5 }} />}
                  </Box>
                ))}
              </Paper>
            ))}
          </Stack>
        ) : (
          <Typography variant="body2">{t('settings.environment.checking-status')}</Typography>
        )}
      </>
    </Box>
  );
}
