import React from 'react';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography
} from '@mui/material';
import LinkIcon from '@mui/icons-material/Link';
import { useTranslation } from 'react-i18next';

function repoUrl(repo) {
  if (repo.startsWith('http://') || repo.startsWith('https://')) {
    return repo.replace(/\.git$/, '');
  }
  return `https://github.com/${repo}`;
}

type WorkflowInfo = {
  repo: string;
  version?: string;
};

type ConfirmInstallDialogProps = {
  open: boolean;
  workflows: WorkflowInfo[];
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmInstallDialog({
  open,
  workflows,
  onConfirm,
  onCancel
}: ConfirmInstallDialogProps) {
  const { t } = useTranslation();

  const isSingle = workflows.length === 1;

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>{t('library.confirm-install-workflow')}</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" gutterBottom>
          {isSingle
            ? t('library.confirm-install-workflow-description')
            : t('library.confirm-install-workflows-description')}
        </Typography>
        <List dense>
          {workflows.map((wf, i) => (
            <ListItem key={i}>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <LinkIcon />
              </ListItemIcon>
              <ListItemText
                primary={repoUrl(wf.repo)}
                secondary={wf.version ? `Version: ${wf.version}` : undefined}
                primaryTypographyProps={{ style: { wordBreak: 'break-all' } }}
              />
            </ListItem>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{t('common.cancel')}</Button>
        <Button variant="contained" color="primary" onClick={onConfirm}>
          {t('library.install-proceed')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
