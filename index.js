const { app, BrowserWindow, ipcMain, Tray, Menu } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

let yoloProcess;
let desktopServerProcess;
let loginWindow;
let mainWindow;
let tray;
let isQuiting = false;

function createLoginWindow() {
  loginWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    resizable: false,
    frame: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  loginWindow.setMenuBarVisibility(false);
  loginWindow.loadFile('authentication.html');
  loginWindow.setBackgroundColor('white');

  // Hide instead of closing
  loginWindow.on('close', (event) => {
    if (!isQuiting) {
      event.preventDefault();
      loginWindow.hide();
    }
  });

  loginWindow.on('closed', () => {
    loginWindow = null;
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    frame: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      devTools: true
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile('index.html');
  mainWindow.setBackgroundColor('black');

  // Open DevTools automatically
  mainWindow.webContents.openDevTools();

  // Hide instead of closing when user clicks X
  mainWindow.on('close', (event) => {
    if (!isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.webContents.on('did-finish-load', () => {
    if (global.userName) {
      mainWindow.webContents.send('user-data', { name: global.userName });
    }
  });
}

function createTray() {
  const trayIconPath = path.join(__dirname, 'images', 'system_tray_icon.png');
  tray = new Tray(trayIconPath);

  const trayMenu = Menu.buildFromTemplate([
    {
      label: 'Show App',
      click: () => {
        if (mainWindow && mainWindow.isVisible()) {
          mainWindow.focus();
        } else if (mainWindow) {
          mainWindow.show();
        } else if (loginWindow && loginWindow.isVisible()) {
          loginWindow.focus();
        } else if (loginWindow) {
          loginWindow.show();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuiting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip('CaniScan');
  tray.setContextMenu(trayMenu);

  // Double-click tray icon to restore app
  tray.on('double-click', () => {
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show();
    } else if (loginWindow && !loginWindow.isVisible()) {
      loginWindow.show();
    }
  });
}

app.whenReady().then(() => {
  // --- Start YOLOv8 App ---
  const yoloScriptPath = path.join(__dirname, 'yolov8', 'app.py');
  yoloProcess = spawn('python', [yoloScriptPath]);

  yoloProcess.stdout.on('data', (data) => console.log(`[YOLOv8] ${data}`));
  yoloProcess.stderr.on('data', (data) => console.error(`[YOLOv8 Error] ${data}`));

  // --- Start Desktop Server ---
  const desktopServerPath = path.join(__dirname, 'DesktopServer', 'desktop_server.py');
  desktopServerProcess = spawn('python', [desktopServerPath]);

  desktopServerProcess.stdout.on('data', (data) => console.log(`[Desktop Server] ${data}`));
  desktopServerProcess.stderr.on('data', (data) => console.error(`[Desktop Server Error] ${data}`));

  // Create Tray immediately
  createTray();

  // Show login window
  createLoginWindow();
});

// Listen for login success from renderer
ipcMain.on('login-success', (event, userData) => {
  global.userName = userData.name;

  if (loginWindow) {
    loginWindow.hide();
  }

  if (!mainWindow) {
    createMainWindow();
  } else {
    mainWindow.show();
  }
});

// Window controls (for frameless window)
ipcMain.on('minimize-window', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) win.minimize();
});

ipcMain.on('close-window', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) win.hide(); // hide instead of close
});

app.on('window-all-closed', (event) => {
  // Don’t quit if app is just hidden
  if (!isQuiting) {
    event.preventDefault();
    return;
  }

  if (yoloProcess && !yoloProcess.killed) yoloProcess.kill('SIGINT');
  if (desktopServerProcess && !desktopServerProcess.killed) desktopServerProcess.kill('SIGINT');
  app.quit();
});

app.on('quit', () => {
  if (yoloProcess && !yoloProcess.killed) yoloProcess.kill('SIGINT');
  if (desktopServerProcess && !desktopServerProcess.killed) desktopServerProcess.kill('SIGINT');
});
