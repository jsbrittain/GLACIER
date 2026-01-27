import React, { useState, useEffect, useMemo } from 'react';
import { uniqueNamesGenerator, adjectives, animals } from 'unique-names-generator';
import {
  AppBar,
  Box,
  Button,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  TextField,
  Typography,
  Snackbar,
  Paper,
  Alert
} from '@mui/material';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import Toolbar from '@mui/material/Toolbar';
import MenuIcon from '@mui/icons-material/Menu';
import HubIcon from '@mui/icons-material/Hub';
import LibraryIcon from '@mui/icons-material/Apps';
import InstancesIcon from '@mui/icons-material/Storage';
import SettingsIcon from '@mui/icons-material/Settings';
import ListItemIcon from '@mui/material/ListItemIcon';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import { useTranslation } from 'react-i18next';

import HubPage from './Hub';
import LibraryPage from './Library';
import InstancesPage from './Instances';
import SettingsPage from './Settings/Settings';
import { API } from '../services/api.js';

export default function TitleBar({ drawerOpen, setDrawerOpen, view }) {
  const { t } = useTranslation();

  return (
    <AppBar
      position="fixed"
      sx={{
        width: `calc(100% - ${drawerOpen ? 200 : 56}px)`,
        ml: drawerOpen ? '200px' : '56px',
        transition: (theme) =>
          theme.transitions.create(['width', 'margin-left'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen
          })
      }}
    >
      <Toolbar>
        <IconButton color="inherit" edge="start" onClick={() => setDrawerOpen((prev) => !prev)}>
          <MenuIcon />
        </IconButton>
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            px: 1
          }}
        >
          <Typography variant="h6" noWrap component="div" sx={{ ml: 1 }}>
            {t(`sidebar.${view}`)}
          </Typography>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
