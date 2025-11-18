// ------------------- Module Imports -------------------
const { app, BrowserWindow, ipcMain, Tray, Menu, dialog } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const axios = require('axios');
const os = require('os');
const chokidar = require('chokidar');

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
        // Only prevent closing if NOT quitting AND NOT after successful login
        if (!isQuiting && loginWindow && !loginWindow.isDestroyed()) {
            event.preventDefault();
            handleExitRequest(loginWindow);
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
        },
    });

    mainWindow.setMenuBarVisibility(false);
    mainWindow.loadFile(path.join(__dirname, '..', 'html', 'index.html'));
    mainWindow.setBackgroundColor('black');

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
                // Show main window if it exists
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.show();
                    mainWindow.focus();
                } 
                // Otherwise create and show login window
                else {
                    if (!loginWindow || loginWindow.isDestroyed()) {
                        createLoginWindow();
                    }
                    loginWindow.show();
                    loginWindow.focus();
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

    tray.on('double-click', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.show();
            mainWindow.focus();
        } else {
            if (!loginWindow || loginWindow.isDestroyed()) {
                createLoginWindow();
            }
            loginWindow.show();
            loginWindow.focus();
        }
    });
}

// ------------------- App Ready Logic -------------------
app.whenReady().then(async () => {
    // Start YOLOv8 Python process with proper I/O handling
    const yoloScriptPath = path.join(__dirname, '..', 'py', 'app.py');
    yoloProcess = spawn('python', [yoloScriptPath], {
        detached: false,
        stdio: ['ignore', 'pipe', 'pipe'] // Don't inherit, use pipes
    });

    // Handle stdout/stderr without blocking terminal
    if (yoloProcess.stdout) {
        yoloProcess.stdout.on('data', (data) => {
            console.log(`[YOLOv8] ${data.toString().trim()}`);
        });
    }

    if (yoloProcess.stderr) {
        yoloProcess.stderr.on('data', (data) => {
            console.error(`[YOLOv8 Error] ${data.toString().trim()}`);
        });
    }

    yoloProcess.on('error', (err) => {
        console.error('[YOLOv8] Process error:', err);
    });

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
ipcMain.on('login-success', () => {
    if (loginWindow) {
        loginWindow.destroy();  // ✅ Properly destroy instead of hide
        loginWindow = null;
    }

    if (!mainWindow) {
        createMainWindow();
        mainWindow.once('ready-to-show', () => mainWindow.show());
    } else {
        mainWindow.show();
        mainWindow.focus();
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

// ------------------- Logout Handler -------------------
ipcMain.on('logout', async (event) => {
    try {
        // 1️⃣ Logout from Flask
        await axios.post('http://127.0.0.1:5000/logout', {}, { withCredentials: true });
        global.userName = null;
        global.userEmail = null;
        console.log("User logged out from backend");

        // 2️⃣ Disconnect desktop server
        if (desktopServerProcess && !desktopServerProcess.killed) {
            desktopServerProcess.kill('SIGTERM');
            console.log("Desktop server disconnected via process kill.");
            desktopServerProcess = null;
        } else {
            try {
                await axios.post(`${DESKTOP_SERVER_URL}/shutdown`);
                console.log("Desktop server shutdown via HTTP fallback.");
            } catch (err) {
                console.warn("Failed to shutdown desktop server via HTTP:", err.message);
            }
            desktopServerProcess = null;
        }

        // 3️⃣ Destroy main window
        if (mainWindow) {
            mainWindow.destroy();
            mainWindow = null;
        }

        // 4️⃣ Create NEW login window (since we destroyed the previous one)
        createLoginWindow();
        loginWindow.show();
        loginWindow.focus();

        // 5️⃣ Inform renderer
        if (!event.sender.isDestroyed()) {
            event.sender.send('logout-success', { message: 'Logged out successfully' });
        }
        console.log("Logout flow complete");

    } catch (err) {
        console.error("Logout failed:", err.message);
        if (!event.sender.isDestroyed()) {
            event.sender.send('logout-failed', { message: err.message });
        }
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

// Connect desktop server with proper I/O handling
ipcMain.on('connect-desktop-server', async (event) => {
    try {
        // Check if already running
        await axios.get(`${DESKTOP_SERVER_URL}/health`);
        console.log("Desktop server already running.");
        const ip = getLocalIP();
        event.sender.send('desktop-server-status', { success: true, ip });
        return;
    } catch (_) {
        // Start desktop server process with proper I/O
        const desktopServerPath = path.join(__dirname, '..', 'DesktopServer', 'desktop_server.py');
        desktopServerProcess = spawn('python', [desktopServerPath], {
            detached: false,
            stdio: ['ignore', 'pipe', 'pipe']
        });

        if (desktopServerProcess.stdout) {
            desktopServerProcess.stdout.on('data', (data) => {
                console.log(`[Desktop Server] ${data.toString().trim()}`);
            });
        }

        if (desktopServerProcess.stderr) {
            desktopServerProcess.stderr.on('data', (data) => {
                console.error(`[Desktop Server Error] ${data.toString().trim()}`);
            });
        }

        desktopServerProcess.on('exit', (code, signal) => {
            console.log(`Desktop server exited (code: ${code}, signal: ${signal})`);
            desktopServerProcess = null;
        });

        desktopServerProcess.on('error', (err) => {
            console.error('[Desktop Server] Process error:', err);
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

// ------------------- App Quit Handling (FIXED) -------------------
function stopAllServersSync() {
    console.log("Stopping all background servers...");
    
    if (yoloProcess && !yoloProcess.killed) {
        console.log("Stopping YOLO process...");
        try {
            yoloProcess.kill('SIGTERM');
            yoloProcess = null;
        } catch (err) {
            console.error("Error killing YOLO process:", err);
        }
    }

    if (desktopServerProcess && !desktopServerProcess.killed) {
        console.log("Stopping Desktop Server process...");
        try {
            desktopServerProcess.kill('SIGTERM');
            desktopServerProcess = null;
        } catch (err) {
            console.error("Error killing Desktop Server process:", err);
        }
    }
    
    console.log("Cleanup complete.");
}

// Use 'will-quit' for synchronous cleanup
app.on('will-quit', () => {
    console.log("App will quit - cleaning up...");
    stopAllServersSync();
});

app.on('window-all-closed', () => {
    if (!isQuiting) {
        console.log("All windows closed, app staying in tray.");
        return; // app goes to tray, don't quit
    }
    // If isQuiting is true, quit the app (will trigger 'will-quit')
    app.quit();
});

// ------------------- Uploads Folder Watcher -------------------
const UPLOAD_FOLDER = path.join(__dirname, '..', 'uploads');

const watcher = chokidar.watch(UPLOAD_FOLDER, {
    persistent: true,
    ignoreInitial: true,
    depth: 99
});

watcher
  .on('add', filePath => {
    console.log(`New file added: ${filePath}`);
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('uploads-changed', { type: 'add', file: filePath });
    }
  })
  .on('change', filePath => {
    console.log(`File changed: ${filePath}`);
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('uploads-changed', { type: 'change', file: filePath });
    }
  })
  .on('unlink', filePath => {
    console.log(`File removed: ${filePath}`);
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('uploads-changed', { type: 'unlink', file: filePath });
    }
  });