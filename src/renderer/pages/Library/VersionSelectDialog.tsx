import React, { useState, useMemo, useEffect } from 'react';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  RadioGroup,
  FormControlLabel,
  Radio,
  Typography,
  CircularProgress,
  Box
} from '@mui/material';
import { useTranslation } from 'react-i18next';

function sortTagsBySemver(tags: string[]): string[] {
  const parseSemver = (tag: string): number[] => {
    const start = tag.match(/\d/);
    if (!start) return [0];
    const cleaned = tag.slice(start.index);
    return cleaned.split('.').map((p) => parseInt(p.match(/^\d+/)?.[0] || '0', 10));
  };
  return [...tags].sort((a, b) => {
    const pa = parseSemver(a);
    const pb = parseSemver(b);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const diff = (pa[i] || 0) - (pb[i] || 0);
      if (diff !== 0) return diff;
    }
    return 0;
  });
}

type VersionSelectDialogProps = {
  open: boolean;
  workflowName: string;
  tags: string[];
  loading: boolean;
  onConfirm: (version: string) => void;
  onCancel: () => void;
};

export default function VersionSelectDialog({
  open,
  workflowName,
  tags,
  loading,
  onConfirm,
  onCancel
}: VersionSelectDialogProps) {
  const { t } = useTranslation();
  const sortedTags = useMemo(() => sortTagsBySemver(tags), [tags]);
  const newestTag = sortedTags.length > 0 ? sortedTags[sortedTags.length - 1] : '';
  const [selected, setSelected] = useState('');

  useEffect(() => {
    if (sortedTags.length > 0) {
      setSelected(sortedTags[sortedTags.length - 1]);
    } else {
      setSelected('');
    }
  }, [sortedTags]);

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>
        {t('library.select-version-title', { name: workflowName, defaultValue: `Select version for ${workflowName}` })}
      </DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : sortedTags.length === 0 ? (
          <Typography variant="body2">
            {t('library.no-versions-available', { defaultValue: 'No versions available.' })}
          </Typography>
        ) : (
          <RadioGroup value={selected} onChange={(e) => setSelected(e.target.value)}>
            {[...sortedTags].reverse().map((tag) => (
              <FormControlLabel
                key={tag}
                value={tag}
                control={<Radio />}
                label={tag === newestTag ? `${tag} (latest)` : tag}
              />
            ))}
          </RadioGroup>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{t('common.cancel')}</Button>
        <Button
          variant="contained"
          color="primary"
          disabled={!selected || loading || sortedTags.length === 0}
          onClick={() => onConfirm(selected)}
        >
          {t('library.install-selected', { defaultValue: 'Install' })}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
