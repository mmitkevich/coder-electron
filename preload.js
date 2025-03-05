const { contextBridge, ipcRenderer } = require('electron');
console.log("preload")
let windowId = null;

contextBridge.exposeInMainWorld('ipc', {
    loadURL: (url) => ipcRenderer.send('load-url', windowId, url),
    getURLs: () => ipcRenderer.invoke('get-urls'),
    onErrorMsg: (callback) => {
        ipcRenderer.on('set-error-msg', (event, message) => {
          callback(message);
        });
      }
});

ipcRenderer.on('set-window-id', (event, id) => {
  windowId = id
  console.log('Unique Window ID:', windowId);
  // Now you can use the windowId for any matching logic
});