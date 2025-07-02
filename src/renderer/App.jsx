import React, { useState } from 'react';

export default function App() {
  const [folderPath, setFolderPath] = useState('');
  const [imageName, setImageName] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [targetDir, setTargetDir] = useState('');
  const [output, setOutput] = useState('');

  const handleBuildRun = async () => {
    const id = await window.electronAPI.buildAndRunContainer(folderPath, imageName);
    alert('Container built and started with ID: ' + id);
  };

  const handleClone = async () => {
    const result = await window.electronAPI.cloneRepo(repoUrl, targetDir);
    alert(result);
  };

  const handleList = async () => {
    const containers = await window.electronAPI.listContainers();
    setOutput(JSON.stringify(containers, null, 2));
  };

  const handleClear = async () => {
    const removed = await window.electronAPI.clearStoppedContainers();
    alert('Removed containers:\n' + removed.join('\n'));
  };

  return (
    <div style={{ padding: '1rem' }}>
      <h1>Electron + React + Vite</h1>

      <div>
        <input
          placeholder="Path to folder with Dockerfile"
          value={folderPath}
          onChange={(e) => setFolderPath(e.target.value)}
          style={{ width: '400px' }}
        /><br />
        <input
          placeholder="Docker image name"
          value={imageName}
          onChange={(e) => setImageName(e.target.value)}
        /><br />
        <button onClick={handleBuildRun}>Build & Run</button>
        <button onClick={handleList}>List Containers</button>
        <button onClick={handleClear}>Clear Stopped Containers</button>
      </div>

      <hr />

      <div>
        <input
          placeholder="GitHub repo URL"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          style={{ width: '400px' }}
        />
        <input
          placeholder="Local clone path"
          value={targetDir}
          onChange={(e) => setTargetDir(e.target.value)}
          style={{ width: '300px' }}
        />
        <button onClick={handleClone}>Clone Repo</button>
      </div>

      <pre style={{ marginTop: '1rem', backgroundColor: '#f0f0f0', padding: '1rem' }}>{output}</pre>
    </div>
  );
}
