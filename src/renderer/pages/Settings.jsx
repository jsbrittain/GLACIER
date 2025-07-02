import React from 'react';
import { Container, Typography, Switch, FormControlLabel } from '@mui/material';

export default function SettingsPage({ darkMode, setDarkMode }) {
  return (
    <Container>
      <Typography variant="h6" gutterBottom>
        Settings
      </Typography>
      <FormControlLabel
        control={<Switch checked={darkMode} onChange={() => setDarkMode((prev) => !prev)} />}
        label="Dark Mode"
      />
    </Container>
  );
}
