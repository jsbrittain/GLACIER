import React, { useState, useMemo, useEffect } from 'react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import MainPage from './pages/Main';
import { API } from './services/api';

import './i18n.js';

export default function App() {
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [themeRecord, setThemeRecord] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    API.getTheme().then((res: any) => {
      if (res?.ok && res.data) {
        setThemeRecord(res.data);
      }
    });
  }, []);

  const theme = useMemo(() => {
    const palette = (themeRecord?.palette as Record<string, any>) || {};
    if (darkMode) {
      return createTheme({
        palette: {
          mode: 'dark',
          ...(palette.primary && { primary: palette.primary }),
          ...(palette.secondary && { secondary: palette.secondary }),
          ...(palette.error && { error: palette.error }),
          ...(palette.warning && { warning: palette.warning }),
          ...(palette.info && { info: palette.info }),
          ...(palette.success && { success: palette.success }),
          ...(palette.divider && { divider: palette.divider })
        },
        components: {
          MuiTab: {
            styleOverrides: {
              root: ({ theme }) => ({
                '&.Mui-selected': {
                  color: theme.palette.text.primary
                }
              })
            }
          },
          MuiButton: {
            styleOverrides: {
              textPrimary: ({ theme }) => ({
                color: theme.palette.text.primary
              }),
              outlinedPrimary: ({ theme }) => ({
                color: theme.palette.text.primary,
                borderColor: theme.palette.divider
              })
            }
          }
        }
      });
    }
    return createTheme({
      palette: { ...palette, mode: 'light' }
    });
  }, [darkMode, themeRecord]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <MainPage darkMode={darkMode} setDarkMode={setDarkMode} />
    </ThemeProvider>
  );
}
