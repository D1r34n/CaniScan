// ------------------- Module Imports -------------------
const { app, BrowserWindow, ipcMain, Tray, Menu } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const axios = require('axios');
const os = require('os');

// ------------------- Global Variables -------------------
let yoloProcess;          // YOLOv8 Python process
let desktopServerProcess;  // Desktop server Python process
let loginWindow;           // Login window reference
let mainWindow;            // Main application window reference
let splashWindow;          // Splash/loading window reference
let tray;                  // System tray reference
let isQuiting = false;     // Flag to check if the app is quitting
const DESKTOP_SERVER_URL = 'http://127.0.0.1:5001';

// ------------------- Window Creation Functions -------------------
function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 200,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    transparent: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  splashWindow.loadFile('splash.html');
  splashWindow.setAlwaysOnTop(true, 'screen-saver');
  splashWindow.center();

  splashWindow.on('closed', () => {
    splashWindow = null;
  });
}

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
<<<<<<< HEAD
  mainWindow.loadFile('revised_index.html');
=======
  mainWindow.loadFile('index.html');
>>>>>>> Joaquin
  mainWindow.setBackgroundColor('black');

  mainWindow.webContents.openDevTools();

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
        if (mainWindow && mainWindow.isVisible()) mainWindow.focus();
        else if (mainWindow) mainWindow.show();
        else if (loginWindow && loginWindow.isVisible()) loginWindow.focus();
        else if (loginWindow) loginWindow.show();
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

  tray.on('double-click', () => {
    if (mainWindow && !mainWindow.isVisible()) mainWindow.show();
    else if (loginWindow && !loginWindow.isVisible()) loginWindow.show();
  });
}

// ------------------- App Ready Logic -------------------
app.whenReady().then(async () => {
  // Start YOLOv8 process
  const yoloScriptPath = path.join(__dirname, 'yolov8', 'app.py');
  yoloProcess = spawn('python', [yoloScriptPath]);
  yoloProcess.stdout.on('data', (data) => console.log(`[YOLOv8] ${data}`));
  yoloProcess.stderr.on('data', (data) => console.error(`[YOLOv8 Error] ${data}`));

  // Create System Tray
  createTray();

  // Show splash window while waiting for Flask server
  createSplashWindow();

  const flaskURL = 'http://127.0.0.1:5000/health';
  let flaskConnected = false;
  console.log("Waiting for Flask server...");

  while (!flaskConnected) {
    try {
      const res = await axios.get(flaskURL);
      if (res.status === 200) {
        flaskConnected = true;
        console.log("Flask server is ready!");
      }
    } catch (err) {
      console.log("Flask not ready yet, retrying in 1s...");
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  if (splashWindow) splashWindow.close();
  createLoginWindow();
});

// ------------------- IPC Events -------------------

// Login success
ipcMain.on('login-success', (event, userData) => {
  global.userName = userData.name;
  if (loginWindow) loginWindow.hide();
  if (!mainWindow) createMainWindow();
  else mainWindow.show();
});

// Minimize / Close
ipcMain.on('minimize-window', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) win.minimize();
});
ipcMain.on('close-window', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) win.hide();
});

// ------------------- Desktop Server Connect/Disconnect -------------------
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

ipcMain.on('connect-desktop-server', async (event) => {
  try {
    await axios.get(`${DESKTOP_SERVER_URL}/health`);
    console.log("Desktop server already running.");
    const ip = getLocalIP();
    event.sender.send('desktop-server-status', { success: true, ip });
    return;
  } catch (_) {
    const desktopServerPath = path.join(__dirname, 'DesktopServer', 'desktop_server.py');
    desktopServerProcess = spawn('python', [desktopServerPath]);

    desktopServerProcess.stdout.on('data', (data) => console.log(`[Desktop Server] ${data}`));
    desktopServerProcess.stderr.on('data', (data) => console.error(`[Desktop Server Error] ${data}`));

    desktopServerProcess.on('exit', (code, signal) => {
      console.log(`Desktop server exited (code: ${code}, signal: ${signal})`);
      desktopServerProcess = null;
    });

    setTimeout(async () => {
      try {
        await axios.get(`${DESKTOP_SERVER_URL}/health`);
        console.log("Desktop server started successfully.");
        const ip = getLocalIP();
        event.sender.send('desktop-server-status', { success: true, ip });
      } catch (err) {
        console.error("Failed to start desktop server:", err.message);
        event.sender.send('desktop-server-status', { success: false, message: err.message });
      }
    }, 1500);
  }
});

ipcMain.on('disconnect-desktop-server', async (event) => {
  try {
    if (desktopServerProcess && !desktopServerProcess.killed) {
      desktopServerProcess.kill('SIGINT');
      desktopServerProcess = null;
      console.log("Desktop server disconnected via process kill.");
      event.sender.send('desktop-server-disconnected');
      return;
    }

    // Fallback: try HTTP shutdown if process object is lost
    try {
      await axios.post(`${DESKTOP_SERVER_URL}/shutdown`);
      console.log("Desktop server shutdown via HTTP.");
    } catch (err) {
      console.warn("Failed to shutdown desktop server via HTTP:", err.message);
    }
  } catch (err) {
    console.error("Error disconnecting desktop server:", err);
  } finally {
    desktopServerProcess = null;
    event.sender.send('desktop-server-disconnected');
  }
});

// ------------------- App Quit Handling -------------------
app.on('window-all-closed', (event) => {
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

app.on('before-quit', () => {
  if (yoloProcess && !yoloProcess.killed) yoloProcess.kill('SIGINT');
  if (desktopServerProcess && !desktopServerProcess.killed) desktopServerProcess.kill('SIGINT');
});
