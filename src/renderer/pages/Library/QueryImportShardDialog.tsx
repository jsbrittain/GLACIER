import React, { useEffect } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  Typography,
  Paper
} from '@mui/material';
import { API } from '../../services/api.js';
import { useTranslation } from 'react-i18next';

export default function QueryImportShardDialog({ open, refresh, onClose, logMessage }) {
  const { t } = useTranslation();

  const [logs, setLogs] = React.useState([]);
  const [importing, setImporting] = React.useState(false);
  const [selectedFile, setSelectedFile] = React.useState('');

  useEffect(() => {
    setLogs([]);
    setImporting(false);
    setSelectedFile('');
  }, [open]);

  const handleImportShard = () => {
    API.pickFile([
      {
        name: 'Shard Archives',
        extensions: ['shard', 'gz']
      },
      {
        name: 'Tarballs',
        extensions: ['tar', 'tgz', 'gz']
      },
      {
        name: 'All Files',
        extensions: ['*']
      }
    ]).then((pickResult) => {
      if (!pickResult.ok || !pickResult.data) return;
      const filePath = pickResult.data;
      setSelectedFile(filePath);
      setImporting(true);
      API.importShard(filePath).then((importResult) => {
        if (!importResult.ok) {
          setImporting(false);
          alert(`Error importing shard: ${importResult.error.message}`);
          return;
        }
        const shardId = importResult.data;
        const intervalId = setInterval(() => {
          API.queryShardStatus(shardId).then((statusResult) => {
            if (!statusResult.ok) {
              logMessage(`Error querying shard status: ${statusResult.error.message}`);
              clearInterval(intervalId);
              setImporting(false);
              return;
            }
            const status = statusResult.data;
            logMessage(`Shard status: ${status.message}`);
            setLogs(status?.logs || []);
            if (
              status.status === 'completed' ||
              status.status === 'failed' ||
              status.status === 'unknown'
            ) {
              clearInterval(intervalId);
              setImporting(false);
              if (status.status === 'failed') {
                setLogs([`Import failed: ${status.message}`, ...(status?.logs || [])]);
              }
              return API.refreshCatalogues().then(() => {
                return refresh();
              });
            }
          });
        }, 1000);
      });
    });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <form>
        <DialogTitle id="library.import-shard-dialog.title">
          {t('library.import-shard-dialog.title')}
        </DialogTitle>

        <DialogContent dividers>
          <Typography variant="body2" gutterBottom>
            {t('library.import-shard-dialog.description')}
          </Typography>

          <FormControl sx={{ mt: 2, width: '100%' }}>
            {importing ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={20} />
                <Typography variant="body2">{selectedFile.split('/').pop()}</Typography>
              </Box>
            ) : (
              <Button variant="outlined" onClick={handleImportShard}>
                {t('library.import-shard-dialog.file-picker')}
              </Button>
            )}
          </FormControl>
        </DialogContent>

        {logs.length > 0 && (
          <Paper sx={{ p: 2, overflowY: 'auto' }}>
            {logs.map((log) => (
              <Alert severity={log.level} sx={{ mb: 2 }}>
                {log.message}
              </Alert>
            ))}
          </Paper>
        )}

        <DialogActions>
          <Button
            id="import-shard-dialog-close-button"
            variant="contained"
            onClick={onClose}
            disabled={importing}
          >
            {t('common.close')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
