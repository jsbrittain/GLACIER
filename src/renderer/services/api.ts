const isElectron = Boolean(window?.electronAPI);

const electronAPI = isElectron
  ? {
      createWorkflowInstance: (workflow_id) =>
        window.electronAPI.createWorkflowInstance(workflow_id),
      runWorkflow: (instance, params) => window.electronAPI.runWorkflow(instance, params),
      listWorkflowInstances: () => window.electronAPI.listWorkflowInstances(),
      getWorkflowInstanceLogs: (instance, logType) =>
        window.electronAPI.getWorkflowInstanceLogs(instance, logType),

      // Legacy calls
      cloneRepo: (repoRef) => window.electronAPI.cloneRepo(repoRef),
      syncRepo: (repo) => window.electronAPI.syncRepo(repo),
      getCollections: () => window.electronAPI.getCollections(),
      buildAndRunContainer: (folder, image) =>
        window.electronAPI.buildAndRunContainer(folder, image),
      listContainers: () => window.electronAPI.listContainers(),
      clearStoppedContainers: () => window.electronAPI.clearStoppedContainers(),
      getCollectionsPath: () => window.electronAPI.getCollectionsPath(),
      setCollectionsPath: (path) => window.electronAPI.setCollectionsPath(path),
      getContainerLogs: (containerId) => window.electronAPI.getContainerLogs(containerId),
      stopContainer: (containerId) => window.electronAPI.stopContainer(containerId),
      deleteRepo: (repoPath) => window.electronAPI.deleteRepo(repoPath),
      getWorkflowParams: (repoPath) => window.electronAPI.getWorkflowParams(repoPath),
      getWorkflowSchema: (repoPath) => window.electronAPI.getWorkflowSchema(repoPath)
    }
  : null;

const httpAPI = {
  createWorkflowInstance: async (workflow_id) => {
    const res = await fetch('/api/create-workflow-instance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflow_id })
    });
    if (!res.ok) throw new Error(`Failed to create workflow instance: ${res.statusText}`);
    return res.json();
  },

  cloneRepo: async (repoRef) => {
    const res = await fetch('/api/clone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoRef })
    });
    if (!res.ok) throw new Error(`Clone failed: ${res.statusText}`);
    return res.json();
  },

  runRepo: async (repo) => {
    const res = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(repo)
    });
    if (!res.ok) throw new Error(`Run failed: ${res.statusText}`);
    return res.json();
  },

  syncRepo: async (repo) => {
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: repo })
    });
    if (!res.ok) throw new Error(`Sync failed: ${res.statusText}`);
    return res.json();
  },

  getCollections: async () => {
    const res = await fetch('/api/collections');
    if (!res.ok) throw new Error(`Failed to get collections: ${res.statusText}`);
    return res.json();
  },

  buildAndRunContainer: async (folder, image) => {
    const res = await fetch('/api/build-run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder, image })
    });
    if (!res.ok) throw new Error(`Build and run failed: ${res.statusText}`);
    return res.json();
  },

  listContainers: async () => {
    const res = await fetch('/api/containers');
    if (!res.ok) throw new Error(`Failed to list containers: ${res.statusText}`);
    return res.json();
  },

  clearStoppedContainers: async () => {
    const res = await fetch('/api/containers/clear-stopped', {
      method: 'POST'
    });
    if (!res.ok) throw new Error(`Failed to clear containers: ${res.statusText}`);
    return res.json();
  },

  getCollectionsPath: async () => {
    const res = await fetch('/api/collections-path');
    if (!res.ok) throw new Error('Failed to get collections path');
    return res.text(); // since we send plain text
  },

  setCollectionsPath: async (path) => {
    // implement if you add a POST endpoint for saving path
  },

  getContainerLogs: async (containerId) => {
    const res = await fetch(`/api/containers/${containerId}/logs`);
    if (!res.ok) throw new Error(`Failed to get logs: ${res.statusText}`);
    return res.text(); // assuming logs come as text stream
  },

  stopContainer: async (containerId) => {
    const res = await fetch(`/api/containers/${containerId}/stop`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error(`Failed to stop container: ${res.statusText}`);
    return res.json();
  },

  deleteRepo: async (repoPath) => {
    const res = await fetch('/api/delete-repo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoPath })
    });
    if (!res.ok) throw new Error(`Failed to delete repo: ${res.statusText}`);
    return res.json();
  },

  getWorkflowParams: async (repoPath) => {
    const res = await fetch(`/api/workflow-params?repoPath=${encodeURIComponent(repoPath)}`);
    if (!res.ok) throw new Error('Failed to fetch workflow params');
    return res.json();
  },

  getWorkflowSchema: async (repoPath) => {
    const res = await fetch(`/api/workflow-schema?repoPath=${encodeURIComponent(repoPath)}`);
    if (!res.ok) throw new Error('Failed to fetch workflow schema');
    return res.json();
  }
};

export const API = isElectron ? electronAPI : httpAPI;
