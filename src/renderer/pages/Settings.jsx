import React from 'react';
import { Container, Typography, Switch, FormControlLabel, TextField } from '@mui/material';
import { API } from '../services/api.js';

export default function SettingsPage({
  darkMode,
  setDarkMode,
  collectionsPath,
  setCollectionsPath
}) {
  const handlePathChange = (e) => {
    const newPath = e.target.value;
    setCollectionsPath(newPath);
    API.setCollectionsPath(newPath);
  };

  return (
    <Container>
      <Typography variant="h6" gutterBottom>
        Settings
      </Typography>

      <FormControlLabel
        control={<Switch checked={darkMode} onChange={() => setDarkMode((prev) => !prev)} />}
        label="Dark Mode"
      />

      <TextField
        label="Collections Directory"
        fullWidth
        value={collectionsPath}
        onChange={handlePathChange}
        sx={{ mt: 2 }}
      />
    </Container>
  );
}
