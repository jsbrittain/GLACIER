import React, { useEffect } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  LinearProgress,
  Typography
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import { API } from '../../services/api.js';
import { useTranslation } from 'react-i18next';

const STAGES = [
  'Extracting shard contents',
  'Importing workflows',
  'Installing containers',
  'Importing assets',
  'Updating catalogue'
];

export default function QueryImportShardDialog({ open, refresh, onClose, logMessage }) {
  const { t } = useTranslation();

  const [importing, setImporting] = React.useState(false);
  const [selectedFile, setSelectedFile] = React.useState('');
  const [status, setStatus] = React.useState(null);

  const isActive = importing && (!status || (status.status !== 'completed' && status.status !== 'failed' && status.status !== 'unknown'));

  useEffect(() => {
    setImporting(false);
    setSelectedFile('');
    setStatus(null);
  }, [open]);

  const handleImportShard = () => {
    API.pickFile([
      { name: 'Shard Archives', extensions: ['shard', 'gz'] },
      { name: 'Tarballs', extensions: ['tar', 'tgz', 'gz'] },
      { name: 'All Files', extensions: ['*'] }
    ]).then((pickResult) => {
      if (!pickResult.ok || !pickResult.data) return;
      const filePath = pickResult.data;
      setSelectedFile(filePath);
      setImporting(true);
      API.importShard(filePath).then((importResult) => {
        if (!importResult.ok) {
          logMessage(`Error importing shard: ${importResult.error.message}`);
          return;
        }
        const shardId = importResult.data;
        const intervalId = setInterval(() => {
          API.queryShardStatus(shardId).then((statusResult) => {
            if (!statusResult.ok) {
              clearInterval(intervalId);
              logMessage(`Error querying shard status: ${statusResult.error.message}`);
              return;
            }
            const s = statusResult.data;
            setStatus(s);
            if (
              s.status === 'completed' ||
              s.status === 'failed' ||
              s.status === 'unknown'
            ) {
              clearInterval(intervalId);
              if (s.status === 'failed') {
                logMessage(`Import failed: ${s.message}`);
              }
              return API.refreshCatalogues().then(() => refresh());
            }
          });
        }, 1000);
      });
    });
  };

  const currentStage = Math.min(status?.currentStage || 0, status?.totalStages || 5);
  const totalStages = status?.totalStages || 5;
  const stageFraction = currentStage > 0 ? (currentStage - 1 + (status?.stageProgress || 0) / 100) / totalStages : 0;
  const overallProgress = Math.min(stageFraction * 100, 100);
  const stageDone = (status?.stageProgress || 0) >= 100;
  const hasItems = (status?.stageItemsTotal || 0) > 1;
  const isDeterminate = hasItems || stageDone;
  const itemsLabel = hasItems
    ? `${status.stageItemsCompleted} / ${status.stageItemsTotal}`
    : '';

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle id="library.import-shard-dialog.title">
        {t('library.import-shard-dialog.title')}
      </DialogTitle>

      <DialogContent dividers>
        <Typography variant="body2" gutterBottom>
          {t('library.import-shard-dialog.description')}
        </Typography>

        <FormControl sx={{ mt: 2, width: '100%' }}>
          {importing ? (
            <>
              <Typography variant="body2" sx={{ mb: 2 }}>
                {selectedFile.split('/').pop()}
              </Typography>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                  Stage {currentStage}/{totalStages}
                </Typography>
                <LinearProgress variant="determinate" value={overallProgress} />
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  {status?.message || ''}
                  {itemsLabel && ` \u2014 ${itemsLabel}`}
                </Typography>
                <LinearProgress
                  variant={isDeterminate ? 'determinate' : 'indeterminate'}
                  value={isDeterminate ? (status?.stageProgress || 0) : undefined}
                />
              </Box>

              <Box>
                {STAGES.map((label, idx) => {
                  const stageNum = idx + 1;
                  const isDone = currentStage > stageNum || (currentStage === stageNum && stageDone);
                  const isCurrent = currentStage === stageNum && !isDone;
                  return (
                    <Box
                      key={label}
                      sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}
                    >
                      {isDone ? (
                        <CheckCircleIcon color="success" fontSize="small" />
                      ) : (
                        <RadioButtonUncheckedIcon
                          color={isCurrent ? 'primary' : 'disabled'}
                          fontSize="small"
                        />
                      )}
                      <Typography
                        variant="body2"
                        color={
                          isDone
                            ? 'text.secondary'
                            : isCurrent
                              ? 'text.primary'
                              : 'text.disabled'
                        }
                      >
                        {label}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            </>
          ) : (
            <Button variant="outlined" onClick={handleImportShard}>
              {t('library.import-shard-dialog.file-picker')}
            </Button>
          )}
        </FormControl>
      </DialogContent>

      <DialogActions>
        <Button
          id="import-shard-dialog-close-button"
          variant="contained"
          onClick={onClose}
          disabled={isActive}
        >
          {t('common.close')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
