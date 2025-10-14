const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

let flaskProcess;

const createWindow = () => {
    const win = new BrowserWindow({
        width: 1280,
        height: 720,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    win.setBackgroundColor('black');
    win.loadFile('index.html');
    win.setMenuBarVisibility(false);
};

app.whenReady().then(() => {
    // Start Flask backend
    const scriptPath = path.join(__dirname, 'YOLOv8 Image Processing', 'app.py');
    flaskProcess = spawn('python', [scriptPath]);

    flaskProcess.stdout.on('data', data => {
        console.log(`[Flask] ${data}`);
        console.log("Running Flask from:", scriptPath);
    });

    flaskProcess.stderr.on('data', data => {
        console.error(`[Flask Error] ${data}`);
    });

    flaskProcess.on('close', code => {
        console.log(`Flask exited with code ${code}`);
    });

    // Then create Electron window
    createWindow();
});

app.on('window-all-closed', () => {
    if (flaskProcess) flaskProcess.kill('SIGINT');
    app.quit();
});
