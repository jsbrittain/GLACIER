document.getElementById('build-run').addEventListener('click', async () => {
  const folderPath = document.getElementById('folderPath').value;
  const imageName = document.getElementById('imageName').value || 'custom-image';
  const id = await window.electronAPI.buildAndRunContainer(folderPath, imageName);
  alert('Container built and started with ID: ' + id);
});

document.getElementById('list').addEventListener('click', async () => {
  const containers = await window.electronAPI.listContainers();
  document.getElementById('output').innerText = JSON.stringify(containers, null, 2);
});

document.getElementById('clear').addEventListener('click', async () => {
  const removed = await window.electronAPI.clearStoppedContainers();
  alert('Removed containers:\n' + removed.join('\n'));
});

document.getElementById('clone').addEventListener('click', async () => {
  const repoUrl = document.getElementById('repoUrl').value;
  const targetDir = document.getElementById('targetDir').value;
  const output = await window.electronAPI.cloneRepo(repoUrl, targetDir);
  alert('Cloned repo to: ' + targetDir);
});
