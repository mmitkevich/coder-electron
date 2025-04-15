const { app, BrowserWindow, ipcMain,Menu } = require('electron');
const path = require('path'); 
const yaml = require('js-yaml');
const fs = require('fs')
const os = require('os')
// globals
let windows = []
let urls = [];

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    console.log("found second instance");
    app.quit(); // Quit if another instance is already running
    return;
}


const MAX_HISTORY = 10; // Set max history size

// Ignore certificate errors
app.commandLine.appendSwitch('ignore-certificate-errors');
console.log("userData=",app.getPath('userData')); //# , '/custom/path/for/app1');

let configPath;

if (process.platform === 'win32') {
  // On Windows, store in the userData folder by default:
  configPath = path.join(app.getPath('userData'), 'coder.yaml');
} else {
  // On Linux/macOS, store in ~/.config
  configPath = path.join(os.homedir(), '.config', 'coder.yaml');
}

function dedup(arr) {
    if(!Array.isArray(arr)) {
        console.log("not array arr=",arr);
        return arr;
    }
    const seen = new Set();
    return arr.filter(item => {
      if (seen.has(item)) {
        return false;
      } else {
        seen.add(item);
        return true;
      }
    });
}

// Load config from YAML file
function loadConfig(configPath) {
    try {
        console.log("load config ", configPath)
        const config = yaml.load(fs.readFileSync(configPath, 'utf8'));
        urls = config.urls || [];
        console.log("config urls=", urls)
        urls = dedup(urls);
    } catch (e) {
        console.error('Error loading config:', e);
        urls = [];
    }
}

// Save updated URLs back to YAML file
function saveConfig(configPath) {
    try {
        console.log("write config ",configPath, 'urls=',urls);
        fs.writeFileSync(configPath, yaml.dump({urls:urls}), 'utf8');
    } catch (e) {
        console.error('Error saving config:', e);
    }
}


app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    // Prevent having error
    event.preventDefault();
    // and continue
    callback(true);

});

function createMainWindow() {
    wnd = new BrowserWindow({
        width: 1280,
        height: 800,
        titleBarStyle: 'hidden',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'), // Securely expose ipcRenderer
            contextIsolation: true, 
            enableRemoteModule: false, 
            nodeIntegration: false,
            //partition: 'persist:new_partition' // Use a fresh partition
        },
        ...(process.platform !== 'darwin' ? { titleBarOverlay: true } : {})
    });
    initMenu();
    windows.push(wnd);
    // Get the unique ID of the BrowserWindow
    const windowId = wnd.webContents.id;
    console.log("created windowId=",windowId);
    // Send the unique ID to the renderer process
    wnd.webContents.once('did-finish-load', () => {
        wnd.webContents.send('set-window-id', windowId);
    });

    wnd.maximize();
    wnd.loadFile(path.join(__dirname, 'index.html'));
    loadConfig(configPath);

    const interval = setInterval(() => {
        if (wnd.isDestroyed()) {
          clearInterval(interval);
          return;
        }
        //windows.forEach((w) => {
        //    if (w !== undefined) {
        //      w.title = w.title.replace(/code-server/g, w.webContents.getURL());
        //    }
        //});
        wnd.title = wnd.title.replace(/code-server/g, wnd.webContents.getURL());
    }, 1000);

    wnd.on('closed', () => {
        windows = windows.filter((w) => w=!wnd);
        console.log("closed ");//,wnd.webContents.id, wnd.webContents.getURL());
    });
}

app.on('second-instance', (event, commandLine, workingDirectory) => {
    console.log('second-instance requested commandLine=',commandLine);
    // If a second instance is launched, open a new window in the existing app
    createMainWindow();
});

app.on('ready', () => {
   createMainWindow()
});

function initMenu() {
    const template = [
        {
          label: 'File',
          submenu: [
            {
              label: 'New Window',
              accelerator: 'CmdOrCtrl+N',
              click: () => {
                createMainWindow();
              }
            },
            {
              label: 'Quit',
              accelerator: 'CmdOrCtrl+Q',
              click: () => {
                app.quit();
              }
            }
          ]
        },
        {
          label: 'Edit',
          submenu: [
            {
              label: 'Undo',
              accelerator: 'CmdOrCtrl+Z',
              role: 'undo'
            },
            {
              label: 'Redo',
              accelerator: 'CmdOrCtrl+Shift+Z',
              role: 'redo'
            },
            {
              type: 'separator'
            },
            {
              label: 'Cut',
              accelerator: 'CmdOrCtrl+X',
              role: 'cut'
            },
            {
              label: 'Copy',
              accelerator: 'CmdOrCtrl+C',
              role: 'copy'
            },
            {
              label: 'Paste',
              accelerator: 'CmdOrCtrl+V',
              role: 'paste'
            },
            {
              type: 'separator'
            },
            {
              label: 'Select All',
              accelerator: 'CmdOrCtrl+A',
              role: 'selectall'
            }
          ]
        },
        {
          label: 'View',
          submenu: [
            {
              label: 'Reload',
              accelerator: 'CmdOrCtrl+R',
              click: () => {
                // Handle reload logic here
                BrowserWindow.getFocusedWindow().reload();
              }
            },
            {
              label: 'Force Reload',
              accelerator: 'CmdOrCtrl+Shift+R',
              click: () => {
                // Handle force reload (clear cache and reload)
                const win = BrowserWindow.getFocusedWindow();
                win.webContents.reloadIgnoringCache();
              }
            },
            {
              label: 'Toggle Developer Tools',
              accelerator: 'CmdOrCtrl+Shift+I',
              click: () => {
                // Handle dev tools toggle here
                const win = BrowserWindow.getFocusedWindow();
                win.webContents.toggleDevTools();
              }
            }
          ]
        },
        {
          label: 'Window',
          submenu: [
            {
              label: 'Minimize',
              role: 'minimize'
            },
            {
              label: 'Close',
              role: 'close'
            }
          ]
        },
        {
          label: 'Help',
          submenu: [
            {
              label: 'Learn More',
              click: () => {
                // Handle Learn More logic here
              }
            }
          ]
        }
      ];
    
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

// Listen for page change request
ipcMain.on('load-url', (event, windowId, url) => {
    
    wnd = windows.find(w=>w.webContents.id==windowId);
    if (wnd) {
        wnd.loadURL(url).then(() => {
            wnd.webContents.send('set-window-id', windowId);
            // Update LRU history
            urls = dedup([url, ...urls.filter(u => u !== url)]).slice(0, MAX_HISTORY);
            saveConfig(configPath);
        }).catch(err => {
            console.error('failed: ',url, ' -- ', err);
            // Handle the error (e.g., load an error page, notify the user, etc.)
            // urls = urls.filter(u => u !== url)
            saveConfig(configPath);
            wnd.loadFile(path.join(__dirname, 'index.html')).then(()=>{
                wnd.webContents.send('set-error-msg', url+" Load failed. Please enter a valid URL.");            
            }).then(()=>{
                wnd.webContents.send('set-window-id', windowId);
            });
        });
    } else {
        console.log("failed to find windowId=",windowId);
    }
});

ipcMain.handle('get-urls', () => urls);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});


app.on('activate', () => {
    //if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
    //}
});