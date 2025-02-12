const { ipcRenderer } = require('electron');

document.getElementById('back-to-main').addEventListener('click', () => {
    ipcRenderer.send('navigate', 'index.html');
});