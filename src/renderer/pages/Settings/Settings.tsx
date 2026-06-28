import React, { useEffect } from 'react';
import {
  Box,
  Typography,
  Switch,
  FormControlLabel,
  TextField,
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
  setCollectionsPath,
  documentsPath,
  setDocumentsPath,
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
  navigateToPage,
  setNavigateToPage
}) {
  const { t, i18n } = useTranslation();

  const pathRef = React.useRef(null);
  const docsPathRef = React.useRef(null);
  const [language, setLanguage] = React.useState(i18n.language || 'en');
  const [tabValue, setTabValue] = React.useState(0);
  const [disableSchemaValidation, setDisableSchemaValidation] = React.useState(false);

  const handlePathKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handlePathBlur();
      e.target.blur();
    }
  };

  const handlePathBlur = () => {
    const newPath = pathRef.current?.value ?? '';
    if (newPath === collectionsPath) return;
    setCollectionsPath(newPath);
    API.setConfigPath(newPath).then((result) => {
      if (result.ok) console.log(`Collections path updated: ${newPath}`);
    });
  };

  const handleDocsPathKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleDocsPathBlur();
      e.target.blur();
    }
  };

  const handleDocsPathBlur = () => {
    const newPath = docsPathRef.current?.value ?? '';
    if (newPath === documentsPath) return;
    setDocumentsPath(newPath);
    API.setDocumentsPath(newPath).then((result) => {
      if (result.ok) console.log(`Documents path updated: ${newPath}`);
    });
  };

  const handlePickConfigDir = async () => {
    const result = await API.pickDirectory();
    if (result.ok && result.data) {
      setCollectionsPath(result.data);
      API.setConfigPath(result.data);
    }
  };

  const handlePickDocumentsDir = async () => {
    const result = await API.pickDirectory();
    if (result.ok && result.data) {
      setDocumentsPath(result.data);
      API.setDocumentsPath(result.data);
    }
  };

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

  useEffect(() => {
    API.settingsGet(SettingsKey.PermitAddCatalogues).then((result) => {
      if (result.ok) setPermitAddCatalogues(result.data);
    });
    API.settingsGet(SettingsKey.PermitCatalogueModifications).then((result) => {
      if (result.ok) setPermitCatalogueModifications(result.data);
    });
    API.settingsGet(SettingsKey.PermitImportShards).then((result) => {
      if (result.ok) setPermitImportShards(result.data);
    });
    API.settingsGet(SettingsKey.PermitAddRepos).then((result) => {
      if (result.ok) setPermitAddRepos(result.data);
    });
    API.settingsGet(SettingsKey.DisableSchemaValidation).then((result) => {
      if (result.ok) setDisableSchemaValidation(result.data);
    });
  }, []);

  useEffect(() => {
    if (pathRef.current && document.activeElement !== pathRef.current) {
      pathRef.current.value = collectionsPath ?? '';
    }
    if (docsPathRef.current && document.activeElement !== docsPathRef.current) {
      docsPathRef.current.value = documentsPath ?? '';
    }
  }, [collectionsPath, documentsPath]);

  useEffect(() => {
    if (navigateToPage === 'environment') {
      setTabValue(3);
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
        <Tab id="settings-visual-panel" label={t('settings.visual-options')} />
        <Tab id="settings-language-panel" label={t('settings.language-select')} />
        <Tab id="settings-environment-panel" label={t('settings.environment-options')} />
        <Tab id="settings-advanced-panel" label={t('settings.advanced-options')} />
        <Tab id="settings-licenses-panel" label={t('settings.licenses')} />
      </Tabs>

      <TabPanel value={tabValue} index={0}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
          <TextField
            id="settings-collections-path"
            inputRef={pathRef}
            label={t('settings.config-folder', 'Config folder')}
            fullWidth
            defaultValue={collectionsPath}
            onKeyDown={handlePathKeyDown}
            onBlur={handlePathBlur}
          />
          <Button variant="outlined" onClick={handlePickConfigDir}>
            {t('settings.browse', 'Browse')}
          </Button>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
          <TextField
            id="settings-documents-path"
            inputRef={docsPathRef}
            label={t('settings.documents-folder', 'Documents folder')}
            fullWidth
            defaultValue={documentsPath}
            onKeyDown={handleDocsPathKeyDown}
            onBlur={handleDocsPathBlur}
          />
          <Button variant="outlined" onClick={handlePickDocumentsDir}>
            {t('settings.browse', 'Browse')}
          </Button>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 1, display: 'block' }}>
          {t('settings.instances-note', 'Workflow instances go here')}
        </Typography>
        <FormControlLabel
          control={
            <Switch
              id="settings-permit-add-catalogues"
              checked={permitAddCatalogues}
              onChange={() => handlePermitAddCatalogues(!permitAddCatalogues)}
            />
          }
          label={t('settings.permit-add-catalogues')}
        />
        <FormControlLabel
          control={
            <Switch
              id="settings-permit-catalogue-modifications"
              checked={permitCatalogueModifications}
              onChange={() => handlePermitCatalogueModifications(!permitCatalogueModifications)}
            />
          }
          label={t('settings.permit-catalogue-modifications')}
        />
        <FormControlLabel
          control={
            <Switch
              id="settings-permit-import-shards"
              checked={permitImportShards}
              onChange={() => handlePermitImportShards(!permitImportShards)}
            />
          }
          label={t('settings.permit-import-shards')}
        />
        <FormControlLabel
          control={
            <Switch
              id="settings-permit-add-repos"
              checked={permitAddRepos}
              onChange={() => handlePermitAddRepos(!permitAddRepos)}
            />
          }
          label={t('settings.permit-add-repos')}
        />
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <Stack spacing={2}>
          <FormControlLabel
            control={<Switch checked={darkMode} onChange={() => handleDarkMode(!darkMode)} />}
            label={t('settings.dark-mode')}
          />
          <FormControlLabel
            control={
              <Switch
                checked={showLogPanel}
                onChange={() => onShowLogPanelChange(!showLogPanel)}
              />
            }
            label={t('settings.show-log-panel')}
          />
        </Stack>
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
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
      <TabPanel value={tabValue} index={3}>
        <EnvironmentPage />
      </TabPanel>

      <TabPanel value={tabValue} index={4}>
        <Stack spacing={2}>
          <FormControlLabel
            control={
              <Switch
                checked={disableSchemaValidation}
                onChange={() => handleDisableSchemaValidation(!disableSchemaValidation)}
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

      <TabPanel value={tabValue} index={5}>
        <LicensesPage />
      </TabPanel>
    </Paper>
  );
}
