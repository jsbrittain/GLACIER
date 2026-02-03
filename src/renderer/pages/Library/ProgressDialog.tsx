import React, { useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  Box,
  LinearProgress
} from '@mui/material';

type ProgressDialogProps = {
  open: boolean;
  title: string;
  message?: string;
  value: number;
  total: number;
};

export default function ProgressDialog({
  open,
  title,
  message,
  value,
  total
}: ProgressDialogProps) {
  const [progress, setProgress] = React.useState(0);

  useEffect(() => {
    if (total > 0) {
      const calculatedProgress = (value / total) * 100;
      setProgress(calculatedProgress);
    } else {
      setProgress(0);
    }
  }, [value, total]);

  return (
    <Dialog open={open} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        {message && <DialogContentText>{message}</DialogContentText>}
        <Box sx={{ mt: 2, width: '100%' }}>
          <LinearProgress variant="determinate" value={progress} />
        </Box>
      </DialogContent>
    </Dialog>
  );
}
