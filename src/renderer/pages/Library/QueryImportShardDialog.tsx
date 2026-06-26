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
    ]).then((filePath) => {
      if (!filePath) return;
      setSelectedFile(filePath);
      setImporting(true);
      API.importShard(filePath).then((result) => {
        const shardId = result.data;
        const intervalId = setInterval(() => {
          API.queryShardStatus(shardId).then((status) => {
            logMessage(`Shard status: ${status.data.status} (${status.data.message})`);
            setLogs(status.data?.logs || []);
            if (status.data.status === 'completed' || status.data.status === 'failed' || status.data.status === 'unknown') {
              clearInterval(intervalId);
              setImporting(false);
              if (status.data.status === 'failed') {
                setLogs([`Import failed: ${status.data.message}`, ...(status.data?.logs || [])]);
              }
              return API.refreshCatalogues().then(() => {
                return refresh();
              });
            }
          }).catch((error) => {
            logMessage(`Error querying shard status: ${error.message}`);
            clearInterval(intervalId);
            setImporting(false);
          });
        }, 1000);
      }).catch((error) => {
        setImporting(false);
        alert(`Error importing shard: ${error.message}`);
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

        {(logs.length > 0) && (
          <Paper sx={{p: 2, overflowY: 'auto' }}>
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
          >
            {t('common.close')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
