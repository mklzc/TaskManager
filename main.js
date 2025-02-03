const { app, BrowserWindow, ipcMain, Tray, Menu } = require('electron');
const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

let mainWindow;
let tray = null;

function createTray() {
    if (tray) return;  // 防止重复创建托盘图标

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

    // 双击托盘图标显示主界面
    tray.on('double-click', () => {
        mainWindow.show();
    });
}

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
    createTray();

    mainWindow.on('close', (event) => {
        if (!app.isQuiting) {
            event.preventDefault();
            mainWindow.hide();
            createTray();
        }
        return false;
    })

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

const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

let runningProcesses = {};

ipcMain.on('run-script', (event, selectedScript) => {
    if (runningProcesses[selectedScript.scriptName]) {
        console.log(`${selectedScript.scriptName} 已在运行中`);
        return;
    }

    let command;
    ext = path.extname(selectedScript.scriptPath);
    switch (ext) {
        case '.py':
            command = `python -u ${selectedScript.scriptPath}`;
            break;
        case '.sh':
            command = `bash ${selectedScript.scriptPath}`;
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
        exec(`${command}  ${selectedScript.scriptParams}`, (error, stdout, stderr) => {
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
                    event.sender.send('update-log', logContent);
                }
            });
        });
    }
    else {
        const scriptProcess = spawn(command, [selectedScript.scriptParams], { shell: true });
        console.log(`${selectedScript.scriptName} 已在运行中`);
        runningProcesses[selectedScript.scriptName] = scriptProcess;
        const logDate = `\n[${new Date().toLocaleString()}] 执行: ${selectedScript.scriptName}\n`;
        logStream.write(logDate);
        event.sender.send('update-log', logDate);
        scriptProcess.stdout.on('data', (data) => {
            console.log(`command's stdout ${data}`);
            const logData = `[STDOUT] ${data}`;
            logStream.write(logData);
            event.sender.send('update-log', logData);
        });

        scriptProcess.stderr.on('data', (data) => {
            const logData = `[STDERR] ${data}`;
            logStream.write(logData);
            event.sender.send('update-log', logData);
        });

        scriptProcess.on('close', (code) => {
            delete runningProcesses[selectedScript.scriptName];
            const logData = `\n[Process Exited] Exit code: ${code}\n`;
            
            logStream.write(logData);
            logStream.end();
        
            event.sender.send('status-update', { scriptName: selectedScript.scriptName, status: 'stopped' });
            event.sender.send('update-log', logData);
        });
    }
});

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

ipcMain.on('delete-log', (event, selectedScript) => {
    const logFilePath = path.join(__dirname, 'logs', `${selectedScript.scriptName}.log`);

    fs.truncate(logFilePath, 0, (err) => {
        if (err) {
            console.error('清空文件失败:', err);
        } else {
            console.log('日志文件已清空');
        }
    });

});

ipcMain.on('get-log', (event, scriptName) => {
    const logFilePath = path.join(logsDir, `${scriptName}.log`);
    if (fs.existsSync(logFilePath)) {
        const logContent = fs.readFileSync(logFilePath, 'utf-8');
        event.reply('load-log', logContent);
    } else {
        event.reply('load-log', '[No log available]');
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
