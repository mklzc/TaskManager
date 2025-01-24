const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全 API 给渲染进程
contextBridge.exposeInMainWorld('electron', {
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
    sendToMain: (channel, data) => ipcRenderer.send(channel, data),
    onFromMain: (channel, callback) => ipcRenderer.on(channel, (event, ...args) => callback(...args))
});
