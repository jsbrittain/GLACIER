import React, { useState } from 'react';
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
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import Avatar from '@mui/material/Avatar';
import NotStartedIcon from '@mui/icons-material/NotStarted';
import DeleteIcon from '@mui/icons-material/Delete';
import IconButton from '@mui/material/IconButton';

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
                {Object.entries(params).map(([key, val]) => (
                  <TextField
                    key={key}
                    label={key}
                    value={val}
                    onChange={(e) => {
                      const newQueue = [...launcherQueue];
                      newQueue[idx].params[key] = e.target.value;
                      setLauncherQueue(newQueue);
                    }}
                    fullWidth
                    size="small"
                  />
                ))}

                <Button variant="contained" onClick={() => onLaunch(repo, params)}>
                  Launch Workflow
                </Button>
              </Stack>
            </Paper>
          ))
      )}
    </Container>
  );
}
