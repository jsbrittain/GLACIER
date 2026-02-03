import React from 'react';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  Typography,
  TextField
} from '@mui/material';
import { useTranslation } from 'react-i18next';

export default function QueryAddWorkflowDialog({ open, action, onClose }) {
  const { t } = useTranslation();

  const [name, setName] = React.useState('');
  const [repo, setRepo] = React.useState('');
  const [version, setVersion] = React.useState('latest');
  const [section, setSection] = React.useState('My Workflows');

  const handleLaunch = () => {
    action(name, repo, version, section);
  };

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
          <Button id="query-add-workflow-dialog-okay-button" type="submit" variant="contained">
            {t('common.okay')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
