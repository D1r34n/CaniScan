// ------------------- Module Imports -------------------
const { app, BrowserWindow, ipcMain, Tray, Menu, dialog } = require("electron");
const isDev = !app.isPackaged;
const { spawn, exec } = require("child_process");
const path = require("path");
const axios = require("axios");
const os = require("os");
const chokidar = require("chokidar");

// ------------------- Global Variables -------------------
let yoloProcess; // YOLOv8 Python process
let desktopServerProcess; // Desktop server Python process
let loginWindow; // Login window reference
let mainWindow; // Main application window reference
let splashWindow; // Splash/loading window reference
let tray; // System tray reference
let isQuiting = false; // Flag to track app quitting
let isCleaningUp = false; // Flag to check if setting up to exit
const DESKTOP_SERVER_URL = "http://127.0.0.1:5001";

// ------------------- Helper Functions -------------------
function killProcessTree(proc, name = "process") {
  if (!proc || proc.killed || !proc.pid) return;

  console.log(`Force killing ${name} (PID ${proc.pid})`);

  exec(`taskkill /PID ${proc.pid} /T /F`, (err) => {
    if (err) {
      console.error(`Failed to kill ${name}:`, err.message);
    } else {
      console.log(`${name} terminated`);
    }
  });
}

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
      type: "question",
      buttons: ["Minimize to Tray", "Exit Application", "Cancel"],
      defaultId: 0,
      cancelId: 2,
      title: "Exit CaniScan",
      message: "What would you like to do?",
      detail:
        "Choose to minimize the app to the system tray or fully exit the application.",
      icon: path.join(__dirname, "..", "images", "system_tray_icon.png"),
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
      contextIsolation: false,
    },
  });

  splashWindow.loadFile("html/splash.html");
  splashWindow.setAlwaysOnTop(true, "screen-saver");
  splashWindow.center();

  splashWindow.on("closed", () => {
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
  loginWindow.loadFile(
    path.join(__dirname, "..", "html", "authentication.html")
  );
  loginWindow.setBackgroundColor("white");

  loginWindow.on("close", (event) => {
    // Only prevent closing if NOT quitting AND NOT after successful login
    if (!isQuiting && loginWindow && !loginWindow.isDestroyed()) {
      event.preventDefault();
      handleExitRequest(loginWindow);
    }
  });

  loginWindow.on("closed", () => {
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
  mainWindow.loadFile(path.join(__dirname, "..", "html", "index.html"));
  mainWindow.setBackgroundColor("black");

  mainWindow.on("close", async (event) => {
    if (!isQuiting) {
      event.preventDefault();
      await handleExitRequest(mainWindow);
    }
  });

  mainWindow.on("maximize", () => {
    mainWindow.webContents.send("window-maximize-changed", true);
  });

  mainWindow.on("unmaximize", () => {
    mainWindow.webContents.send("window-maximize-changed", false);
  });

  mainWindow.webContents.on("did-finish-load", () => {
    // Send user data to renderer if available
    if (global.userName) {
      mainWindow.webContents.send("user-data", {
        name: global.userName,
        email: global.userEmail,
      });
    }
    mainWindow.webContents.send(
      "window-maximize-changed",
      mainWindow.isMaximized()
    );
  });
}

function createTray() {
  const trayIconPath = path.join(
    __dirname,
    "..",
    "images",
    "system_tray_icon.png"
  );
  tray = new Tray(trayIconPath);

  const trayMenu = Menu.buildFromTemplate([
    {
      label: "Show App",
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
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        isQuiting = true;
        stopAllServersSync();
        app.quit();
      },
    },
  ]);

  tray.setToolTip("CaniScan");
  tray.setContextMenu(trayMenu);

  tray.on("double-click", () => {
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
  let backendPath;
  let backendArgs = [];

  if (isDev) {
    // DEV → run python directly
    backendPath = "python";
    backendArgs = [path.join(__dirname, "..", "py", "app.py")];
    console.log("Backend starting in DEV mode");
  } else {
    // PROD → run bundled EXE
    backendPath = path.join(process.resourcesPath, "CaniScanBackend.exe");
    console.log("Backend starting in PROD mode:", backendPath);
  }

  yoloProcess = spawn(backendPath, backendArgs, {
    detached: false,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  // Handle stdout/stderr without blocking terminal
  if (yoloProcess.stdout) {
    yoloProcess.stdout.on("data", (data) => {
      console.log(`[YOLOv8] ${data.toString().trim()}`);
    });
  }

  if (yoloProcess.stderr) {
    yoloProcess.stderr.on("data", (data) => {
      console.error(`[YOLOv8 Error] ${data.toString().trim()}`);
    });
  }

  yoloProcess.on("error", (err) => {
    console.error("[YOLOv8] Process error:", err);
  });

  // Create system tray
  createTray();

  // Show splash window while waiting for Flask server
  createSplashWindow();

  const flaskURL = "http://127.0.0.1:5000/health";
  let flaskConnected = false;

  // Poll until Flask server is ready
  let dotCount = 0;
  process.stdout.write("Waiting for Flask server"); // no newline
  while (!flaskConnected) {
    try {
      const res = await axios.get(flaskURL);
      if (res.status === 200) {
        flaskConnected = true;
        process.stdout.write("\rFlask server is ready!          \n");
      }
    } catch (err) {
      dotCount = (dotCount % 3) + 1;
      const dots = ".".repeat(dotCount) + " ".repeat(3 - dotCount);
      process.stdout.write(`\rWaiting for Flask server${dots}`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // Close splash and show login
  if (splashWindow) splashWindow.close();
  createLoginWindow();

  // ------------------- Uploads Folder Watcher -------------------
  const UPLOAD_FOLDER = path.join(__dirname, "..", "uploads");

  const watcher = chokidar.watch(UPLOAD_FOLDER, {
    persistent: true,
    ignoreInitial: true,
    depth: 99,
  });

  watcher
    .on("add", (filePath) => {
      console.log(`New file added: ${filePath}`);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("uploads-changed", {
          type: "add",
          file: filePath,
        });
      }
    })
    .on("change", (filePath) => {
      console.log(`File changed: ${filePath}`);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("uploads-changed", {
          type: "change",
          file: filePath,
        });
      }
    })
    .on("unlink", (filePath) => {
      console.log(`File removed: ${filePath}`);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("uploads-changed", {
          type: "unlink",
          file: filePath,
        });
      }
    });
});

// ------------------- IPC Event Handlers -------------------

// Handle login success
ipcMain.on("login-success", () => {
  if (loginWindow) {
    loginWindow.destroy(); // ✅ Properly destroy instead of hide
    loginWindow = null;
  }

  if (!mainWindow) {
    createMainWindow();
    mainWindow.once("ready-to-show", () => mainWindow.show());
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
});

// Minimize / Close window requests
ipcMain.on("minimize-window", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) win.minimize();
});

ipcMain.on("close-window", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) {
    handleExitRequest(win);
  }
});

ipcMain.on("request-app-exit", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) {
    handleExitRequest(win);
  }
});

ipcMain.on("toggle-maximize", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) return;

  if (win.isMaximized()) {
    win.unmaximize();
    event.sender.send("window-maximize-changed", false);
  } else {
    win.maximize();
    event.sender.send("window-maximize-changed", true);
  }
});

ipcMain.on("get-maximize-state", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) return;
  event.sender.send("window-maximize-changed", win.isMaximized());
});

// ------------------- Logout Handler -------------------
ipcMain.on("logout", async (event) => {
  try {
    // 1️⃣ Logout from Flask
    await axios.post(
      "http://127.0.0.1:5000/logout",
      {},
      { withCredentials: true }
    );
    global.userName = null;
    global.userEmail = null;
    console.log("User logged out from backend");

    // 2️⃣ Disconnect desktop server
    if (desktopServerProcess && !desktopServerProcess.killed) {
      killProcessTree(desktopServerProcess, "Desktop Server");
      console.log("Desktop server disconnected via process kill.");
      desktopServerProcess = null;
    } else {
      try {
        await axios.post(`${DESKTOP_SERVER_URL}/shutdown`);
        console.log("Desktop server shutdown via HTTP fallback.");
      } catch (err) {
        console.warn(
          "Failed to shutdown desktop server via HTTP:",
          err.message
        );
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
      event.sender.send("logout-success", {
        message: "Logged out successfully",
      });
    }
    console.log("Logout flow complete");
  } catch (err) {
    console.error("Logout failed:", err.message);
    if (!event.sender.isDestroyed()) {
      event.sender.send("logout-failed", { message: err.message });
    }
  }
});

// ------------------- Desktop Server Handling -------------------

// Get local IPv4 address
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) return iface.address;
    }
  }
  return "localhost";
}

// Connect desktop server with proper I/O handling
ipcMain.on("connect-desktop-server", async (event) => {
  try {
    await axios.get(`${DESKTOP_SERVER_URL}/health`);
    console.log("Desktop server already running.");
    event.sender.send("desktop-server-status", {
      success: true,
      ip: getLocalIP(),
    });
    return;
  } catch (_) {}

  let desktopPath;
  let desktopArgs = [];

  if (isDev) {
    desktopPath = "python";
    desktopArgs = [path.join(__dirname, "..", "py", "desktop_server.py")];
    console.log("Desktop Server starting in DEV mode");
  } else {
    desktopPath = path.join(process.resourcesPath, "DesktopServer.exe");
    console.log("Desktop Server starting in PROD mode:", desktopPath);
  }

  desktopServerProcess = spawn(desktopPath, desktopArgs, {
    detached: false,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  desktopServerProcess.stdout?.on("data", (d) =>
    console.log(`[Desktop Server] ${d.toString().trim()}`)
  );

  desktopServerProcess.stderr?.on("data", (d) =>
    console.error(`[Desktop Server Error] ${d.toString().trim()}`)
  );

  desktopServerProcess.on("exit", (code) => {
    console.log(`Desktop Server exited with code ${code}`);
    desktopServerProcess = null;
  });

  setTimeout(async () => {
    try {
      await axios.get(`${DESKTOP_SERVER_URL}/health`);
      event.sender.send("desktop-server-status", {
        success: true,
        ip: getLocalIP(),
      });
    } catch (err) {
      event.sender.send("desktop-server-status", {
        success: false,
        message: err.message,
      });
    }
  }, 1500);
});

// ------------------- App Quit Handling (FIXED) -------------------
function stopAllServersSync() {
  if (isCleaningUp) return;
  isCleaningUp = true;

  console.log("Stopping all background servers...");

  killProcessTree(yoloProcess, "YOLO Backend");
  yoloProcess = null;

  killProcessTree(desktopServerProcess, "Desktop Server");
  desktopServerProcess = null;

  console.log("Forced cleanup complete.");
}

// Use 'will-quit' for synchronous cleanup
app.on("will-quit", () => {
  console.log("App will quit - cleaning up...");
  stopAllServersSync();
});

app.on("window-all-closed", () => {
  if (!isQuiting) {
    console.log("All windows closed, app staying in tray.");
    return; // app goes to tray, don't quit
  }
  // If isQuiting is true, quit the app (will trigger 'will-quit')
  app.quit();
});

app.on("before-quit", () => {
  console.log("before-quit triggered");
  stopAllServersSync();
});

process.on("exit", () => {
  console.log("Node exit");
  stopAllServersSync();
});

process.on("SIGINT", () => {
  console.log("SIGINT");
  stopAllServersSync();
  process.exit();
});

process.on("SIGTERM", () => {
  console.log("SIGTERM");
  stopAllServersSync();
  process.exit();
});
