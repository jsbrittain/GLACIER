import React from 'react';
import { AppBar, Box, IconButton, Typography } from '@mui/material';
import Toolbar from '@mui/material/Toolbar';
import MenuIcon from '@mui/icons-material/Menu';
import { useTranslation } from 'react-i18next';

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
