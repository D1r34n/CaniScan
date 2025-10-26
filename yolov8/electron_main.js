const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let flaskProcess;

function startFlaskServer() {
    console.log('Starting Flask server...');
    flaskProcess = spawn('python', ['app.py']);

    flaskProcess.stdout.on('data', (data) => {
        console.log(`Flask: ${data}`);
    });

    flaskProcess.stderr.on('data', (data) => {
        console.error(`Flask: ${data}`);
    });
}

function stopFlaskServer() {
    if (flaskProcess) {
        flaskProcess.kill();
    }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
    startFlaskServer();
    setTimeout(createWindow, 2000);
});

app.on('window-all-closed', () => {
    stopFlaskServer();
    app.quit();
});

app.on('before-quit', stopFlaskServer);