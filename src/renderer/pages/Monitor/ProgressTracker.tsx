import React, { useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import IconButton from '@mui/material/IconButton';
import DoneIcon from '@mui/icons-material/Done';
import CancelIcon from '@mui/icons-material/Cancel';
import RefreshIcon from '@mui/icons-material/Refresh';
import AnsiLog from './AnsiLog.js';
import { API } from '../../services/api.js';
import { WorkflowStatus } from '../../../types/types.js';
import { useTranslation } from 'react-i18next';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import DescriptionIcon from '@mui/icons-material/Description';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';

const SECOND = 1000;

const STATUS_ICONS = {
  created: <RefreshIcon style={{ color: 'gray' }} />,
  starting: <RefreshIcon style={{ color: 'gray' }} />,
  submitted: <RefreshIcon style={{ color: 'blue' }} />,
  completed: <DoneIcon style={{ color: 'green' }} />,
  error: <CancelIcon style={{ color: 'red' }} />
};

export default function ProgressTracker({ instance, nextflowProgress, workflowStatus }) {
  const { t } = useTranslation();

  const [showWork, setShowWork] = React.useState(false);
  const [workID, setWorkID] = React.useState<string>('');
  const [workStdout, setWorkStdout] = React.useState<string>('');

  const handleOpenProcessFolder = (name) => {
    API.openWorkFolder(instance, nextflowProgress[name]['work']);
  };

  const handleOpenProcessLog = (name) => {
    setWorkID(nextflowProgress[name]['work']);
    setShowWork(!showWork);
  };

  useEffect(() => {
    const fetchWorkLog = () => {
      if (workID === '') {
        return;
      }
      API.getWorkLog(instance, workID, 'stdout').then((logs) => {
        setWorkStdout(logs);
      });
    };

    const interval = setInterval(fetchWorkLog, 1 * SECOND);
    return () => clearInterval(interval);
  }, [showWork]);

  const FormatWorkflowStatus = ({ workflowStatus }: { workflowStatus: string }) => {
    let color_palette = 'info';
    if (workflowStatus === WorkflowStatus.Failed) {
      color_palette = 'error';
    } else if (workflowStatus === WorkflowStatus.Completed) {
      color_palette = 'success';
    }
    return (
      <Typography variant="h6" color={color_palette} gutterBottom>
        {`${t('monitor.progress.' + workflowStatus)}`}
      </Typography>
    );
  };

  return (
    <Box sx={{ display: 'flex', gap: 2 }}>
      <Box sx={{ flex: 1 }}>
        <Box>
          <FormatWorkflowStatus workflowStatus={workflowStatus} />
        </Box>
        <Box>
          {
            // display each process and its status
            Object.keys(nextflowProgress).map((name) => (
              <Box key={name} display="flex" alignItems="center" mb={1}>
                <Box mr={2}>
                  {STATUS_ICONS[nextflowProgress[name]['status']] || (
                    <RefreshIcon style={{ color: 'grey' }} />
                  )}
                </Box>
                <Typography variant="body1">
                  {name}: {nextflowProgress[name]['status']}
                </Typography>
                {nextflowProgress[name]['work'] !== undefined && (
                  <>
                    <IconButton onClick={() => handleOpenProcessFolder(name)}>
                      <FolderOutlinedIcon />
                    </IconButton>
                    <IconButton onClick={() => handleOpenProcessLog(name)}>
                      {nextflowProgress[name]['work'] === workID && showWork ? (
                        <DescriptionIcon color="primary" />
                      ) : (
                        <DescriptionOutlinedIcon />
                      )}
                    </IconButton>
                  </>
                )}
              </Box>
            ))
          }
        </Box>
      </Box>
      {showWork && (
        <Box sx={{ flex: 1 }}>
          <AnsiLog text={workStdout} />
        </Box>
      )}
    </Box>
  );
}
