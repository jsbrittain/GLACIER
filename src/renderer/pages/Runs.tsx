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
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
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
    const id = await API.runWorkflow(instance, params, {});
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

  function createData(
    name: string,
    workflow: string,
  ) {
    return { name, workflow };
  }

  const rows = launcherQueue.map((item) =>
    createData(
      item.name,
      item.instance.workflow_version.name,
    )
  );

  return (
    <Container>
      {item === '' ? (
        /* List view for all instances */
        <Box sx={{ mt: 2 }}>
          <Typography variant="h5" gutterBottom>
            {t('runs.title')}
          </Typography>

          <TableContainer component={Paper}>
            <Table sx={{ minWidth: 650 }} aria-label="simple table" size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('runs.table.status')}</TableCell>
                  <TableCell>{t('runs.table.name')}</TableCell>
                  <TableCell>{t('runs.table.workflow')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow
                    key={row.name}
                    sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                  >
                    <TableCell>
                      <IconButton
                        onClick={() => {
                          setItem(row.name);
                          setSelectedTab(launcherQueue.findIndex(i => i.name === row.name));
                        }}
                      >
                        <NotStartedIcon />
                      </IconButton>
                    </TableCell>
                    <TableCell component="th" scope="row">
                      {row.name}
                    </TableCell>
                    <TableCell>{row.workflow}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

        </Box>
      ) : (
        /* Parameters view for a selected workflow */
        launcherQueue
          .filter(({ name }) => name === item)
          .map(({ instance, name }, idx) =>
            hasWorkflowRun ? (
              <MonitorPage
                instance={instance}
                logMessage={logMessage}
              />
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
