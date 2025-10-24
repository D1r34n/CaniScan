// ------------------- Module Imports -------------------
const { app, BrowserWindow, ipcMain, Tray, Menu } = require('electron'); // Electron modules
const { spawn } = require('child_process'); // Spawn Python scripts
const path = require('path'); // File path utilities
const axios = require('axios'); // HTTP requests to check Flask server status

// ------------------- Global Variables -------------------
let yoloProcess;          // YOLOv8 Python process
let desktopServerProcess;  // Desktop server Python process
let loginWindow;           // Login window reference
let mainWindow;            // Main application window reference
let splashWindow;          // Splash/loading window reference
let tray;                  // System tray reference
let isQuiting = false;     // Flag to check if the app is quitting

// ------------------- Window Creation Functions -------------------

// Create a splash window to display while waiting for Flask server
function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 200,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    transparent: true, // transparent background
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  splashWindow.loadFile('splash.html'); // HTML showing logo/loading animation
  splashWindow.setAlwaysOnTop(true, 'screen-saver'); // Keep window on top
  splashWindow.center(); // Center the window

  splashWindow.on('closed', () => {
    splashWindow = null;
  });
}

// Create the login window
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

  loginWindow.setMenuBarVisibility(false); // Hide menu bar
  loginWindow.loadFile('authentication.html'); // Load login HTML
  loginWindow.setBackgroundColor('white');

  // Prevent window from closing; hide instead
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

// Create the main application window
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    frame: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      devTools: true // Open DevTools for debugging
    },
  });

  mainWindow.setMenuBarVisibility(false); // Hide menu bar
  mainWindow.loadFile('revised_index.html');      // Load main UI
  mainWindow.setBackgroundColor('black'); // Set background color

  mainWindow.webContents.openDevTools();  // Automatically open DevTools

  // Prevent window from closing; hide instead
  mainWindow.on('close', (event) => {
    if (!isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // Send user data to renderer if available
  mainWindow.webContents.on('did-finish-load', () => {
    if (global.userName) {
      mainWindow.webContents.send('user-data', { name: global.userName });
    }
  });
}

// Create a system tray with context menu
function createTray() {
  const trayIconPath = path.join(__dirname, 'images', 'system_tray_icon.png');
  tray = new Tray(trayIconPath);

  const trayMenu = Menu.buildFromTemplate([
    {
      label: 'Show App',
      click: () => {
        // Show or focus main or login window
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
        isQuiting = true; // Flag to allow quitting
        app.quit();
      },
    },
  ]);

  tray.setToolTip('CaniScan');        // Tooltip text
  tray.setContextMenu(trayMenu);      // Assign menu to tray icon

  // Double-click tray icon to show app
  tray.on('double-click', () => {
    if (mainWindow && !mainWindow.isVisible()) mainWindow.show();
    else if (loginWindow && !loginWindow.isVisible()) loginWindow.show();
  });
}

// ------------------- App Ready Logic -------------------
app.whenReady().then(async () => {
  // --- Start YOLOv8 Python process ---
  const yoloScriptPath = path.join(__dirname, 'yolov8', 'app.py');
  yoloProcess = spawn('python', [yoloScriptPath]);
  yoloProcess.stdout.on('data', (data) => console.log(`[YOLOv8] ${data}`));
  yoloProcess.stderr.on('data', (data) => console.error(`[YOLOv8 Error] ${data}`));

  // --- Start Desktop Server Python process ---
  const desktopServerPath = path.join(__dirname, 'DesktopServer', 'desktop_server.py');
  desktopServerProcess = spawn('python', [desktopServerPath]);
  desktopServerProcess.stdout.on('data', (data) => console.log(`[Desktop Server] ${data}`));
  desktopServerProcess.stderr.on('data', (data) => console.error(`[Desktop Server Error] ${data}`));

  // --- Create System Tray ---
  createTray();

  // --- Show splash window while waiting for Flask server ---
  createSplashWindow();

  const flaskURL = 'http://127.0.0.1:5000/health'; // Flask health check endpoint
  let flaskConnected = false;
  console.log("Waiting for Flask server...");

  // Poll Flask server until it is ready
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

  // --- Close splash window and show login window ---
  if (splashWindow) splashWindow.close();
  createLoginWindow();
});

// ------------------- IPC Events -------------------

// Handle login success event from renderer
ipcMain.on('login-success', (event, userData) => {
  global.userName = userData.name;

  if (loginWindow) loginWindow.hide();    // Hide login window
  if (!mainWindow) createMainWindow();    // Create main window if not exists
  else mainWindow.show();                  // Otherwise, show main window
});

// Minimize window
ipcMain.on('minimize-window', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) win.minimize();
});

// Close window (hide instead)
ipcMain.on('close-window', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) win.hide();
});

// ------------------- App Quit Handling -------------------
app.on('window-all-closed', (event) => {
  // Prevent quitting if windows are hidden
  if (!isQuiting) {
    event.preventDefault();
    return;
  }

  // Kill Python processes if running
  if (yoloProcess && !yoloProcess.killed) yoloProcess.kill('SIGINT');
  if (desktopServerProcess && !desktopServerProcess.killed) desktopServerProcess.kill('SIGINT');

  app.quit();
});

app.on('quit', () => {
  // Cleanup Python processes on quit
  if (yoloProcess && !yoloProcess.killed) yoloProcess.kill('SIGINT');
  if (desktopServerProcess && !desktopServerProcess.killed) desktopServerProcess.kill('SIGINT');
});
