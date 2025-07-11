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

function TabPanel({ children, value, index }) {
  return value === index ? <Box sx={{ p: 2, flexGrow: 1 }}>{children}</Box> : null;
}

export default function RunsPage({
  launcherQueue,
  setLauncherQueue,
  selectedTab,
  setSelectedTab,
  onLaunch
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
      <Typography variant="h5" gutterBottom>
        Runs
      </Typography>

      <Box sx={{ width: '100%' }}>
        <Tabs
          orientation="horizontal"
          value={selectedTab}
          onChange={handleTabChange}
          variant="standard"
          sx={{
            '& .MuiTab-root': {
              backgroundColor: 'action.hover',
              borderRadius: 1,
              padding: '6px 12px',
              marginRight: 1,
              '&.Mui-selected': {
                backgroundColor: 'primary.main',
                color: 'primary.contrastText',
                fontWeight: 'bold'
              },
              '&:hover': {
                backgroundColor: 'action.selected'
              }
            },
            borderBottom: 'none'
          }}
        >
          {launcherQueue.map(({ name }, idx) => (
            <Tab key={name} label={name} />
          ))}
        </Tabs>

        {launcherQueue.map(({ repo, params, name }, idx) => (
          <TabPanel key={name} value={selectedTab} index={idx}>
            <Paper variant="outlined" sx={{ p: 2, height: '100%', boxSizing: 'border-box' }}>
              <Typography variant="h6">{name}</Typography>
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
          </TabPanel>
        ))}
      </Box>
    </Container>
  );
}
