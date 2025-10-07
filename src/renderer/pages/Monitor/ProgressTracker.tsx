import React, { useEffect } from 'react';
import { Box, Tabs, Tab, Paper, Typography } from '@mui/material';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import DoneIcon from '@mui/icons-material/Done';
import CancelIcon from '@mui/icons-material/Cancel';
import RefreshIcon from '@mui/icons-material/Refresh';
import AnsiLog from '../AnsiLog.js';
import { API } from '../../services/api.js';
import { useTranslation } from 'react-i18next';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';

const STATUS_ICONS = {
  created: <RefreshIcon style={{ color: 'gray' }} />,
  starting: <RefreshIcon style={{ color: 'gray' }} />,
  submitted: <RefreshIcon style={{ color: 'blue' }} />,
  completed: <DoneIcon style={{ color: 'green' }} />,
  error: <CancelIcon style={{ color: 'red' }} />
};

export default function ProgressTracker({
  nextflowProgress,
  workflowStatus,
}) {
  const { t } = useTranslation();

  const handleOpenProcessFolder = (procName) => {
    console.log(procName);
    alert('Open folder for process: ' + procName);
  }

  const handleOpenProcessLog = (procName) => {
    alert('Open stdout for process: ' + procName);
  }

  return (
    <>
      <Box>
        <Typography variant="h6" gutterBottom>
          {t('monitor.progress.status')}: {t('monitor.progress.' + workflowStatus)}
        </Typography>
      </Box>
      <Box>
      {
        // display each process and its status
        Object.keys(nextflowProgress).map((procName) => (
          <Box key={procName} display="flex" alignItems="center" mb={1}>
            <Box mr={2}>
              {STATUS_ICONS[nextflowProgress[procName]['status']] || (
                <RefreshIcon style={{ color: 'grey' }} />
              )}
            </Box>
            <Typography variant="body1">
              {procName}: {nextflowProgress[procName]['status']}
            </Typography>
            <IconButton
              onClick={() => handleOpenProcessFolder(procName)}
            >
              <FolderOutlinedIcon />
            </IconButton>
            <IconButton
              onClick={() => handleOpenProcessLog(procName)}
            >
              <DescriptionOutlinedIcon />
            </IconButton>
          </Box>
        ))
      }
      </Box>
    </>
  );
}
