import React, { useState, useEffect, useMemo } from 'react';
import { Box, Paper, Stack, Tabs, Tab, Typography, Button, Menu, MenuItem, Tooltip } from '@mui/material';
import { JsonForms } from '@jsonforms/react';
import Ajv, { ErrorObject } from 'ajv'; // ajv is also used by jsonforms
import { buildUISchema } from './buildUISchema';
import { renderers } from './renderers';
import MarkdownRenderer from './MarkdownRenderer';
import TestRunDialog from './TestRunDialog.js';
import { SettingsKey } from '../../../types/settings.js';
import { API } from '../../services/api.js';
import { useTranslation } from 'react-i18next';

const ajv = new Ajv({
  useDefaults: true, // populate all fields (if not provided)
  allErrors: true,
  strict: false
});

// add custom AJV formats
ajv.addFormat('file-path', {
  type: 'string',
  validate: (v: string) => typeof v === 'string' && v.length > 0
});
ajv.addFormat('directory-path', {
  type: 'string',
  validate: (v: string) => typeof v === 'string' && v.length > 0
});
ajv.addFormat('path', {
  type: 'string',
  validate: (v: string) => typeof v === 'string' && v.length > 0
});

function TabPanel({ children, value, index }) {
  return value === index ? <Box sx={{ p: 2, flexGrow: 1 }}>{children}</Box> : null;
}

export default function ParametersPage({
  instance,
  refreshInstancesList,
  showHiddenParams,
  logMessage,
  onEditComplete,
  startOnParamsTab
}) {
  const { t } = useTranslation();
  const default_profile = 'standard';

  const [disableSchemaValidation, setDisableSchemaValidation] = useState<boolean>(false);

  const [params, setParams] = useState<Record<string, unknown>>({});
  const [schema, setSchema] = useState<Record<string, unknown> | null>({});
  const [allProfiles, setAllProfiles] = useState<string[]>([]);
  const [tabSelected, setTabSelected] = React.useState(startOnParamsTab ? 2 : 0);
  const [readme, setReadme] = useState<string>('');
  const [paramsMenuAnchor, setParamsMenuAnchor] = useState<null | HTMLElement>(null);
  const [license, setLicense] = useState<string>('');
  const [isValidWorkflow, setIsValidWorkflow] = useState<boolean>(true);

  const paramsFilter = 'JSON';
  const paramsFileFilters = [{ name: paramsFilter, extensions: ['json'] }];

  const onLaunch = async (instance, params) => {
    if (!isValidWorkflow) {
      logMessage(t('parameters.no-valid-workflow'), 'error');
      return;
    }
    if (schemaErrors !== null) {
      setTabSelected(2);
      return;
    }
    // Strip out profile from params before sending to backend
    const call_params = { ...params };
    const profile = params['profile'] || default_profile;
    delete call_params['profile'];
    // Return PID on success
    const result = await API.runWorkflow(instance, call_params, { profile: profile });
    if (!result.ok) {
      logMessage(`Error launching workflow: ${result.error.message || 'Unknown error'}`, 'error');
      return;
    }
    logMessage(`Launched workflow ${instance.name}`);
    refreshInstancesList();
    if (onEditComplete) onEditComplete();
  };

  const onSaveParams = async () => {
    const filePathResult = await API.showSaveDialog({ filters: paramsFileFilters });
    if (!filePathResult.ok) return;
    const filePath = filePathResult.data;
    if (!filePath) return;
    await API.writeTextFile(filePath, JSON.stringify(params, null, 2));
    logMessage(`Parameters saved to ${filePath}`);
  };

  const onLoadParams = async () => {
    const pickResult = await API.pickFile(paramsFileFilters);
    if (!pickResult.ok) return;
    const filePath = pickResult.data;
    if (!filePath) return;
    const readResult = await API.readTextFile(filePath);
    if (!readResult.ok) return;
    try {
      const loaded = JSON.parse(readResult.data);
      if (typeof loaded !== 'object' || loaded === null || Array.isArray(loaded)) {
        logMessage('Invalid parameters file: must be a JSON object.', 'error');
        return;
      }
      setParams(loaded);
      setTabSelected(2);
      logMessage(`Parameters loaded from ${filePath}`);
    } catch {
      logMessage('Invalid parameters file: could not parse JSON.', 'error');
    }
  };

  const onTestLaunchWorkflow = async (testProfiles) => {
    const test_profiles_str = testProfiles.join(',');
    const result = await API.runWorkflow(instance, {}, { profile: test_profiles_str });
    if (!result.ok) {
      logMessage(`Error launching test workflow: ${result.error.message}`, 'error');
      return;
    }
    logMessage(`Launched test workflow ${instance.name}`);
    refreshInstancesList();
  };

  useEffect(() => {
    const getSettings = async () => {
      const schemaValResult = await API.settingsGet(SettingsKey.DisableSchemaValidation);
      if (schemaValResult.ok) setDisableSchemaValidation(schemaValResult.data);
    };
    const get_available_profiles = async () => {
      const profilesResult = await API.getAvailableProfiles(instance);
      if (!profilesResult.ok) return [default_profile];
      const profiles = profilesResult.data;
      setAllProfiles(profiles || []);
      return profiles || [default_profile];
    };
    const get_schema = async (profiles: string[]) => {
      const schemaResult = await API.getWorkflowSchema(instance.workflow_version.path);
      if (!schemaResult.ok) return;
      let schema = schemaResult.data;
      // Add profile selection to the a separate schema category
      if (profiles.length > 0) {
        if (!schema['Launch settings']) {
          schema['Launch settings'] = {};
        }
        schema['Launch settings']['profile'] = {
          type: 'array',
          title: 'Execution Profile(s)',
          description: 'Select one or more execution profile to use',
          items: {
            type: 'string',
            enum: profiles
          },
          uniqueItems: true,
          default: profiles.includes(default_profile)
            ? [default_profile]
            : profiles.length > 0
              ? [profiles[0]]
              : []
        };
      }
      setSchema(schema);
    };
    const get_params = async () => {
      const paramsResult = await API.getWorkflowInstanceParams(instance);
      if (paramsResult.ok && paramsResult.data) {
        setParams(paramsResult.data);
      }
    };
    const fetchReadme = async () => {
      const result = await API.getWorkflowReadme(instance);
      if (result.ok) {
        setReadme(result.data || '');
      }
    };
    const fetchLicense = async () => {
      const result = await API.getWorkflowLicense(instance);
      if (result.ok) {
        setLicense(result.data || '');
      }
    };
    const checkValidWorkflow = async () => {
      const result = await API.isValidWorkflowRepo(instance.workflow_version.path);
      if (result.ok) {
        setIsValidWorkflow(result.data);
      }
    };

    get_available_profiles().then((profiles) => {
      getSettings();
      get_schema(profiles);
      get_params();
      fetchReadme();
      fetchLicense();
      checkValidWorkflow();
    });
  }, [instance]);

  // Read schema and compile with AJV
  const validate = useMemo(() => {
    if (disableSchemaValidation) {
      // no-op validator
      const fn: any = () => true;
      fn.errors = null;
      return fn;
    }
    return ajv.compile(schema);
  }, [schema]);

  // Build the UI schema with stepper options
  const uischema = buildUISchema(schema, { showHidden: showHiddenParams });
  (uischema as any).options = { variant: 'stepper', showNavButtons: true };

  const schemaErrors: ErrorObject[] | null = useMemo(() => {
    if (disableSchemaValidation) {
      return null;
    }

    try {
      validate(params);
      return validate.errors ?? null;
    } catch {
      return [{ instancePath: '', keyword: 'schema', message: 'Invalid schema' } as any];
    }
  }, [params, validate]);

  const isEmpty = (obj) => {
    return Object.keys(obj).length === 0;
  };

  const handleTabChange = (event, newValue) => {
    setTabSelected(newValue);
  };

  const handleParamsMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setParamsMenuAnchor(event.currentTarget);
  };

  const handleParamsMenuClose = () => {
    setParamsMenuAnchor(null);
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Typography variant="h6">
          [{instance.name}] {instance.workflow_version.name}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            id="params-file-menu-button"
            aria-controls={paramsMenuAnchor ? 'params-file-menu' : undefined}
            aria-haspopup="true"
            aria-expanded={paramsMenuAnchor ? 'true' : undefined}
            onClick={handleParamsMenuOpen}
            variant="outlined"
          >
            {t('parameters.params-menu')}
          </Button>
          <Menu
            id="params-file-menu"
            anchorEl={paramsMenuAnchor}
            open={Boolean(paramsMenuAnchor)}
            onClose={handleParamsMenuClose}
          >
            <MenuItem
              onClick={() => {
                handleParamsMenuClose();
                onLoadParams();
              }}
            >
              {t('parameters.load-params')}
            </MenuItem>
            <MenuItem
              onClick={() => {
                handleParamsMenuClose();
                onSaveParams();
              }}
            >
              {t('parameters.save-params')}
            </MenuItem>
          </Menu>
          <Tooltip
            title={!isValidWorkflow ? t('parameters.no-valid-workflow') : ''}
            disableHoverListener={isValidWorkflow}
          >
            <span>
              <Button
                variant="contained"
                onClick={() => onLaunch(instance, params)}
              >
                {t('parameters.launch-workflow')}
              </Button>
            </span>
          </Tooltip>
          {allProfiles.includes('test') && (
            <TestRunDialog allProfiles={allProfiles} onLaunch={onTestLaunchWorkflow} />
          )}
        </Box>
      </Box>

      <Tabs value={tabSelected} onChange={handleTabChange}>
        <Tab label={t('parameters.info.title')} id="parameters-info-tab" />
        <Tab
          label={t('parameters.license.title')}
          id="parameters-license-tab"
          disabled={isEmpty(license)}
        />
        <Tab label={t('parameters.params.title')} id="parameters-params-tab" />
      </Tabs>

      <TabPanel value={tabSelected} index={0}>
        <MarkdownRenderer content={readme} basePath={instance.workflow_version.path} />
      </TabPanel>

      <TabPanel value={tabSelected} index={1}>
        <MarkdownRenderer content={license} basePath={instance.workflow_version.path} />
      </TabPanel>

      <TabPanel value={tabSelected} index={2}>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Paper
            variant="outlined"
            sx={{ p: 2, mb: 2, '& .MuiCardContent-root > div > * + *': { mt: 1.5 } }}
          >
            {!isEmpty(schema) ? (
              <JsonForms
                schema={schema}
                uischema={uischema}
                data={params}
                renderers={renderers}
                onChange={({ data }) => setParams(data)}
                ajv={disableSchemaValidation ? undefined : ajv}
              />
            ) : (
              <Typography>{t('parameters.params.no-parameters')}</Typography>
            )}
          </Paper>
        </Stack>
      </TabPanel>
    </Box>
  );
}
