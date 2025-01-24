const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
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

// 注册 IPC 通信
ipcMain.handle('load-scripts', async () => {
    console.log('ipcMain: Received load-scripts request'); // 调试日志
    try {
        const scriptFilePath = path.join(__dirname, 'scripts.txt');
        if (!fs.existsSync(scriptFilePath)) {
            console.log('scripts.txt not found, creating an empty one.');
            fs.writeFileSync(scriptFilePath, '', 'utf-8');
        }

        const scripts = fs.readFileSync(scriptFilePath, 'utf-8').split('\n').filter(Boolean);
        console.log('Loaded scripts:', scripts); // 打印加载的脚本
        return scripts;
    } catch (error) {
        console.error('Error loading scripts:', error);
        throw error;
    }
});

ipcMain.on('run-script', (event, scriptName) => {
    console.log(`Running script: ${scriptName}`);

    exec(`./scripts/${scriptName}`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error running script: ${error.message}`);
            event.reply('script-result', { success: false, message: error.message });
            return;
        }

        // 将运行结果发送回渲染进程
        console.log(`Script output: ${stdout}`);
        event.reply('script-result', { success: true, output: stdout });
    });

})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
