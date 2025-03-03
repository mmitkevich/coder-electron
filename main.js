const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path'); 
const yaml = require('js-yaml');
const fs = require('fs')
const os = require('os')
// globals
let mainWindow;
let urls = [];
let last_url = "";

const MAX_HISTORY = 10; // Set max history size

// Ignore certificate errors
app.commandLine.appendSwitch('ignore-certificate-errors');

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


app.on('ready', () => {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        titleBarStyle: 'hidden',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'), // Securely expose ipcRenderer
            contextIsolation: true, 
            enableRemoteModule: false, 
            nodeIntegration: false
        },
        ...(process.platform !== 'darwin' ? { titleBarOverlay: true } : {})
    });
    
    mainWindow.maximize();
    mainWindow.loadFile(path.join(__dirname, 'index.html'));
    loadConfig(configPath);
        
    setInterval(() => {
        if(mainWindow) {
            mainWindow.title = mainWindow.title.replace(/code-server/g, last_url);
        }
    }, 1000);

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
});

// Listen for page change request
ipcMain.on('load-url', (event, url) => {
    if (mainWindow) {
        mainWindow.loadURL(url).then(() => {
            // Update LRU history
            urls = dedup([url, ...urls.filter(u => u !== url)]).slice(0, MAX_HISTORY);
            last_url = url;
            saveConfig(configPath);
        }).catch(err => {
            console.error('failed: ',url, ' -- ', err);
            // Handle the error (e.g., load an error page, notify the user, etc.)
            urls = urls.filter(u => u !== url)
            saveConfig(configPath);
            mainWindow.loadFile(path.join(__dirname, 'index.html')).then(()=>{
                mainWindow.webContents.send('set-error-msg', url+" Load failed. Please enter a valid URL.");            
            });
        });
    }
});

ipcMain.handle('get-urls', () => urls);

app.on('window-all-closed', () => {
    app.quit();
});