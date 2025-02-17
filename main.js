const { app, BrowserWindow, ipcMain, Tray, Menu } = require('electron');
const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

let mainWindow;
let tray = null;
let runningProcesses = {};

const userDataPath = app.getPath('userData');

const scriptsJsonPath = path.join(userDataPath, 'scripts.json');

console.log(scriptsJsonPath);
const logsDir = path.join(userDataPath, 'logs');

if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// ------创建托盘图标------
function createTray() {
    if (tray) return;

    tray = new Tray(path.join(__dirname, 'assets/icon.ico'));
    const contextMenu = Menu.buildFromTemplate([
        {
            label: '显示主界面',
            click: () => {
                mainWindow.show();
            }
        },
        {
            label: '退出',
            click: () => {
                app.isQuiting = true;
                app.quit();
            }
        }
    ]);

    tray.setToolTip('任务管理器');
    tray.setContextMenu(contextMenu);

    tray.on('double-click', () => {
        mainWindow.show();
    });
}

// ------创建窗口------
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    mainWindow.loadFile('./src/index.html');
    const menu = Menu.buildFromTemplate([
        {
            label: '应用',
            submenu: [
                { label: '设置', click: () => mainWindow.webContents.send('navigate', 'settings.html') },
                { type: 'separator' },
                { label: '退出', role: 'quit' }
            ]
        },
        {
            label: '编辑',
            submenu: [
                { label: '撤销', role: 'undo' },
                { label: '重做', role: 'redo' },
                { type: 'separator' },
                { label: '剪切', role: 'cut' },
                { label: '复制', role: 'copy' },
                { label: '粘贴', role: 'paste' },
            ]
        },
        {
            label: '帮助',
            submenu: [
                // { label: '关于', click: () => mainWindow.webContents.send('navigate', 'about.html') },
                { label: '开发者工具', role: 'toggleDevTools' }
            ]
        }
    ]);
    Menu.setApplicationMenu(menu);
    createTray();

    mainWindow.on('close', (event) => {
        if (!app.isQuiting) {
            event.preventDefault();
            mainWindow.hide();
            createTray();
        }
        return false;
    });

    fs.watchFile(scriptsJsonPath, () => {
        console.log("Scripts.json updated.");
        mainWindow.webContents.send("scripts-updated");
    });

    // debug
    // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

// ------处理页面导航------
ipcMain.on('navigate', (event, page) => {
    if (mainWindow) {
        mainWindow.loadFile(path.join(__dirname, `src/${page}`));
    }
});

// ------加载任务内容------
ipcMain.handle('load-scripts', async () => {
    console.log('ipcMain: Received load-scripts request');
    try {
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

// ------运行任务------
ipcMain.on('run-script', (event, selectedScript) => {
    if (runningProcesses[selectedScript.scriptName]) {
        console.log(`${selectedScript.scriptName} 已在运行中`);
        return;
    }

    let command;
    const directoryPath = path.dirname(selectedScript.scriptPath);
    const ext = path.extname(selectedScript.scriptPath);

    switch (ext) {
        case '.py':
            const venvPath = path.join(directoryPath, '.venv');
            if (fs.existsSync(venvPath)) {
                const pythonExecutable = process.platform === "win32"
                    ? path.join(venvPath, "Scripts", "python.exe")
                    : path.join(venvPath, "bin", "python");
                command = `${pythonExecutable} -u ${selectedScript.scriptPath}`
            }
            else {
                command = `python -u ${selectedScript.scriptPath}`;
            }
            break;
        case '.sh':
            command = `bash ${selectedScript.scriptPath}`;
            break;
        case '.bat':
            command = ``;
            break;
        case '.js':
            command = `node ${selectedScript.scriptPath}`;
            break;
        default:
            command = `${selectedScript.scriptPath}`;
    };
    console.log(`Running script: ${command} ${selectedScript.scriptParams}`);
    const logFilePath = path.join(logsDir, `${selectedScript.scriptName}.log`);
    const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });
    event.sender.send('status-update', { scriptName: selectedScript.scriptName, status: 'running' });

    if (selectedScript.runMode === "exec") {
        exec(`${command}  ${selectedScript.scriptParams}`, { cwd: directoryPath }, (error, stdout, stderr) => {
            let logData = `\n[${new Date().toLocaleString()}] 执行: ${scriptPath}\n`;
            if (error) {
                console.error(`Error running script: ${error.message}`);
                logData += `错误: ${error.message}\n`;
                event.reply('script-result', error.message);
                return;
            }

            if (stderr) {
                logData += `[STDERR] ${stderr}\n`;
            }

            logData += `[STDOUT] ${stdout}\n`;
            fs.appendFile(logFilePath, logData, 'utf-8', (err) => {
                if (err) {
                    console.error(`日志写入失败: ${err.message}`);
                } else {
                    event.sender.send('update-log', logContent, selectedScript.scriptName);
                }
            });
        });
    }
    else {
        const scriptProcess = spawn(command, [selectedScript.scriptParams], { shell: true, cwd: directoryPath });
        console.log(`${selectedScript.scriptName} spawn here ${command} ${selectedScript.scriptParams}`);
        runningProcesses[selectedScript.scriptName] = scriptProcess;
        const logDate = `\n[${new Date().toLocaleString()}] 执行: ${selectedScript.scriptName}\n`;
        logStream.write(logDate);
        event.sender.send('update-log', logDate, selectedScript.scriptName);
        scriptProcess.stdout.on('data', (data) => {
            console.log(`[STDOUT] ${data}`);
            const logData = `[STDOUT] ${data}`;
            logStream.write(logData);
            event.sender.send('update-log', logData, selectedScript.scriptName);
        });

        scriptProcess.stderr.on('data', (data) => {
            console.log(`[STDERR] ${data}`)
            const logData = `[LOG] ${data}`;
            logStream.write(logData);
            event.sender.send('update-log', logData, selectedScript.scriptName);
        });

        scriptProcess.on('close', (code) => {
            delete runningProcesses[selectedScript.scriptName];
            const logData = `\n[Process Exited] Exit code: ${code}\n`;

            logStream.write(logData);
            logStream.end();

            event.sender.send('status-update', { scriptName: selectedScript.scriptName, status: 'stopped' });
            event.sender.send('update-log', logData, selectedScript.scriptName);
        });
    }
});

// ------停止任务------
ipcMain.on('stop-script', (event, scriptName) => {
    const scriptProcess = runningProcesses[scriptName];

    if (scriptProcess) {
        const pid = scriptProcess.pid;
        console.log(`trying to kill ${pid} ${process.platform}`)
        if (process.platform === 'win32') {
            console.log(`exec taskkill /PID ${pid} /T /F`);
            exec(`taskkill /PID ${pid} /T /F`, (error) => {
                if (error) {
                    console.error(`终止 ${scriptName} 失败:`, error);
                } else {
                    console.log(`${scriptName} 已被成功终止`);
                    event.sender.send('status-update', { scriptName: scriptName, status: 'stopped' });
                }
            });
        } else {
            // Unix/Linux
            scriptProcess.kill(-pid);
        }
    }
});

// ------添加任务------
ipcMain.handle('open-add-script-form', async () => {
    let addScriptWindow = new BrowserWindow({
        width: 800,
        height: 600,
        parent: mainWindow,
        modal: true,
        show: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });
    addScriptWindow.loadFile('./src/add-script-form.html');
    Menu.setApplicationMenu(null);
    addScriptWindow.once('ready-to-show', () => {
        addScriptWindow.show();
    });

    // addScriptWindow.webContents.openDevTools();
    return new Promise((resolve, reject) => {
        addScriptWindow.on('close', () => {
            resolve('窗口已关闭');
        });
    });
});

ipcMain.handle('save-script-data', (event, scriptData) => {
    let scripts = [];

    const fileContent = fs.readFileSync(scriptsJsonPath, 'utf-8');
    if (fileContent.trim() === '') {
        scripts = [];
    }
    else {
        scripts = JSON.parse(fileContent);
    }
    scripts.push(scriptData);

    fs.writeFileSync(scriptsJsonPath, JSON.stringify(scripts, null, 2), 'utf-8');
    console.log('脚本已保存:', scriptData);
});

// ------编辑任务内容------

ipcMain.handle('edit-script', async (event, selectedScript) => {
    let editScriptWindow = new BrowserWindow({
        width: 800,
        height: 600,
        parent: mainWindow,
        modal: true,
        show: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    editScriptWindow.loadFile('./src/edit-script-form.html');
    editScriptWindow.once('ready-to-show', () => {
        editScriptWindow.show();
        console.log("send selectedScript to edit", selectedScript);
        editScriptWindow.webContents.send('load-script-data', selectedScript);
    });
    // editScriptWindow.webContents.openDevTools();
});

ipcMain.handle('update-script-data', (event, updatedScript) => {
    console.log("recieve updatedScript", updatedScript);
    let scripts = [];

    const fileContent = fs.readFileSync(scriptsJsonPath, 'utf-8');
    if (fileContent.trim() === '') {
        scripts = [];
    }
    else {
        scripts = JSON.parse(fileContent);
    }

    const index = scripts.findIndex(script => script.scriptName === updatedScript.scriptName);
    if (index !== -1) {
        scripts[index] = updatedScript;
    }
    fs.writeFileSync(scriptsJsonPath, JSON.stringify(scripts, null, 2), 'utf-8');
});

// --------删除任务--------

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
        // 未找到待删除任务
        console.log(`Error find selectedScript ${selectedScript.scriptName}`);
        return;
    }

    fs.writeFileSync(scriptsJsonPath, JSON.stringify(updatedScripts, null, 2), 'utf-8');
    event.reply('script-deleted', selectedScript.scriptName);
});

// ------删除日志------

ipcMain.on('delete-log', (event, selectedScript) => {
    const logFilePath = path.join(logsDir, `${selectedScript.scriptName}.log`);
    fs.truncate(logFilePath, 0, (err) => {
        if (err) {
            console.error('清空文件失败:', err);
        } else {
            console.log('日志文件已清空');
        }
    });
});

// ------获取日志------
ipcMain.on('get-log', (event, scriptName) => {
    const logFilePath = path.join(logsDir, `${scriptName}.log`);
    if (fs.existsSync(logFilePath)) {
        const logContent = fs.readFileSync(logFilePath, 'utf-8');
        if (logContent.trim().length === 0) {
            event.reply('load-log', '[No log available]');
        }
        else {
            event.reply('load-log', logContent);
        }
    } else {
        event.reply('load-log', '[No log available]');
    }
});

// ------任务交互功能------
ipcMain.on('script-interact', (event, script, scriptInput) => {
    const focusProcess = runningProcesses[script.scriptName];
    if (focusProcess) {
        try {
            console.log(focusProcess);
            focusProcess.stdin.write(scriptInput);
            focusProcess.stdin.end();

        } catch (error) {
            console.log("读取输入失败");
        }
    } else {
        console.log(`${script.scriptName} isn't running`);
        return;
    }
});

// ------设置开机自启------
ipcMain.on('setAutoLaunch', (event, enable) => {
    app.setLoginItemSettings({
        openAtLogin: enable,
        path: app.getPath('exe')
    });
});

// ------获取当前开机自启状态------
ipcMain.on('getAutoLaunch', (event) => {
    const isEnabled = app.getLoginItemSettings().openAtLogin;
    event.sender.send('autoLaunchStatus', isEnabled); // 发送状态回渲染进程
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
