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
import Tooltip from '@mui/material/Tooltip';
import MonitorPage from './Monitor/Monitor';
import ParametersPage from './Parameters/Parameters';
import { JsonForms } from '@jsonforms/react';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import Avatar from '@mui/material/Avatar';
import CreatedIcon from '@mui/icons-material/PlayCircle';
import ClosedIcon from '@mui/icons-material/PlayCircle';
import RunningIcon from '@mui/icons-material/Update';
import QuestionMarkIcon from '@mui/icons-material/QuestionMark';
import CompletedIcon from '@mui/icons-material/CheckCircle';
import FailedIcon from '@mui/icons-material/Error';
import IconButton from '@mui/material/IconButton';
import { API } from '../services/api.js';
import { useTranslation } from 'react-i18next';
import { WorkflowStatus } from '../../types/types';

const InstanceList = ({ rows, setItem, instancesList, refreshInstancesList }) => {
  const { t } = useTranslation();

  useEffect(() => {
    // initial refresh on page load
    refreshInstancesList();
    // then refresh every 5 seconds
    const timer = setInterval(async () => {
      refreshInstancesList();
    }, 5000);
    // cleanup on unmount
    return () => clearInterval(timer);
  }, []);

  const StatusIcon = ({ status }: { status: string }) => {
    const IconWithToolTip = (icon: React.JSX.Element, s: string = status) => (
      <Tooltip title={`${t('instances.table.status')}: ${t('instances.statuses.' + s)}`}>
        {icon}
      </Tooltip>
    );
    switch (status) {
      case WorkflowStatus.Created:
        return IconWithToolTip(<CreatedIcon color="primary" />);
      case WorkflowStatus.Running:
        return IconWithToolTip(<RunningIcon color="secondary" />);
      case WorkflowStatus.Completed:
        return IconWithToolTip(<CompletedIcon color="success" />);
      case WorkflowStatus.Closed:
        return IconWithToolTip(<ClosedIcon color="disabled" />);
      case WorkflowStatus.Failed:
        return IconWithToolTip(<FailedIcon color="error" />);
      default:
        return (
          <Tooltip title={`Unknown status: ${status}`}>
            <QuestionMarkIcon />
          </Tooltip>
        );
    }
  };

  const handleDeleteInstance = async (name: string) => {
    if (!confirm(t('instances.delete_confirm', { name }))) {
      return;
    }
    const instance = instancesList.find((item) => item.name === name).instance;
    console.log('Instance to delete: ', instance.id);
    API.deleteWorkflowInstance(instance).then(() => {
      refreshInstancesList();
    });
  };

  return (
    <Box>
      <TableContainer component={Paper}>
        <Table sx={{ minWidth: 650 }} aria-label="simple table" size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('instances.table.status')}</TableCell>
              <TableCell>{t('instances.table.name')}</TableCell>
              <TableCell>{t('instances.table.workflow')}</TableCell>
              <TableCell>{t('instances.table.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.name} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                <TableCell>
                  <IconButton
                    onClick={() => {
                      setItem(row.name);
                    }}
                  >
                    <StatusIcon status={row.status} />
                  </IconButton>
                </TableCell>
                <TableCell component="th" scope="row">
                  {row.name}
                </TableCell>
                <TableCell>{row.workflow}</TableCell>
                <TableCell align="right">
                  <Button onClick={() => handleDeleteInstance(row.name)} variant="contained">
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default function InstancesPage({
  instancesList,
  refreshInstancesList,
  logMessage,
  item,
  setItem
}) {
  const { t } = useTranslation();

  const [rows, setRows] = useState([]);

  const onLaunch = async (instance, params) => {
    API.runWorkflow(instance, params, {}).then(() => {
      logMessage(`Launched workflow ${instance.name}`);
    });
  };

  useEffect(() => {
    setRows(
      instancesList.map((item) =>
        createData(
          item.instance.status,
          item.instance.id,
          item.name,
          item.instance.workflow_version.name
        )
      )
    );
  }, [instancesList]);

  const createData = (status: string, id: string, name: string, workflow: string) => {
    return { status, id, name, workflow };
  };

  return (
    <Container>
      {item === '' ? (
        /* List view for all instances */
        <InstanceList
          rows={rows}
          setItem={setItem}
          instancesList={instancesList}
          refreshInstancesList={refreshInstancesList}
        />
      ) : (
        /* Detail view for a selected instance */
        instancesList
          .filter(({ name }) => name === item)
          .map(({ name, instance }) => {
            const status = rows.find((r) => r.name === name)?.status;
            return status == WorkflowStatus.Created ? (
              /* Parameters view to launch a selected workflow */
              <ParametersPage
                instance={instance}
                refreshInstancesList={refreshInstancesList}
                logMessage={logMessage}
              />
            ) : (
              /* Monitoring view after launching a workflow */
              <MonitorPage instance={instance} logMessage={logMessage} />
            );
          })
      )}
      {instancesList.length === 0 && (
        <Container>
          <Typography variant="h6" sx={{ mt: 2 }}>
            {t('instances.no-instances')}
          </Typography>
        </Container>
      )}
    </Container>
  );
}
