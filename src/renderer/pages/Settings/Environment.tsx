import React, { useEffect } from 'react';
import { Box, Button, Typography, Stack, Paper, LinearProgress } from '@mui/material';
import { API } from '../../services/api.js';
import { EnvironmentKey } from '../../../types/environment.js';
import { useTranslation } from 'react-i18next';

export default function EnvironmentPage() {
  const { t } = useTranslation();
  const [nextflowStatus, setNextflowStatus] = React.useState([]);
  const [performingAction, setPerformingAction] = React.useState(null);

  const getEnvironmentStatus = async () => {
    API.getEnvironmentStatus(EnvironmentKey.Nextflow).then((status) => {
      setNextflowStatus(status);
    });
  };

  useEffect(() => {
    getEnvironmentStatus();
  }, []);

  const handlePerformAction = async (id: string) => {
    setPerformingAction(id);
    API.performEnvironmentAction(EnvironmentKey.Nextflow, id).then(() => {
      getEnvironmentStatus(); // refresh status after action
      setPerformingAction(null);
    });
  };

  return (
    <Box sx={{ mb: 2 }}>
      {nextflowStatus.length > 0 ? (
        <Stack spacing={2}>
          {nextflowStatus.map((item, index) => (
            <Paper key={index}>
              <Typography key={index} variant="h6" sx={{ px: 1, pt: 1 }}>
                {item.title}
              </Typography>
              <Typography key={index} variant="body1" sx={{ px: 1, pt: 1 }}>
                {item.description}
              </Typography>
              {(item?.actions || []).map((action) => (
                <Box
                  sx={{
                    display: 'inline-flex',
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    p: 1
                  }}
                >
                  <Button
                    variant="contained"
                    size="small"
                    disabled={performingAction !== null}
                    onClick={() => handlePerformAction(action.action)}
                  >
                    {action.label}
                  </Button>
                  {performingAction === action.action && <LinearProgress sx={{ mt: -0.5 }} />}
                </Box>
              ))}
            </Paper>
          ))}
        </Stack>
      ) : (
        <Typography variant="body2">{t('settings.environment.checking-status')}</Typography>
      )}
    </Box>
  );
}
