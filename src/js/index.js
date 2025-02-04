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
            selectScript(listItem, script);
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
            logOutput.textContent = '';
        }
    });
});

function selectScript(listItem, script) {
    // 移除之前选中的样式
    const prevSelected = document.querySelector('.script-item.selected');
    if (prevSelected) {
        prevSelected.classList.remove('selected');
        if (prevSelected.classList.contains('selected-line')) {
            prevSelected.classList.remove('selected-line');
        }
    }

    // 更新当前选中项
    listItem.classList.add('selected');

    if (!listItem.classList.contains('running')) {
        listItem.classList.add('selected-line');
    }
    
    selectedScript = script;

    console.log('选中脚本:', script.scriptName);
}

document.getElementById('run-button').addEventListener('click', () => {
    console.log('run-button clicked');

    const selectedItem = document.querySelector('#script-list .selected');
    
    selectedScript = scripts.find(s => s.scriptName === selectedItem.textContent);

    ipcRenderer.send('run-script', selectedScript);
});

document.getElementById('stop-button').addEventListener('click', () => {
    if (selectedScript) {
        console.log(`stopping ${selectedScript.scriptName}`);
        ipcRenderer.send('stop-script', selectedScript.scriptName);
    }
    else {
        console.log("请先选择一个脚本");
    }
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


document.getElementById('edit-button').addEventListener('click', async () => {
    if (selectedScript) {
        try {
            ipcRenderer.invoke('edit-script', selectedScript);
        } catch (err) {
            console.log("编辑失败");
        }
    } else {
        console.log("请先选择一个脚本");
    }
})

ipcRenderer.on('update-log', (event, data) => {
    logOutput.textContent += `${data}\n`;
    logOutput.scrollTop = logOutput.scrollHeight; // 滚动到底部
});

ipcRenderer.on('load-log', (event, logContent) => {
    logOutput.textContent = logContent;
    logOutput.scrollTop = logOutput.scrollHeight;
});

ipcRenderer.on('status-update', (event, { scriptName, status }) => {

    console.log(`changing status ${scriptName} to ${status}`);
    let scriptItem = null;
    document.querySelectorAll(".script-item").forEach(item => {
        if (item.textContent.trim() === scriptName) {
            scriptItem = item;
        }
    });
    console.log(scriptItem.innerHTML);
    if (scriptItem) {
        if (status === 'running') {
            scriptItem.classList.add('running');
            scriptItem.classList.remove('selected-line');
        } else {
            scriptItem.classList.remove('running');
            scriptItem.classList.add('selected-line');
        }
    }
});