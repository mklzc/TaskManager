const { ipcRenderer } = require('electron');

let scripts = [];
const contextMenu = document.getElementById('context-menu');
const logOutput = document.getElementById('log-output');
let selectedScript = null;

async function refreshScripts() {
    console.log('Refreshing Scripts...');
    scripts = await ipcRenderer.invoke('load-scripts');
    renderScripts();
}

function renderScripts() {
    const scriptList = document.getElementById('script-list');
    console.log('Renderer: Loading scripts...');
    console.log('Renderer: Received scripts:', scripts);

    // 更新脚本列表
    scriptList.innerHTML = '';
    scripts.forEach((script) => {
        const listItem = document.createElement('li');
        listItem.textContent = script.scriptName;
        listItem.className = 'script-item';

        listItem.addEventListener('click', () => {
            selectScript(listItem, script.scriptName);
            ipcRenderer.send('get-log', script.scriptName);
        });

        // 绑定右键菜单事件
        listItem.addEventListener('contextmenu', (event) => {
            event.preventDefault();
            selectedScript = script;

            contextMenu.style.top = `${event.clientY}px`;
            contextMenu.style.left = `${event.clientX}px`;
            contextMenu.style.display = 'block';
            console.log(`右键菜单打开: ${script.scriptName}`);
        });


        scriptList.appendChild(listItem);
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Renderer: DOM Content Loaded'); // 确认渲染进程启动
    await refreshScripts();

    ipcRenderer.on('scripts-updated', async () => {
        console.log('Scripts updates recieved');
        await refreshScripts();
    });
    
    document.addEventListener('click', () => {
        contextMenu.style.display = 'none';
    });

    const runScriptMenuItem = document.getElementById('run-script');
    const deleteScriptMenuItem = document.getElementById('delete-script');
    const deletelogScriptMenuItem = document.getElementById('delete-log');

    runScriptMenuItem.addEventListener('click', () => {
        if (selectedScript) {
            ipcRenderer.send('run-script', selectedScript);
        }
        contextMenu.style.display = 'none';
    });

    deleteScriptMenuItem.addEventListener('click', () => {
        if (selectedScript) {
            console.log(`删除脚本: ${selectedScript.scriptName}`);
            ipcRenderer.send('delete-script', selectedScript);
            refreshScripts();
        }
    });

    deletelogScriptMenuItem.addEventListener('click', () => {
        if (selectedScript) {
            console.log(`清除脚本日志：${selectedScript.scriptName}`);
            ipcRenderer.send('delete-log', selectedScript);
            logOutput = '';
        }
    });
});

function selectScript(listItem, scriptName) {
    // 移除之前选中的样式
    const prevSelected = document.querySelector('.script-item.selected');
    if (prevSelected) {
        prevSelected.classList.remove('selected');
    }

    // 更新当前选中项
    listItem.classList.add('selected');
    selectedScript = scriptName;

    console.log('选中脚本:', scriptName);
}

document.getElementById('run-button').addEventListener('click', () => {
    console.log('run-button clicked');

    const selectedItem = document.querySelector('#script-list .selected');
    
    const selectedScript = scripts.find(s => s.scriptName === selectedItem.textContent);

    ipcRenderer.send('run-script', selectedScript);
});


document.getElementById('add-script-button').addEventListener('click', async () => {
    try {
        const result = await ipcRenderer.invoke('open-add-script-form');
        if (result) {
            console.log('脚本信息:', result);
            refreshScripts();
        } else {
            console.log('用户取消了操作。');
        }
    } catch (err) {
        console.error('打开对话框失败:', err);
    }
});

ipcRenderer.on('update-log', (event, data) => {
    logOutput.textContent += `${data}\n`;
    logOutput.scrollTop = logOutput.scrollHeight; // 滚动到底部
});

ipcRenderer.on('load-log', (event, logContent) => {
    logOutput.textContent = logContent;
    logOutput.scrollTop = logOutput.scrollHeight;
});

ipcRenderer.on('status-update', (event, { scriptName, status }) => {
    let scriptItem = null;
    document.querySelectorAll(".script-item").forEach(item => {
        if (item.textContent.trim() === scriptName) {
            scriptItem = item;
        }
    });
    if (scriptItem) {
        if (status === 'running') {
            scriptItem.classList.add('running');
        } else {
            scriptItem.classList.remove('running');
        }
    }
});