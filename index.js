const { app, BrowserWindow, ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

let yoloProcess;
let desktopServerProcess;
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
  // --- Start YOLOv8 App ---
  const yoloScriptPath = path.join(__dirname, 'yolov8', 'app.py');
  yoloProcess = spawn('python', [yoloScriptPath]);

  yoloProcess.stdout.on('data', data => {
    console.log(`[YOLOv8] ${data}`);
  });
  yoloProcess.stderr.on('data', data => {
    console.error(`[YOLOv8 Error] ${data}`);
  });

  // --- Start Desktop Server ---
  const desktopServerPath = path.join(__dirname, 'DesktopServer', 'desktop_server.py');
  desktopServerProcess = spawn('python', [desktopServerPath]);

  desktopServerProcess.stdout.on('data', data => {
    console.log(`[Desktop Server] ${data}`);
  });
  desktopServerProcess.stderr.on('data', data => {
    console.error(`[Desktop Server Error] ${data}`);
  });

  // Show login window
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
  if (yoloProcess && !yoloProcess.killed) {
    yoloProcess.kill('SIGINT');
    console.log('YOLOv8 process terminated');
  }
  if (desktopServerProcess && !desktopServerProcess.killed) {
    desktopServerProcess.kill('SIGINT');
    console.log('Desktop server process terminated');
  }
  app.quit();
});

app.on('quit', () => {
  if (yoloProcess && !yoloProcess.killed) {
    yoloProcess.kill('SIGINT');
    console.log('YOLOv8 terminated on app quit');
  }
  if (desktopServerProcess && !desktopServerProcess.killed) {
    desktopServerProcess.kill('SIGINT');
    console.log('Desktop server terminated on app quit');
  }
});
