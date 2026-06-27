import React, { useEffect } from 'react';
import { Alert, AlertTitle, Box, Button } from '@mui/material';
import { API } from '../../services/api.js';
import { EnvironmentKey } from '../../../types/environment.js';
import { useTranslation } from 'react-i18next';

export default function EnvironmentPage({ navigateToSettingsEnv }) {
  const { t } = useTranslation();
  const [actionsRequired, setActionsRequired] = React.useState([]);

  const getEnvironmentStatus = async () => {
    API.getEnvironmentStatus(EnvironmentKey.Nextflow).then((result) => {
      if (result.ok) {
        setActionsRequired(
          result.data
            .filter((item) => item?.status === 'warning' && (item?.actions || []).length > 0)
            .map((item) => item.title)
        );
      }
    });
  };

  useEffect(() => {
    getEnvironmentStatus();
  }, []);

  const handleNavigateToSettings = () => {
    navigateToSettingsEnv();
  };

  return (
    <Box sx={{ mb: 2, width: '100%' }}>
      {(actionsRequired || []).length > 0 && (
        <Alert
          severity="warning"
          sx={{ display: 'flex', alignItems: 'center', width: '100%' }}
          action={
            <Button
              color="inherit"
              variant="outlined"
              onClick={handleNavigateToSettings}
              sx={{ mr: 2 }}
            >
              {t('library.environment.go-to-settings')}
            </Button>
          }
        >
          <AlertTitle>{t('library.environment.missing-deps')}</AlertTitle>
          <Box sx={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'stretch' }}>
            {t('library.environment.required-deps')}
            {actionsRequired.join(', ')}
          </Box>
        </Alert>
      )}
    </Box>
  );
}
