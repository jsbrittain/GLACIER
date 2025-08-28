import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Container,
  Paper,
  Stack,
  Tabs,
  Tab,
  TextField,
  Typography,
  Button,
  Alert
} from '@mui/material';
import { FilePickerControl } from './FilePickerControl';
import { JsonForms } from '@jsonforms/react';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import Avatar from '@mui/material/Avatar';
import NotStartedIcon from '@mui/icons-material/NotStarted';
import DeleteIcon from '@mui/icons-material/Delete';
import IconButton from '@mui/material/IconButton';
import Ajv, { ErrorObject } from 'ajv'; // ajv is also used by jsonforms
import { buildUISchema } from './buildUISchema';
import { renderers } from './renderers';
import { API } from '../services/api.js';

const ajv = new Ajv({ allErrors: true, strict: false });
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

export default function RunsPage({
  launcherQueue,
  setLauncherQueue,
  selectedTab,
  setSelectedTab,
  onLaunch,
  item,
  setItem
}) {
  const [data, setData] = useState<Record<string, unknown>>({});
  const [schema, setSchema] = useState<Record<string, unknown> | null>({});

  useEffect(() => {
    const get_schema = async () => {
      const matched_items = launcherQueue.filter(({ name }) => name === item);
      console.log('matched_items', matched_items);
      if (matched_items.length === 1) {
        const schema = await API.getWorkflowSchema(matched_items[0].repo.path);
        setSchema(schema);
      }
    };
    get_schema();
  }, [launcherQueue, item]);

  // Read schema and compile with AJV
  const validate = useMemo(() => ajv.compile(schema), []);

  // Build the UI schema with stepper options
  const uischema = buildUISchema(schema, { showHidden: false });
  (uischema as any).options = { variant: 'stepper', showNavButtons: true };

  const schemaErrors: ErrorObject[] | null = useMemo(() => {
    try {
      validate(data);
      return validate.errors ?? null;
    } catch {
      return [{ instancePath: '', keyword: 'schema', message: 'Invalid schema' } as any];
    }
  }, [data, validate]);

  const handleTabChange = (event, newIndex) => {
    setSelectedTab(newIndex);
  };

  if (launcherQueue.length === 0) {
    return (
      <Container>
        <Typography variant="h6" sx={{ mt: 2 }}>
          No workflows queued.
        </Typography>
      </Container>
    );
  }

  const activeWorkflow = launcherQueue[selectedTab];

  return (
    <Container>
      {item === '' ? (
        <Box sx={{ mt: 2 }}>
          <Typography variant="h5" gutterBottom>
            Runs
          </Typography>

          <List>
            {launcherQueue.map(({ repo, params, name }, idx) => (
              <Paper key={idx} elevation={2} sx={{ mb: 2, p: 1 }}>
                <ListItemButton
                  onClick={() => {
                    setItem(name);
                    setSelectedTab(idx);
                  }}
                >
                  <ListItemAvatar>
                    <Avatar>
                      <NotStartedIcon />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText primary={name} secondary={repo.name} />
                </ListItemButton>
              </Paper>
            ))}
          </List>
        </Box>
      ) : (
        launcherQueue
          .filter(({ name }) => name === item)
          .map(({ repo, params, name }, idx) => (
            <Paper variant="outlined" sx={{ p: 2, height: '100%', boxSizing: 'border-box' }}>
              <Typography variant="h6">
                [{name}] {repo.name}
              </Typography>
              <Alert severity="warning">Parameters are not currently passed to the workflow.</Alert>
              <Stack spacing={2} sx={{ mt: 1 }}>
                <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                  <JsonForms
                    schema={schema}
                    uischema={uischema}
                    data={data}
                    renderers={renderers}
                    onChange={({ data, errors }) => setData(data)}
                    ajv={ajv}
                  />
                </Paper>
                <Button
                  disabled={schemaErrors !== null}
                  variant="contained"
                  onClick={() => onLaunch(repo, params)}
                >
                  Launch Workflow
                </Button>
              </Stack>
            </Paper>
          ))
      )}
    </Container>
  );
}
