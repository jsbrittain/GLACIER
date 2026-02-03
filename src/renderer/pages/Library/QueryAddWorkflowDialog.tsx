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

export default function QueryAddWorkflowDialog({ open, action, onClose }) {
  const { t } = useTranslation();

  const default_version = 'latest';
  const default_section = 'My Workflows';

  const [name, setName] = React.useState('');
  const [repo, setRepo] = React.useState('');
  const [version, setVersion] = React.useState(default_version);
  const [section, setSection] = React.useState(default_section);

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const handleLaunch = async () => {
    // Validate inputs
    if (!repo) {
      setError(t('library.add-workflow-dialog.error-repo-required'));
      return;
    }
    if (!section) {
      setError(t('library.add-workflow-dialog.error-section-required'));
      return;
    }
    // Perform the action
    setLoading(true);
    action(name, repo, version, section)
      .then(() => {
        // close the dialog after action is completed successfully
        setLoading(false);
        onClose();
      })
      .catch((error) => {
        setLoading(false);
        setError(`${t('library.add-workflow-dialog.error-unable-to-add')}
(${error.message})`);
      });
  };

  useEffect(() => {
    // Reset state when dialog is opened
    setName('');
    setRepo('');
    setVersion(default_version);
    setSection(default_section);
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
        <DialogTitle id="library.add-workflow-dialog.title">
          {t('library.add-workflow-dialog.title')}
        </DialogTitle>

        <DialogContent dividers>
          <Typography variant="body2" gutterBottom>
            {t('library.add-workflow-dialog.description')}
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <FormControl sx={{ mt: 2, width: '100%' }}>
            <TextField
              id="query-add-workflow-repo-url"
              label={t('library.add-workflow-dialog.repository-url')}
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              autoFocus
            />
          </FormControl>

          <FormControl sx={{ mt: 2, width: '100%' }}>
            <TextField
              id="query-add-workflow-repo-version"
              label={t('library.add-workflow-dialog.version')}
              value={version}
              onChange={(e) => setVersion(e.target.value)}
            />
          </FormControl>

          <FormControl sx={{ mt: 2, width: '100%' }}>
            <TextField
              label={t('library.add-workflow-dialog.name')}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </FormControl>

          <FormControl sx={{ mt: 2, width: '100%' }}>
            <TextField
              label={t('library.add-workflow-dialog.section')}
              value={section}
              onChange={(e) => setSection(e.target.value)}
            />
          </FormControl>
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <LoadingButton
            id="query-add-workflow-dialog-okay-button"
            type="submit"
            variant="contained"
            loading={loading}
          >
            {t('common.okay')}
          </LoadingButton>
        </DialogActions>
      </form>
    </Dialog>
  );
}
