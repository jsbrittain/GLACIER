import React from 'react';
import {
  Button,
  Container,
  Paper,
  Stack,
  TextField
} from '@mui/material';

export default function WorkflowPage({
  repoUrl,
  setRepoUrl,
  targetDir,
  setTargetDir,
  folderPath,
  setFolderPath,
  imageName,
  setImageName,
  output,
  setOutput,
  onClone,
  onBuildRun,
  onList,
  onClear
}) {
  return (
    <Container>
      <Stack spacing={2}>
        <TextField label="GitHub repo URL" fullWidth value={repoUrl} onChange={e => setRepoUrl(e.target.value)} />
        <TextField label="Local clone path" fullWidth value={targetDir} onChange={e => setTargetDir(e.target.value)} />
        <Button variant="contained" onClick={onClone}>Clone Repo</Button>
        <TextField label="Path to folder with Dockerfile" fullWidth value={folderPath} onChange={e => setFolderPath(e.target.value)} />
        <TextField label="Assign image name" fullWidth value={imageName} onChange={e => setImageName(e.target.value)} />
        <Stack direction="row" spacing={2}>
          <Button variant="contained" onClick={onBuildRun}>Build & Run</Button>
          <Button variant="outlined" onClick={onList}>List Containers</Button>
          <Button variant="outlined" color="warning" onClick={onClear}>Clear Stopped</Button>
        </Stack>
        <Paper sx={{ p: 2, mt: 2, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>{output}</Paper>
      </Stack>
    </Container>
  );
}
