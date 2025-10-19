const { app, BrowserWindow, ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

let flaskProcess;
let loginWindow;
let mainWindow;

function createLoginWindow() {
  loginWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    resizable: false,
    frame: false, // hides the title bar and system buttons
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  loginWindow.setMenuBarVisibility(false);
  loginWindow.loadFile('authentication.html');
  loginWindow.setBackgroundColor('white');

  loginWindow.on('closed', () => {
    loginWindow = null;
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile('index.html');
  mainWindow.setBackgroundColor('black');
}

app.whenReady().then(() => {
  // Start Flask backend
  const scriptPath = path.join(__dirname, 'yolov8', 'app.py');
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

  // Show login first (✅ only here!)
  createLoginWindow();
});

// Listen for login success from renderer
ipcMain.on('login-success', (event, userData) => {
  if (loginWindow) {
    loginWindow.close();
  }
  createMainWindow();
});

// Window controls (for frameless login window)
ipcMain.on('minimize-window', () => {
  if (loginWindow && !loginWindow.isDestroyed()) {
    loginWindow.minimize();
  }
});

ipcMain.on('close-window', () => {
  if (loginWindow && !loginWindow.isDestroyed()) {
    loginWindow.close();
  }
  app.quit(); // optional: fully quit
});

app.on('window-all-closed', () => {
  if (flaskProcess && !flaskProcess.killed) {
    flaskProcess.kill('SIGINT'); // or 'SIGTERM' for a clean stop
    console.log('Flask process terminated');
  }
  app.quit();
});

app.on('quit', () => {
  if (flaskProcess && !flaskProcess.killed) {
    flaskProcess.kill('SIGINT');
    console.log('Flask terminated on app quit');
  }
});