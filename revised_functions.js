// ========================================
// functions.js
// ========================================

// Protect against multiple loads of this script
if (!window._functionReloadProtected) {
  window._functionReloadProtected = true;

  console.log("%c⚙️ Initializing functions.js...", "color: cyan; font-weight: bold;");

  document.addEventListener("DOMContentLoaded", () => {
    console.log("%c📄 DOM fully loaded.", "color: green;");

    // ================================
    // ELECTRON WINDOW CONTROLS
    // ================================
    let ipcRenderer;
    try {
      const electron = require('electron');
      ipcRenderer = electron.ipcRenderer;
      console.log("Electron detected, ipcRenderer loaded.");
    } catch (err) {
      console.log("Not running in Electron, skipping ipcRenderer.");
    }

    const minimizeBtn = document.getElementById('minimize');
    const closeBtn = document.getElementById('close');

    if (minimizeBtn) minimizeBtn.addEventListener('click', () => ipcRenderer.send('minimize-window'));
    if (closeBtn) closeBtn.addEventListener('click', () => ipcRenderer.send('close-window'));

    // ================================
    // SERVER CONNECTION LOGIC
    // ================================
    const serverCardContainer = document.getElementById("serverCardContainer");
    const connectButton = document.getElementById("connectServerButton");
    const disconnectButton = document.getElementById("disconnectServerButton");
    const galleryOverview = document.getElementById("galleryOverview");

    const galleryBtn = document.getElementById("galleryBtn");
    const analysisBtn = document.getElementById("analysisBtn");

    let serverConnected = false;

    // ================================
    // DISPLAY LOGGED-IN USER
    // ================================
    const userNameElement = document.getElementById("userName");
    if (ipcRenderer && userNameElement) {
      ipcRenderer.on("user-data", (event, data) => {
        if (data && data.name) {
          userNameElement.textContent = `Hello, ${data.name}!`;
          console.log("%c👤 Logged-in user set to:", "color: cyan;", data.name);
        }
      });
    }

    // ================================
    // FADE UTILITY FUNCTIONS
    // ================================
    function fadeIn(element, duration = 400) {
      element.style.display = "flex";
      element.style.opacity = 0;
      let opacity = 0;
      const interval = 20;
      const increment = interval / duration;
      const fade = setInterval(() => {
        opacity += increment;
        element.style.opacity = opacity;
        if (opacity >= 1) clearInterval(fade);
      }, interval);
    }

    function fadeOut(element, duration = 400, callback) {
      element.style.opacity = 1;
      let opacity = 1;
      const interval = 20;
      const decrement = interval / duration;
      const fade = setInterval(() => {
        opacity -= decrement;
        element.style.opacity = opacity;
        if (opacity <= 0) {
          clearInterval(fade);
          element.style.display = "none";
          if (callback) callback();
        }
      }, interval);
    }

    // ================================
    // CONNECT/DISCONNECT BUTTON LOGIC
    // ================================
    if (serverCardContainer && connectButton && disconnectButton && galleryOverview) {

      // Connect button
      connectButton.addEventListener("click", async () => {
        console.log("%c🖧 Connecting to server...", "color: limegreen;");
        connectButton.textContent = "Connecting...";
        connectButton.disabled = true;

        if (!ipcRenderer) {
          console.warn("ipcRenderer not available. Running outside Electron?");
          return;
        }

        ipcRenderer.send('connect-desktop-server');

        ipcRenderer.once('desktop-server-status', (event, status) => {
          if (status.success) {
            console.log("%c✅ Desktop server started successfully.", "color: limegreen;");

            fadeOut(serverCardContainer, 400, () => fadeIn(galleryOverview, 400));
            serverConnected = true;
            if (galleryBtn) galleryBtn.disabled = false;
            if (analysisBtn) analysisBtn.disabled = false;

            // ================================
            // SHOW LOCAL SERVER IP & COPY
            // ================================
            const statusSpan = document.getElementById("serverStatus");
            const ipSpan = document.getElementById("serverIP");
            const copyIPBtn = document.getElementById("copyIPBtn");

            if (statusSpan && ipSpan && status.ip) {
              statusSpan.textContent = "active";
              const originalIP = `${status.ip}:5001`;
              ipSpan.textContent = originalIP;

              if (copyIPBtn) {
                copyIPBtn.addEventListener("click", () => {
                  const ipText = ipSpan.textContent.trim();
                  if (!ipText) return;

                  navigator.clipboard.writeText(originalIP).then(() => {
                    // Temporarily change IP text
                    ipSpan.textContent = "IP copied!";
                    ipSpan.style.color = "limegreen";

                    setTimeout(() => {
                      ipSpan.textContent = originalIP;    // revert back
                      ipSpan.style.color = "#333";        // reset color
                    }, 1500);
                  }).catch(err => console.error("Failed to copy IP:", err));
                });
              }
            }
          } else {
            console.error("%c❌ Failed to start desktop server:", "color: red;", status.message);
            alert("Failed to connect to server: " + status.message);
            connectButton.textContent = "Connect to server";
            connectButton.disabled = false;
          }
        });
      });

      // Disconnect button
      disconnectButton.addEventListener("click", () => {
        console.log("%c🛑 Disconnecting from server...", "color: red;");
        disconnectButton.textContent = "Disconnecting...";
        disconnectButton.disabled = true;

        if (ipcRenderer) {
          ipcRenderer.send('disconnect-desktop-server');

          ipcRenderer.once('desktop-server-disconnected', () => {
            fadeOut(galleryOverview, 400, () => {
              fadeIn(serverCardContainer, 400);
              serverConnected = false;
              if (galleryBtn) galleryBtn.disabled = true;
              if (analysisBtn) analysisBtn.disabled = true;

              disconnectButton.textContent = "Disconnect";
              disconnectButton.disabled = false;
              connectButton.textContent = "Connect to server";
              connectButton.disabled = false;

              console.log("%c✅ Server card displayed again. Buttons disabled.", "color: red;");
            });
          });
        }
      });
    }

    // ================================
    // GALLERY DETAIL MINIMIZE TOGGLE
    // ================================
    const detailPane = document.getElementById("detailPane");
    const minimizeDetail = document.getElementById("minimizeDetail");
    const galleryColumns = document.querySelector(".gallery-columns");
    const leftColumn = document.querySelector(".gallery-left");

    if (detailPane && minimizeDetail && leftColumn && galleryColumns) {
      galleryColumns.classList.add("detail-minimized");
      // 🔹 Toggle when clicked
      minimizeDetail.addEventListener("click", () => {
        const isMinimized = detailPane.classList.toggle("minimized");

        if (isMinimized) {
          leftColumn.style.flex = "4.5";
          galleryColumns.classList.add("detail-minimized");
          minimizeDetail.innerHTML = "<i class='bi bi-layout-text-sidebar-reverse'></i> Show Details";
        } else {
          leftColumn.style.flex = "3";
          galleryColumns.classList.remove("detail-minimized");
          minimizeDetail.innerHTML = "<i class='bi bi-layout-text-sidebar-reverse'></i> Hide Details";
        }
      });
    }

    // ================================
    // GALLERY IMAGE LOADING
    // ================================
    const imageGrid = document.querySelector(".gallery-left .image-grid");

    async function loadGalleryImages() {
      if (!imageGrid) return;

      try {
        const response = await fetch('http://localhost:5001/images');
        const data = await response.json();

        imageGrid.innerHTML = '';

        if (data.success && data.images.length > 0) {
          data.images.forEach(image => {
            const div = document.createElement('div');
            div.classList.add('image-item');

            const img = document.createElement('img');
            img.src = `http://localhost:5001/images/${image.filename}`;
            img.alt = image.filename;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';

            div.appendChild(img);
            imageGrid.appendChild(div);
          });
        } else {
          imageGrid.innerHTML = '<div class="no-images">No images uploaded yet.</div>';
        }
      } catch (error) {
        console.error('Error loading gallery images:', error);
        imageGrid.innerHTML = '<div class="no-images">Failed to load images from server.</div>';
      }
    }

    if (galleryBtn) {
      galleryBtn.addEventListener('click', () => {
        showPage(galleryPage);
        loadGalleryImages();
      });
    }

    setInterval(() => {
      if (galleryPage && galleryPage.style.display !== 'none') {
        loadGalleryImages();
      }
    }, 5000);

    // ================================
    // PAGE SWITCHING WITH FADE
    // ================================
    const homeBtn = document.getElementById("homeBtn");
    const galleryPage = document.getElementById("galleryPage");
    const analysisPage = document.getElementById("analysisPage");
    const homePage = document.getElementById("homePage");

    const navButtons = [homeBtn, galleryBtn, analysisBtn];

    function showPage(pageToShow) {
      if (!serverConnected && (pageToShow === galleryPage || pageToShow === analysisPage)) {
        alert("⚠️ You must connect to the server first!");
        return;
      }

      const pages = [homePage, galleryPage, analysisPage];

      const fadeOutPromises = pages.map(page => {
        if (!page || page === pageToShow) return Promise.resolve();
        return new Promise(resolve => fadeOut(page, 100, resolve));
      });

      Promise.all(fadeOutPromises).then(() => {
        fadeIn(pageToShow, 100);

        navButtons.forEach(btn => {
          if (!btn) return;
          btn.classList.toggle("active", (
            (btn === homeBtn && pageToShow === homePage) ||
            (btn === galleryBtn && pageToShow === galleryPage) ||
            (btn === analysisBtn && pageToShow === analysisPage)
          ));
        });
      });
    }

    if (homeBtn) homeBtn.addEventListener("click", () => showPage(homePage));
    if (galleryBtn) galleryBtn.addEventListener("click", () => showPage(galleryPage));
    if (analysisBtn) analysisBtn.addEventListener("click", () => showPage(analysisPage));

    showPage(homePage);

  }); // end DOMContentLoaded

  console.log("%c✅ functions.js initialization complete.", "color: limegreen;");
} else {
  console.log("%c⚠️ functions.js already initialized — skipping duplicate load.", "color: orange;");
}
