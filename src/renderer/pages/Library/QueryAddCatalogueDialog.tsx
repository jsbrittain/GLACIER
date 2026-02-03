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
  TextField
} from '@mui/material';
import LoadingButton from '@mui/lab/LoadingButton';
import { useTranslation } from 'react-i18next';

export default function QueryAddCatalogueDialog({ open, action, onClose }) {
  const { t } = useTranslation();

  const [repo, setRepo] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const handleLaunch = async () => {
    // Validate inputs
    if (!repo) {
      setError(t('library.add-catalogue-dialog.error-repo-required'));
      return;
    }
    // Perform action
    const version = '';
    setLoading(true);
    action(repo, version)
      .then(() => {
        // close the dialog after action is completed successfully
        setLoading(false);
        onClose();
      })
      .catch(() => {
        setLoading(false);
        setError(t('library.add-catalogue-dialog.error-unable-to-add'));
      });
  };

  useEffect(() => {
    // Reset state when dialog is opened
    setRepo('');
    setError(null);
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleLaunch();
        }}
      >
        <DialogTitle id="library.add-catalogue-dialog.title">
          {t('library.add-catalogue-dialog.title')}
        </DialogTitle>

        <DialogContent dividers>
          <Typography variant="body2" gutterBottom>
            {t('library.add-catalogue-dialog.description')}
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <FormControl sx={{ mt: 1, width: '100%' }}>
            <TextField
              label={t('library.add-catalogue-dialog.repository-url')}
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              autoFocus
            />
          </FormControl>
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <LoadingButton variant="contained" type="submit" loading={loading}>
            {t('common.okay')}
          </LoadingButton>
        </DialogActions>
      </form>
    </Dialog>
  );
}
