import React, { useEffect } from 'react';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  Chip,
  Box,
  Typography,
  TextField
} from '@mui/material';
import { useTranslation } from 'react-i18next';

export default function QueryAddCatalogueDialog({ open, action, onClose }) {
  const { t } = useTranslation();

  const [repo, setRepo] = React.useState('');
  const [version, setVersion] = React.useState('');

  const handleLaunch = () => {
    action(repo, version);
  };

  return (
    <Dialog open={open} fullWidth maxWidth="sm">
      <DialogTitle id="library.add-catalogue-dialog.title">
        {t('library.add-catalogue-dialog.title')}
      </DialogTitle>

      <DialogContent dividers>
        <Typography variant="body2" gutterBottom>
          {t('library.add-catalogue-dialog.description')}
        </Typography>

        <FormControl sx={{ mt: 1, width: '100%' }}>
          <TextField
            label={t('library.add-catalogue-dialog.repository-url')}
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
          />
        </FormControl>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="contained" onClick={handleLaunch}>
          {t('common.okay')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
