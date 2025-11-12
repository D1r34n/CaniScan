// ------------------- Module Imports -------------------
const { app, BrowserWindow, ipcMain, Tray, Menu, dialog } = require('electron');
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
let isQuiting = false;     // Flag to track app quitting
const DESKTOP_SERVER_URL = 'http://127.0.0.1:5001';

// ------------------- Helper Functions -------------------
async function handleExitRequest(win) {
    if (!win || win.isDestroyed()) return;

    if (isQuiting) {
        win.destroy();
        return;
    }

    if (win.__exitDialogOpen) {
        return;
    }

    win.__exitDialogOpen = true;

    try {
        const choice = await dialog.showMessageBox(win, {
            type: 'question',
            buttons: ['Minimize to Tray', 'Exit Application', 'Cancel'],
            defaultId: 0,
            cancelId: 2,
            title: 'Exit CaniScan',
            message: 'What would you like to do?',
            detail: 'Choose to minimize the app to the system tray or fully exit the application.',
            icon: path.join(__dirname, '..', 'images', 'system_tray_icon.png')
        });

        if (choice.response === 0) {
            win.hide();
        } else if (choice.response === 1) {
            isQuiting = true;
            app.quit();
        }
        // Cancel does nothing
    } finally {
        win.__exitDialogOpen = false;
    }
}

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

    splashWindow.loadFile('html/splash.html');
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
    loginWindow.loadFile(path.join(__dirname, '..', 'html', 'authentication.html'));
    loginWindow.setBackgroundColor('white');

    loginWindow.on('close', (event) => {
        // Prevent closing, hide instead unless quitting
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
        minWidth: 1024,
        minHeight: 640,
        frame: false,
        resizable: false,
        maximizable: true,
        fullscreenable: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            devTools: true
        },
    });

    mainWindow.setMenuBarVisibility(false);
    mainWindow.loadFile(path.join(__dirname, '..', 'html', 'index.html'));
    mainWindow.setBackgroundColor('black');

    mainWindow.webContents.openDevTools();

    mainWindow.on('close', async (event) => {
        if (!isQuiting) {
            event.preventDefault();
            await handleExitRequest(mainWindow);
        }
    });

    mainWindow.on('maximize', () => {
        mainWindow.webContents.send('window-maximize-changed', true);
    });

    mainWindow.on('unmaximize', () => {
        mainWindow.webContents.send('window-maximize-changed', false);
    });

    mainWindow.webContents.on('did-finish-load', () => {
        // Send user data to renderer if available
        if (global.userName) {
            mainWindow.webContents.send('user-data', {
                name: global.userName,
                email: global.userEmail
            });
        }
        mainWindow.webContents.send('window-maximize-changed', mainWindow.isMaximized());
    });
}

function createTray() {
    const trayIconPath = path.join(__dirname, '..', 'images', 'system_tray_icon.png');
    tray = new Tray(trayIconPath);

    const trayMenu = Menu.buildFromTemplate([
        {
            label: 'Show App',
            click: () => {
                // Focus or show main/login window
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
    // Start YOLOv8 Python process
    const yoloScriptPath = path.join(__dirname, '..', 'py', 'app.py');
    yoloProcess = spawn('python', [yoloScriptPath]);
    yoloProcess.stdout.on('data', (data) => console.log(`[YOLOv8] ${data}`));
    yoloProcess.stderr.on('data', (data) => console.error(`[YOLOv8 Error] ${data}`));

    // Create system tray
    createTray();

    // Show splash window while waiting for Flask server
    createSplashWindow();

    const flaskURL = 'http://127.0.0.1:5000/health';
    let flaskConnected = false;
    console.log("Waiting for Flask server...");

    // Poll until Flask server is ready
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

    // Close splash and show login
    if (splashWindow) splashWindow.close();
    createLoginWindow();
});

// ------------------- IPC Event Handlers -------------------

// Handle login success
ipcMain.on('login-success', (event, userData) => {
  global.userName = userData.name;
  global.userEmail = userData.email;

  if (loginWindow) loginWindow.hide();

  // Create or show main window
  if (!mainWindow) {
    createMainWindow();

    // Once it's ready, send user data
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow.webContents.send('user-data', userData);
    });
  } else {
    // If already exists (e.g. after logout), just reload and send data again
    mainWindow.webContents.reload();
    mainWindow.webContents.once('did-finish-load', () => {
    mainWindow.show();
    mainWindow.webContents.send('user-data', userData);
    });
  }
});

// Minimize / Close window requests
ipcMain.on('minimize-window', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed()) win.minimize();
});
ipcMain.on('close-window', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed()) {
        handleExitRequest(win);
    }
});
ipcMain.on('request-app-exit', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed()) {
        handleExitRequest(win);
    }
});
ipcMain.on('toggle-maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win.isDestroyed()) return;

    if (win.isMaximized()) {
        win.unmaximize();
        event.sender.send('window-maximize-changed', false);
    } else {
        win.maximize();
        event.sender.send('window-maximize-changed', true);
    }
});
ipcMain.on('get-maximize-state', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win.isDestroyed()) return;
    event.sender.send('window-maximize-changed', win.isMaximized());
});

// Logout user
ipcMain.on('logout', async (event) => {
    try {
        await axios.post('http://127.0.0.1:5000/logout', {}, { withCredentials: true });
        global.userName = null;
        global.userEmail = null;
        console.log("Trying to logout");

       if (mainWindow) {
        mainWindow.hide();
        mainWindow.webContents.reload();
        }

        if (!loginWindow) createLoginWindow();
        loginWindow.webContents.send('reset-login-fields');
        loginWindow.show();
        loginWindow.focus();

        event.sender.send('logout-success', { message: 'Logged out successfully' });
        console.log("User logged out successfully.");
    } catch (err) {
        console.error("Logout failed:", err.message);
        event.sender.send('logout-failed', { message: err.message });
    }
});

// ------------------- Desktop Server Handling -------------------

// Get local IPv4 address
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) return iface.address;
        }
    }
    return 'localhost';
}

// Connect desktop server
ipcMain.on('connect-desktop-server', async (event) => {
    try {
        // Check if already running
        await axios.get(`${DESKTOP_SERVER_URL}/health`);
        console.log("Desktop server already running.");
        const ip = getLocalIP();
        event.sender.send('desktop-server-status', { success: true, ip });
        return;
    } catch (_) {
        // Start desktop server process
        const desktopServerPath = path.join(__dirname, '..', 'DesktopServer', 'desktop_server.py');
        desktopServerProcess = spawn('python', [desktopServerPath]);

        desktopServerProcess.stdout.on('data', (data) => console.log(`[Desktop Server] ${data}`));
        desktopServerProcess.stderr.on('data', (data) => console.error(`[Desktop Server Error] ${data}`));

        desktopServerProcess.on('exit', (code, signal) => {
            console.log(`Desktop server exited (code: ${code}, signal: ${signal})`);
            desktopServerProcess = null;
        });

        // Wait a moment and confirm server is ready
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

// Disconnect desktop server
ipcMain.on('disconnect-desktop-server', async (event) => {
    try {
        if (desktopServerProcess && !desktopServerProcess.killed) {
            desktopServerProcess.kill('SIGINT');
            desktopServerProcess = null;
            console.log("Desktop server disconnected via process kill.");
            event.sender.send('desktop-server-disconnected');
            return;
        }

        // Fallback: try HTTP shutdown
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
