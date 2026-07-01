import React, { useState, useEffect } from 'react';
import { Box, Select, MenuItem, Button } from '@mui/material';
import { API } from '../../services/api.js';
import { useTranslation } from 'react-i18next';
import AnsiLog from './AnsiLog.js';

const LOG_TYPES = ['log', 'stdout', 'stderr', 'run', 'shell', 'trace', 'begin'];

export default function ProcessLogViewer({
  instance,
  workFolder,
  onHide,
}: {
  instance: any;
  workFolder?: string;
  onHide: () => void;
}) {
  const { t } = useTranslation();
  const [logType, setLogType] = useState(LOG_TYPES[0]);
  const [logText, setLogText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const refreshLog = (type: string) => {
    API.getWorkLog(instance, workFolder, type).then((result) => {
      if (result.ok) {
        setLogText(result.data === '' ? t('monitor.progress.no-logs') : result.data);
        setError(null);
      } else {
        setLogText(t('monitor.progress.no-logs'));
        setError(result.error?.message || null);
      }
    });
  };

  useEffect(() => {
    refreshLog(logType);
    const interval = setInterval(() => refreshLog(logType), 5000);
    return () => clearInterval(interval);
  }, [logType, instance, workFolder]);

  const handleOpenFolder = () => {
    API.openWorkFolder(instance, workFolder);
  };

  const handleOpenInEditor = () => {
    API.openWorkLogFile(instance, workFolder, logType);
  };

  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: error ? 'error.main' : 'divider',
        borderRadius: 1,
        p: 1.5,
        mt: 1,
        width: '100%',
        bgcolor: 'background.paper',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Select
          value={LOG_TYPES.indexOf(logType)}
          onChange={(event) => {
            const idx = event.target.value as number;
            setLogType(LOG_TYPES[idx]);
          }}
          variant="standard"
          size="small"
        >
          {LOG_TYPES.map((type, index) => (
            <MenuItem key={type} value={index}>
              {t('monitor.logs.' + type)}
            </MenuItem>
          ))}
        </Select>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Button variant="outlined" size="small" onClick={handleOpenFolder}>
            {t('monitor.progress.open-folder')}
          </Button>
          <Button variant="outlined" size="small" onClick={handleOpenInEditor}>
            {t('monitor.progress.open-in-editor')}
          </Button>
          <Button variant="outlined" size="small" color="error" onClick={onHide}>
            {t('monitor.progress.hide-log')}
          </Button>
        </Box>
      </Box>
      <AnsiLog text={logText} />
    </Box>
  );
}
