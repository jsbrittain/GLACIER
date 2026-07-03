import React, { useEffect, useRef } from 'react';
import {
  Alert,
  Box,
  Button,
  TextField,
  Typography,
  Stack,
  Paper,
  LinearProgress
} from '@mui/material';
import { API } from '../../services/api.js';
import { EnvironmentKey } from '../../../types/environment.js';
import { SettingsKey } from '../../../types/settings.js';
import { useTranslation } from 'react-i18next';

export default function EnvironmentPage() {
  const { t } = useTranslation();
  const isWindows = navigator.platform.startsWith('Win');
  const [nextflowStatus, setNextflowStatus] = React.useState([]);
  const [performingAction, setPerformingAction] = React.useState(null);
  const [systemResources, setSystemResources] = React.useState(null);
  const [extraPaths, setExtraPaths] = React.useState('');
  const [actionMessage, setActionMessage] = React.useState<{
    actionId: string;
    severity: 'info' | 'success' | 'error';
    text: string;
  } | null>(null);
  const performingActionRef = useRef<string | null>(null);

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
    API.settingsGet(SettingsKey.ExtraPaths).then((result) => {
      if (result.ok) setExtraPaths(result.data || '');
    });
  }, []);

  useEffect(() => {
    const unsubscribe = API.onEnvironmentActionProgress?.((data) => {
      if (data.action === performingActionRef.current) {
        setActionMessage((prev) => (prev ? { ...prev, text: data.message } : null));
      }
    });
    return () => unsubscribe?.();
  }, []);

  const handleExtraPathsChange = (value: string) => {
    setExtraPaths(value);
    API.settingsSet(SettingsKey.ExtraPaths, value);
  };

  const handlePerformAction = async (id: string, label: string) => {
    performingActionRef.current = id;
    setPerformingAction(id);
    setActionMessage({ actionId: id, severity: 'info', text: `${label} is running...` });
    try {
      const result = await API.performEnvironmentAction(EnvironmentKey.Nextflow, id);
      if (!result.ok) {
        const message = result.error?.message || 'Unknown error';
        console.error(message);
        setActionMessage({ actionId: id, severity: 'error', text: `${label} failed: ${message}` });
      } else if (id === 'detect.docker') {
        const path = result.data?.path;
        if (path) {
          setExtraPaths(path);
          setActionMessage({
            actionId: id,
            severity: 'success',
            text: `Docker detected at ${path}`
          });
        } else {
          setActionMessage({
            actionId: id,
            severity: 'error',
            text: 'Could not detect Docker installation.'
          });
        }
      } else if (id !== 'install.docker') {
        setActionMessage({ actionId: id, severity: 'success', text: `${label} completed.` });
      }
      getEnvironmentStatus(); // refresh status after action
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(message);
      setActionMessage({ actionId: id, severity: 'error', text: `${label} failed: ${message}` });
    } finally {
      performingActionRef.current = null;
      setPerformingAction(null);
    }
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
        {!isWindows && (
          <Paper sx={{ mb: 2, p: 2 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>
              {t('settings.environment.extra-paths')}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              <TextField
                value={extraPaths}
                onChange={(e) => handleExtraPathsChange(e.target.value)}
                size="small"
                sx={{ flexGrow: 1 }}
              />
              <Button
                variant="outlined"
                size="small"
                disabled={performingAction !== null}
                onClick={() =>
                  handlePerformAction('detect.docker', t('settings.environment.detect-docker'))
                }
                sx={{ mt: 0.5, whiteSpace: 'nowrap' }}
              >
                {t('settings.environment.detect-docker')}
              </Button>
            </Box>
            <Typography
              variant="caption"
              sx={{ mt: 0.5, display: 'block', color: 'text.secondary' }}
            >
              {t('settings.environment.extra-paths-desc')}
            </Typography>
            {actionMessage?.actionId === 'detect.docker' && (
              <Alert
                severity={actionMessage.severity}
                sx={{ mt: 1 }}
                onClose={() => setActionMessage(null)}
              >
                {actionMessage.text}
              </Alert>
            )}
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
                  <React.Fragment key={action.action}>
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
                        onClick={() => handlePerformAction(action.action, action.label)}
                      >
                        {action.label}
                      </Button>
                      {performingAction === action.action && <LinearProgress sx={{ mt: -0.5 }} />}
                    </Box>
                    {actionMessage?.actionId === action.action && (
                      <Alert
                        severity={actionMessage.severity}
                        sx={{ mx: 1, mb: 1 }}
                        onClose={() => setActionMessage(null)}
                      >
                        {actionMessage.text}
                      </Alert>
                    )}
                  </React.Fragment>
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
