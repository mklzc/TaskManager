const { ipcRenderer } = require('electron');

const form = document.getElementById('scriptForm');
const cancelButton = document.getElementById('cancelButton');

cancelButton.addEventListener('click', (event) => {
    console.log("Cancel Add Task");
    window.close();
});

ipcRenderer.on('load-script-data', (event, scriptData) => {
    console.log("接收到脚本数据:", scriptData);
    document.getElementById('scriptName').value = scriptData.scriptName;
    document.getElementById('scriptPath').value = scriptData.scriptPath;
    document.getElementById('scriptParams').value = scriptData.scriptParams;

    if (scriptData.runMode === 'spawn') {
        document.getElementById('runModeSpawn').checked = true;
    } else if (scriptData.runMode === 'exec') {
        document.getElementById('runModeExec').checked = true;
    }
});

form.addEventListener('submit', (event) => {
    event.preventDefault();

    const scriptName = document.getElementById('scriptName').value;
    const scriptPath = document.getElementById('scriptPath').value;
    const scriptParams = document.getElementById('scriptParams').value;
    const runMode = document.querySelector('input[name="run-mode"]:checked').value;

    // 发送脚本信息到主进程

    const updatedScript = { scriptName, scriptPath, scriptParams, runMode };
    
    ipcRenderer.invoke('update-script-data', updatedScript);

    // 关闭窗口
    window.close();
});
