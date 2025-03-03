const { contextBridge, ipcRenderer } = require('electron');
console.log("mainWindow")
contextBridge.exposeInMainWorld('mainWindow', {
    loadURL: (u) => ipcRenderer.send('load-url', u),
    getURLs: () => ipcRenderer.invoke('get-urls'),
    onErrorMsg: (callback) => {
        ipcRenderer.on('set-error-msg', (event, message) => {
          callback(message);
        });
      }
});