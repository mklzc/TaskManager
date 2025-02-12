const { ipcRenderer } = require('electron');

document.getElementById('back-to-main').addEventListener('click', () => {
    ipcRenderer.send('navigate', 'index.html');
});

document.addEventListener("DOMContentLoaded", async () => {
    const checkbox = document.getElementById("autoLaunchCheckbox");
    
    ipcRenderer.send('getAutoLaunch');
    ipcRenderer.on('autoLaunchStatus', (event, isEnabled) => {
        checkbox.checked = isEnabled;
    });
    checkbox.addEventListener("change", () => {
        ipcRenderer.send('setAutoLaunch', checkbox.checked);
    });
});