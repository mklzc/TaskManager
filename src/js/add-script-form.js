const { ipcRenderer } = require('electron');

const form = document.getElementById('scriptForm');
const cancelButton = document.getElementById('cancelButton');

// 提交表单

cancelButton.addEventListener('click', (event) => {
    console.log("Cancel Add Task");
    window.close();
});

form.addEventListener('submit', (event) => {
    event.preventDefault();  // 阻止默认表单提交行为

    const scriptName = document.getElementById('scriptName').value;
    const scriptPath = document.getElementById('scriptPath').value;
    const scriptParams = document.getElementById('scriptParams').value;
    const runMode = document.querySelector('input[name="run-mode"]:checked').value;

    // 发送脚本信息到主进程
    ipcRenderer.invoke('save-script-data', { scriptName, scriptPath, scriptParams, runMode });

    // 关闭窗口
    window.close();
});
