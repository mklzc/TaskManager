const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    mainWindow.loadFile('index.html');
    // 打开开发者工具（调试用）
    mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

// 加载脚本
ipcMain.handle('load-scripts', async () => {
    console.log('ipcMain: Received load-scripts request');
    try {
        const scriptsJsonPath = path.join(__dirname, 'scripts.json');
        
        if (!fs.existsSync(scriptsJsonPath)) {
            console.log('scripts.json not found, creating an empty one.');
            fs.writeFileSync(scriptsJsonPath, '', 'utf-8');
        }

        const fileContent = fs.readFileSync(scriptsJsonPath, 'utf-8');
        const scripts = JSON.parse(fileContent || '[]');

        return scripts
    } catch (error) {
        console.error('Error loading scripts:', error);
        throw error;
    }
});

ipcMain.on('run-script', (event, command) => {
    console.log(`Running script: ${command}`);

    exec(`${command}`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error running script: ${error.message}`);
            event.reply('script-result', { success: false, message: error.message });
            return;
        }

        console.log(`Script output: ${stdout}`);
        event.reply('script-result', { success: true, output: stdout });
    });
});

ipcMain.handle('open-add-script-form', async () => {
    // 打开自定义的 HTML 页面作为对话框
    let addScriptWindow = new BrowserWindow({
        width: 800,
        height: 600,
        parent: mainWindow,
        modal: true,
        show: false,  // 初始化不显示，待加载完成后显示
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false, // 如果启用了 contextIsolation，请根据需要调整预加载脚本
        },
    });

    // 加载表单页面
    addScriptWindow.loadFile('add-script-form.html');

    // 显示窗口
    addScriptWindow.once('ready-to-show', () => {
        addScriptWindow.show();
    });

    return new Promise((resolve, reject) => {
        addScriptWindow.on('close', () => {
            resolve('窗口已关闭');
        });
    });
});

// 保存脚本数据到 JSON 文件
const scriptsJsonPath = path.join(__dirname, 'scripts.json');
ipcMain.handle('save-script-data', (event, scriptData) => {
    let scripts = [];

    // 检查文件是否存在
    const scriptsJsonPath = path.join(__dirname, 'scripts.json');

    const fileContent = fs.readFileSync(scriptsJsonPath, 'utf-8');
    if (fileContent.trim() === '') {
        scripts = [];
    }
    else {
        scripts = JSON.parse(fileContent);
    }
    scripts.push(scriptData);

    // 写入文件
    fs.writeFileSync(scriptsJsonPath, JSON.stringify(scripts, null, 2), 'utf-8');
    console.log('脚本已保存:', scriptData);
});

fs.watchFile(scriptsJsonPath, () => {
    console.log("Scripts.json updated.");
    mainWindow.webContents.send("scripts-updated");
});

ipcMain.on('delete-script', (event, selectedScript) => {
    if (!fs.existsSync(scriptsJsonPath)) {
        return;
    }

    console.log("recieve OK");
    let scripts = JSON.parse(fs.readFileSync(scriptsJsonPath, 'utf-8'));

    console.log(scripts);

    const updatedScripts = scripts.filter(script => script.scriptName !== selectedScript.scriptName);

    console.log(updatedScripts);

    if (updatedScripts.length === scripts.length) {
        // 未找到待删除脚本
        console.log(`Error find selectedScript ${selectedScript.scriptName}`);
        return;
    }

    fs.writeFileSync(scriptsJsonPath, JSON.stringify(updatedScripts, null, 2), 'utf-8');
    event.reply('script-deleted', selectedScript.scriptName);
});


app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
