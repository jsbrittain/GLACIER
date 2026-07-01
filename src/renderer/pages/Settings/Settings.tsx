import React, { useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Switch,
  Checkbox,
  FormControlLabel,
  Select,
  Stack,
  MenuItem,
  Paper,
  Tab,
  Tabs,
  Button
} from '@mui/material';
import EnvironmentPage from './Environment.js';
import LicensesPage from './Licenses.js';
import { API } from '../../services/api.js';
import { SettingsKey } from '../../../types/settings.js';
import { useTranslation } from 'react-i18next';

export default function SettingsPage({
  darkMode,
  setDarkMode,
  collectionsPath,
  documentsPath,
  permitAddCatalogues,
  setPermitAddCatalogues,
  permitCatalogueModifications,
  setPermitCatalogueModifications,
  permitImportShards,
  setPermitImportShards,
  permitAddRepos,
  setPermitAddRepos,
  showHiddenParams,
  setShowHiddenParams,
  showLogPanel,
  onShowLogPanelChange,
  autoStoreDir,
  setAutoStoreDir,
  nextflowSyntaxParser,
  setNextflowSyntaxParser,
  autoOutdir,
  setAutoOutdir,
  outputPath,
  setOutputPath,
  storeDirPath,
  setStoreDirPath,
  navigateToPage,
  setNavigateToPage,
  onReopenSetup
}) {
  const { t, i18n } = useTranslation();

  const [language, setLanguage] = React.useState(i18n.language?.split('-')[0] || 'en');
  const [tabValue, setTabValue] = React.useState(0);
  const [disableSchemaValidation, setDisableSchemaValidation] = React.useState(false);

  const handleLanguageChange = (e) => {
    const newLang = e.target.value;
    setLanguage(newLang);
    i18n.changeLanguage(newLang);
  };

  const handlePermitAddCatalogues = (value) => {
    setPermitAddCatalogues(value);
    API.settingsSet(SettingsKey.PermitAddCatalogues, value).then((result) => {
      if (!result.ok) console.error(result.error.message);
    });
  };

  const handlePermitCatalogueModifications = (value) => {
    setPermitCatalogueModifications(value);
    API.settingsSet(SettingsKey.PermitCatalogueModifications, value).then((result) => {
      if (!result.ok) console.error(result.error.message);
    });
  };

  const handlePermitImportShards = (value) => {
    setPermitImportShards(value);
    API.settingsSet(SettingsKey.PermitImportShards, value).then((result) => {
      if (!result.ok) console.error(result.error.message);
    });
  };

  const handlePermitAddRepos = (value) => {
    setPermitAddRepos(value);
    API.settingsSet(SettingsKey.PermitAddRepos, value).then((result) => {
      if (!result.ok) console.error(result.error.message);
    });
  };

  const handleDarkMode = (value) => {
    setDarkMode(value);
    API.settingsSet(SettingsKey.DarkMode, value).then((result) => {
      if (!result.ok) console.error(result.error.message);
    });
  };

  const handleDisableSchemaValidation = (value) => {
    setDisableSchemaValidation(value);
    API.settingsSet(SettingsKey.DisableSchemaValidation, value).then((result) => {
      if (!result.ok) console.error(result.error.message);
    });
  };

  const handleAutoStoreDir = (value) => {
    setAutoStoreDir(value);
    API.settingsSet(SettingsKey.AutoStoreDir, value).then((result) => {
      if (!result.ok) console.error(result.error.message);
    });
  };

  const handleAutoOutdir = (value) => {
    setAutoOutdir(value);
    API.settingsSet(SettingsKey.AutoOutdir, value).then((result) => {
      if (!result.ok) console.error(result.error.message);
    });
  };

  const handlePickOutputPath = async () => {
    const result = await API.pickDirectory();
    if (result.ok && result.data) {
      setOutputPath(result.data);
      API.setOutputPath(result.data);
    }
  };

  const handlePickStoreDirPath = async () => {
    const result = await API.pickDirectory();
    if (result.ok && result.data) {
      setStoreDirPath(result.data);
      API.setStoreDirPath(result.data);
    }
  };

  const handleNextflowSyntaxParser = (value) => {
    setNextflowSyntaxParser(value);
    API.settingsSet(SettingsKey.NextflowSyntaxParser, value).then((result) => {
      if (!result.ok) console.error(result.error.message);
    });
  };

  useEffect(() => {
    API.settingsGet(SettingsKey.PermitAddCatalogues).then((result) => {
      if (result.ok && result.data !== undefined) setPermitAddCatalogues(result.data);
    });
    API.settingsGet(SettingsKey.PermitCatalogueModifications).then((result) => {
      if (result.ok && result.data !== undefined) setPermitCatalogueModifications(result.data);
    });
    API.settingsGet(SettingsKey.PermitImportShards).then((result) => {
      if (result.ok && result.data !== undefined) setPermitImportShards(result.data);
    });
    API.settingsGet(SettingsKey.PermitAddRepos).then((result) => {
      if (result.ok && result.data !== undefined) setPermitAddRepos(result.data);
    });
    API.settingsGet(SettingsKey.DisableSchemaValidation).then((result) => {
      if (result.ok) setDisableSchemaValidation(result.data);
    });
  }, []);

  useEffect(() => {
    if (navigateToPage === 'environment') {
      setTabValue(4);
      setNavigateToPage('');
    }
  }, [navigateToPage]);

  const TabPanel = (props) => {
    const { children, value, index, ...other } = props;
    return (
      <Box
        role="tabpanel"
        hidden={value !== index}
        id={`vertical-tabpanel-${index}`}
        aria-labelledby={`vertical-tab-${index}`}
        sx={{ width: '100%' }}
        {...other}
      >
        {value === index && (
          <Box sx={{ p: 3, width: '100%' }}>
            <Typography>{children}</Typography>
          </Box>
        )}
      </Box>
    );
  };

  return (
    <Paper
      sx={{
        flexGrow: 1,
        display: 'flex',
        height: '100%'
      }}
    >
      <Tabs
        orientation="vertical"
        variant="scrollable"
        value={tabValue}
        onChange={(_, newValue) => setTabValue(newValue)}
        sx={{ borderRight: 1, borderColor: 'divider' }}
      >
        <Tab id="settings-general-panel" label={t('settings.general')} />
        <Tab id="settings-library-panel" label={t('settings.library')} />
        <Tab id="settings-visual-panel" label={t('settings.visual-options')} />
        <Tab id="settings-language-panel" label={t('settings.language-select')} />
        <Tab id="settings-environment-panel" label={t('settings.environment-options')} />
        <Tab id="settings-advanced-panel" label={t('settings.advanced-options')} />
        <Tab id="settings-licenses-panel" label={t('settings.licenses')} />
      </Tabs>

      <TabPanel value={tabValue} index={0}>
        <Box sx={{ mt: 2, mb: 2 }}>
          <TextField
            label={t('settings.config-folder', 'Config folder')}
            value={collectionsPath || ''}
            fullWidth
            size="small"
            slotProps={{ input: { readOnly: true } }}
            sx={{ mb: 2 }}
          />
          <TextField
            label={t('settings.documents-folder', 'Documents folder')}
            value={documentsPath || ''}
            fullWidth
            size="small"
            slotProps={{ input: { readOnly: true } }}
            sx={{ mb: 2 }}
          />
          <Button variant="contained" id="settings-reopen-setup" onClick={onReopenSetup}>
            {t('settings.reopen-setup', 'Re-run initial setup')}
          </Button>
        </Box>
        <FormControlLabel
          control={
            <Checkbox
              checked={autoOutdir}
              onChange={(e) => handleAutoOutdir(e.target.checked)}
            />
          }
          label={t('settings.auto-outdir', 'Auto-resolve outdir parameter')}
        />
        <Box sx={{ pl: 4, mb: 2, opacity: autoOutdir ? 1 : 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TextField
              label={t('settings.output-folder', 'Output folder')}
              value={outputPath || ''}
              fullWidth
              size="small"
              disabled={!autoOutdir}
              slotProps={{ input: { readOnly: true } }}
            />
            <Button variant="outlined" onClick={handlePickOutputPath} disabled={!autoOutdir}>
              {t('setup.browse', 'Browse')}
            </Button>
          </Box>
        </Box>
        <FormControlLabel
          control={
            <Checkbox
              checked={autoStoreDir}
              onChange={(e) => handleAutoStoreDir(e.target.checked)}
            />
          }
          label={t('settings.auto-store-dir')}
        />
        <Box sx={{ pl: 4, mb: 2, opacity: autoStoreDir ? 1 : 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TextField
              label={t('settings.store-dir-folder', 'Store dir folder')}
              value={storeDirPath || ''}
              fullWidth
              size="small"
              disabled={!autoStoreDir}
              slotProps={{ input: { readOnly: true } }}
            />
            <Button variant="outlined" onClick={handlePickStoreDirPath} disabled={!autoStoreDir}>
              {t('setup.browse', 'Browse')}
            </Button>
          </Box>
        </Box>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <Stack spacing={2} sx={{ mt: 2 }}>
          <FormControlLabel
            control={
              <Switch
                id="settings-permit-add-catalogues"
                checked={permitAddCatalogues}
                onChange={(_, checked) => handlePermitAddCatalogues(checked)}
              />
            }
            label={t('settings.permit-add-catalogues')}
          />
          <FormControlLabel
            control={
              <Switch
                id="settings-permit-catalogue-modifications"
                checked={permitCatalogueModifications}
                onChange={(_, checked) => handlePermitCatalogueModifications(checked)}
              />
            }
            label={t('settings.permit-catalogue-modifications')}
          />
          <FormControlLabel
            control={
              <Switch
                id="settings-permit-import-shards"
                checked={permitImportShards}
                onChange={(_, checked) => handlePermitImportShards(checked)}
              />
            }
            label={t('settings.permit-import-shards')}
          />
          <FormControlLabel
            control={
              <Switch
                id="settings-permit-add-repos"
                checked={permitAddRepos}
                onChange={(_, checked) => handlePermitAddRepos(checked)}
              />
            }
            label={t('settings.permit-add-repos')}
          />
        </Stack>
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <Stack spacing={2}>
          <FormControlLabel
            control={
              <Switch checked={darkMode} onChange={(_, checked) => handleDarkMode(checked)} />
            }
            label={t('settings.dark-mode')}
          />
          <FormControlLabel
            control={
              <Switch checked={showLogPanel} onChange={() => onShowLogPanelChange(!showLogPanel)} />
            }
            label={t('settings.show-log-panel')}
          />
        </Stack>
      </TabPanel>

      <TabPanel value={tabValue} index={3}>
        <Select
          labelId="settings-language-select-label"
          id="settings-language-select"
          value={language}
          label={t('settings.language-select')}
          onChange={handleLanguageChange}
        >
          <MenuItem value="en">English</MenuItem>
          <MenuItem value="fr">Français</MenuItem>
        </Select>
      </TabPanel>

      {/* Update useEffect if environment tab index changes */}
      <TabPanel value={tabValue} index={4}>
        <EnvironmentPage />
      </TabPanel>

      <TabPanel value={tabValue} index={5}>
        <Stack spacing={2}>
          <Box>
            <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
              {t('settings.nextflow-syntax-parser-desc')}
            </Typography>
            <Select
              id="settings-nextflow-syntax-parser"
              value={nextflowSyntaxParser}
              onChange={(e) => handleNextflowSyntaxParser(e.target.value)}
              size="small"
              sx={{ minWidth: 200 }}
            >
              <MenuItem value="1">v1</MenuItem>
              <MenuItem value="2">v2</MenuItem>
            </Select>
          </Box>
          <FormControlLabel
            control={
              <Switch
                checked={disableSchemaValidation}
                onChange={(_, checked) => handleDisableSchemaValidation(checked)}
              />
            }
            label={t('settings.disable-schema-validation')}
          />
          <FormControlLabel
            control={
              <Switch
                checked={showHiddenParams}
                onChange={() => setShowHiddenParams(!showHiddenParams)}
              />
            }
            label={t('settings.show-hidden-params')}
          />
        </Stack>
      </TabPanel>

      <TabPanel value={tabValue} index={6}>
        <LicensesPage />
      </TabPanel>
    </Paper>
  );
}
