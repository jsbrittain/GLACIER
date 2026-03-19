import React, { useState, useEffect, useMemo } from 'react';
import { Box, Paper, Stack, Tabs, Tab, Typography, Button } from '@mui/material';
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
  logMessage
}) {
  const { t } = useTranslation();
  const default_profile = 'standard';

  const [disableSchemaValidation, setDisableSchemaValidation] = useState<boolean>(false);

  const [params, setParams] = useState<Record<string, unknown>>({});
  const [schema, setSchema] = useState<Record<string, unknown> | null>({});
  const [allProfiles, setAllProfiles] = useState<string[]>([]);
  const [tabSelected, setTabSelected] = React.useState(0);
  const [readme, setReadme] = useState<string>('');
  const [license, setLicense] = useState<string>('');

  const onLaunch = async (instance, params) => {
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
  };

  const onTestLaunchWorkflow = async (testProfiles) => {
    const test_profiles_str = testProfiles.join(',');
    await API.runWorkflow(instance, {}, { profile: test_profiles_str });
    logMessage(`Launched test workflow ${instance.name}`);
    refreshInstancesList();
  };

  useEffect(() => {
    const getSettings = async () => {
      setDisableSchemaValidation(await API.settingsGet(SettingsKey.DisableSchemaValidation));
    };
    const get_available_profiles = async () => {
      const profiles = await API.getAvailableProfiles(instance);
      setAllProfiles(profiles || []);
      return profiles || [default_profile];
    };
    const get_schema = async (profiles: string[]) => {
      let schema = await API.getWorkflowSchema(instance.workflow_version.path);
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
      const data = await API.getWorkflowInstanceParams(instance);
      if (data) {
        setParams(data);
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

    get_available_profiles().then((profiles) => {
      getSettings();
      get_schema(profiles);
      get_params();
      fetchReadme();
      fetchLicense();
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

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Typography variant="h6">
          [{instance.name}] {instance.workflow_version.name}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            disabled={schemaErrors !== null}
            variant="contained"
            onClick={() => onLaunch(instance, params)}
          >
            {t('parameters.launch-workflow')}
          </Button>
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
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
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
