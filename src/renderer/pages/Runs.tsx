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
import MonitorPage from './Monitor';
import ParametersPage from './Parameters';
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
import { API } from '../services/api.js';
import { useTranslation } from 'react-i18next';

export default function RunsPage({
  launcherQueue,
  setLauncherQueue,
  selectedTab,
  setSelectedTab,
  logMessage,
  item,
  setItem
}) {
  const { t } = useTranslation();

  const [hasWorkflowRun, setHasWorkflowRun] = useState(false);

  const onLaunch = async (instance, params) => {
    const id = await API.runWorkflow(instance, params);
    logMessage(`Launched workflow ${instance.name}`);
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
        /* List view for all instances */
        <Box sx={{ mt: 2 }}>
          <Typography variant="h5" gutterBottom>
            {t('runs.title')}
          </Typography>

          <List>
            {launcherQueue.map(({ instance, name }, idx) => (
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
                  <ListItemText primary={name} secondary={instance.workflow_version.name} />
                </ListItemButton>
              </Paper>
            ))}
          </List>
        </Box>
      ) : (
        /* Parameters view for a selected workflow */
        launcherQueue
          .filter(({ name }) => name === item)
          .map(({ instance, name }, idx) =>
            hasWorkflowRun ? (
              <MonitorPage instance={instance} logMessage={logMessage} />
            ) : (
              <ParametersPage
                instance={instance}
                logMessage={logMessage}
                setHasWorkflowRun={setHasWorkflowRun}
              />
            )
          )
      )}
    </Container>
  );
}
