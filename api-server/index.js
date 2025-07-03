import express from 'express';
import { cloneRepo, syncRepo, getWorkflowParams } from '../src/main/repo.js';
import { getCollections, getCollectionsPath, getDefaultCollectionsDir } from '../src/main/paths.js';
import { runRepo } from '../src/main/docker.js';

import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());

app.use(express.static(path.join(__dirname, '../public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.post('/api/clone', async (req, res) => {
  try {
    res.json(await cloneRepo(req.body.repoRef));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/run', async (req, res) => {
  try {
    res.json(await runRepo(req.body));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sync', async (req, res) => {
  try {
    res.json(await syncRepo(req.body));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/collections', async (_, res) => {
  try {
    res.json(await getCollectionsPath());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/collections-path', (req, res) => {
  try {
    res.send(getDefaultCollectionsDir()); // Should store a server-side path
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Build and Run container
app.post('/api/build-run', async (req, res) => {
  try {
    const { folder, image } = req.body;
    const result = await buildAndRunContainer(folder, image);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List running containers
app.get('/api/containers', async (req, res) => {
  try {
    const containers = await listContainers();
    res.json(containers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Clear stopped containers
app.post('/api/containers/clear-stopped', async (req, res) => {
  try {
    const removed = await clearStoppedContainers();
    res.json(removed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get logs for container (assuming logs return as text)
app.get('/api/containers/:id/logs', async (req, res) => {
  try {
    const containerId = req.params.id;
    const logs = await getContainerLogs(containerId); // implement accordingly
    res.type('text/plain').send(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stop a container
app.post('/api/containers/:id/stop', async (req, res) => {
  try {
    const containerId = req.params.id;
    await stopContainer(containerId);
    res.json({ status: 'stopped' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a cloned repo (careful with this!)
app.post('/api/delete-repo', async (req, res) => {
  try {
    const { repoPath } = req.body;
    await deleteRepo(repoPath); // implement a function that deletes the folder
    res.json({ status: 'deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/workflow-params', async (req, res) => {
  try {
    const repoPath = req.query.repoPath;
    if (!repoPath) {
      return res.status(400).json({ error: 'Missing repoPath query parameter' });
    }
    const params = await getWorkflowParams(repoPath);
    res.json(params);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3030;
app.listen(PORT, () => {
  console.log(`✅ API server listening on http://localhost:${PORT}`);
});
