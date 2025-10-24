// ========================================
// functions.js
// ========================================

// Protect against multiple loads of this script
if (!window._functionReloadProtected) {
  window._functionReloadProtected = true;

  console.log("%c⚙️ Initializing functions.js...", "color: cyan; font-weight: bold;");

  // Wait for DOM content to fully load before accessing elements
  document.addEventListener("DOMContentLoaded", () => {
    console.log("%c📄 DOM fully loaded.", "color: green;");

    // ================================
    // ELECTRON WINDOW CONTROLS
    // ================================
    // Allows window minimize and close actions from renderer process
    const { ipcRenderer } = require('electron');

    const minimizeBtn = document.getElementById('minimize');
    const closeBtn = document.getElementById('close');

    // Add click event listeners to window controls if present
    if (minimizeBtn) minimizeBtn.addEventListener('click', () => ipcRenderer.send('minimize-window'));
    if (closeBtn) closeBtn.addEventListener('click', () => ipcRenderer.send('close-window'));

    // ================================
    // SERVER CONNECTION LOGIC
    // ================================
    // Grab DOM elements for server connection card and gallery overview
    const serverCardContainer = document.getElementById("serverCardContainer");
    const connectButton = document.getElementById("connectServerButton");
    const disconnectButton = document.getElementById("disconnectServerButton");
    const galleryOverview = document.getElementById("galleryOverview");

    // Grab nav buttons that depend on server connection
    const galleryBtn = document.getElementById("galleryBtn");
    const analysisBtn = document.getElementById("analysisBtn");

    // Track server connection state
    let serverConnected = false;

    // ================================
    // FADE UTILITY FUNCTIONS
    // ================================
    /**
     * Fade in a DOM element over the given duration (ms)
     * @param {HTMLElement} element
     * @param {number} duration
     */
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

    /**
     * Fade out a DOM element over the given duration (ms)
     * Executes callback after fade out completes
     * @param {HTMLElement} element
     * @param {number} duration
     * @param {Function} callback
     */
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
    // SERVER CONNECT/DISCONNECT BUTTON LOGIC
    // ================================
    if (serverCardContainer && connectButton && disconnectButton && galleryOverview) {

      // Connect button logic
      connectButton.addEventListener("click", () => {
        console.log("%c🖧 Connecting to server...", "color: limegreen;");
        connectButton.textContent = "Connecting...";
        connectButton.disabled = true;

        setTimeout(() => {
          // Fade out server card, then fade in gallery overview
          fadeOut(serverCardContainer, 400, () => {
            fadeIn(galleryOverview, 400);
          });

          // Update server connection state and enable gallery/analysis buttons
          serverConnected = true;
          if (galleryBtn) galleryBtn.disabled = false;
          if (analysisBtn) analysisBtn.disabled = false;

          console.log("%c✅ Gallery overview displayed and buttons enabled.", "color: limegreen;");
        }, 1500); // Simulate server connection delay
      });

      // Disconnect button logic
      disconnectButton.addEventListener("click", () => {
        console.log("%c🛑 Disconnecting from server...", "color: red;");
        disconnectButton.textContent = "Disconnecting...";
        disconnectButton.disabled = true;

        setTimeout(() => {
          // Fade out gallery, then fade in server card
          fadeOut(galleryOverview, 400, () => {
            fadeIn(serverCardContainer, 400);

            // Update server connection state and disable gallery/analysis buttons
            serverConnected = false;
            if (galleryBtn) galleryBtn.disabled = true;
            if (analysisBtn) analysisBtn.disabled = true;

            // Reset button states
            disconnectButton.textContent = "Disconnect";
            disconnectButton.disabled = false;
            connectButton.textContent = "Connect to server";
            connectButton.disabled = false;

            console.log("%c✅ Server card displayed again. Buttons disabled.", "color: red;");
          });
        }, 500); // Simulate disconnection delay
      });
    }

    // ================================
    // GALLERY DETAIL MINIMIZE TOGGLE
    // ================================
    const detailPane = document.getElementById("detailPane");
    const minimizeDetail = document.getElementById("minimizeDetail");
    const leftColumn = document.querySelector(".gallery-left");

    if (detailPane && minimizeDetail && leftColumn) {
      minimizeDetail.addEventListener("click", () => {
        const isMinimized = detailPane.classList.contains("minimized");

        if (isMinimized) {
          // Restore right pane
          detailPane.classList.remove("minimized");
          leftColumn.style.flex = "3"; // original left column width
          minimizeDetail.innerHTML = "<i class='bi bi-layout-text-sidebar-reverse'></i> Hide Details";
        } else {
          // Minimize right pane
          detailPane.classList.add("minimized");
          leftColumn.style.flex = "4.5"; // expand left column
          minimizeDetail.innerHTML = "<i class='bi bi-layout-text-sidebar-reverse'></i> Show Details";
        }
      });
    }

    // ================================
    // PAGE SWITCHING LOGIC WITH FADE
    // ================================
    const homeBtn = document.getElementById("homeBtn");
    const galleryPage = document.getElementById("galleryPage");
    const analysisPage = document.getElementById("analysisPage");
    const homePage = document.getElementById("homePage");

    const navButtons = [homeBtn, galleryBtn, analysisBtn];

    /**
     * Show a page after fading out all others
     * @param {HTMLElement} pageToShow
     */
    function showPage(pageToShow) {
      // Security: prevent access to gallery/analysis if server not connected
      if (!serverConnected && (pageToShow === galleryPage || pageToShow === analysisPage)) {
        alert("⚠️ You must connect to the server first!");
        return;
      }

      const pages = [homePage, galleryPage, analysisPage];

      // Fade out all other pages first
      const fadeOutPromises = pages.map(page => {
        if (!page || page === pageToShow) return Promise.resolve();
        return new Promise(resolve => fadeOut(page, 100, resolve));
      });

      // After all fade outs complete, fade in target page
      Promise.all(fadeOutPromises).then(() => {
        fadeIn(pageToShow, 100);

        // Update navbar active state
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

    // Attach click events for page navigation
    if (homeBtn) homeBtn.addEventListener("click", () => showPage(homePage));
    if (galleryBtn) galleryBtn.addEventListener("click", () => showPage(galleryPage));
    if (analysisBtn) analysisBtn.addEventListener("click", () => showPage(analysisPage));

    // Show home page by default on load
    showPage(homePage);

  }); // end DOMContentLoaded

  console.log("%c✅ functions.js initialization complete.", "color: limegreen;");
} else {
  console.log("%c⚠️ functions.js already initialized — skipping duplicate load.", "color: orange;");
}
