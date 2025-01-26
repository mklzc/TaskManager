const { ipcRenderer } = require('electron');

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Renderer: DOM Content Loaded'); // 确认渲染进程启动

    const scriptList = document.getElementById('script-list');
    console.log('Renderer: Loading scripts...');
    const scripts = await ipcRenderer.invoke('load-scripts');
    console.log('Renderer: Received scripts:', scripts);

    // 更新脚本列表
    scriptList.innerHTML = '';
    scripts.forEach((scriptPath) => {
        const listItem = document.createElement('li');
        listItem.textContent = scriptPath;
        listItem.className = 'script-item';

        listItem.addEventListener('click', () => {
            selectScript(listItem, scriptPath);
        });

        scriptList.appendChild(listItem);
    });
});

function selectScript(listItem, scriptPath) {
    // 移除之前选中的样式
    const prevSelected = document.querySelector('.script-item.selected');
    if (prevSelected) {
        prevSelected.classList.remove('selected');
    }

    // 更新当前选中项
    listItem.classList.add('selected');
    selectedScript = scriptPath;

    console.log('选中脚本:', scriptPath);
}

document.getElementById('run-button').addEventListener('click', () => {
    console.log('run-button clicked');
    // const scriptList = document.getElementById('script-list');
    // const selectedScript = scriptList.selected;
    const selectedItem = document.querySelector('#script-list .selected');

    console.log(`selected ${selectedItem.textContent}`);
    ipcRenderer.send('run-script', selectedItem.textContent);
});

ipcRenderer.on('script-result', (event, result) => {
    if (result.success) {
        alert(`Script ran successfully!\nOutput:\n${result.output}`);
    } else {
        alert(`Failed to run script: ${result.message}`);
    }
});