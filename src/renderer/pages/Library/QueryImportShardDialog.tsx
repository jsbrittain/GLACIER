import React, { useEffect } from 'react';
import {
  Alert,
  Button,
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

  const default_version = 'latest';
  const default_section = 'My Workflows';

  const [name, setName] = React.useState('');
  const [repo, setRepo] = React.useState('');
  const [version, setVersion] = React.useState(default_version);
  const [section, setSection] = React.useState(default_section);

  const [loading, setLoading] = React.useState(false);
  const [logs, setLogs] = React.useState([]);

  useEffect(() => {
    // Reset state when dialog is opened
    setName('');
    setRepo('');
    setVersion(default_version);
    setSection(default_section);
    setLogs([]);
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
      API.importShard(filePath).then((result) => {
        const shardId = result.data;
        const intervalId = setInterval(() => {
          API.queryShardStatus(shardId).then((status) => {
            logMessage(`Shard status: ${status.data.status} (${status.data.message})`);
            setLogs(status.data?.logs || []);
            if (status.data.status === 'completed' || status.data.status === 'failed' || status.data.status === 'unknown') {
              clearInterval(intervalId);
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
          });
        }, 1000);
      }).catch((error) => {
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
            <Button
              variant="outlined"
              onClick={handleImportShard}
            >{t('library.import-shard-dialog.file-picker')}</Button>
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
