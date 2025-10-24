// ========================================
// functions.js
// ========================================

if (!window._functionReloadProtected) {
  window._functionReloadProtected = true;

  console.log("%c⚙️ Initializing functions.js...", "color: cyan; font-weight: bold;");

  document.addEventListener("DOMContentLoaded", () => {
    console.log("%c📄 DOM fully loaded.", "color: green;");

    // ================================
    // SERVER CONNECTION LOGIC
    // ================================
    const serverCardContainer = document.getElementById("serverCardContainer");
    const connectButton = document.getElementById("connectServerButton");
    const disconnectButton = document.getElementById("disconnectServerButton");
    const galleryOverview = document.getElementById("galleryOverview");

    if (serverCardContainer && connectButton && disconnectButton && galleryOverview) {

      // CONNECT
      connectButton.addEventListener("click", () => {
        console.log("%c🖧 Connecting to server...", "color: limegreen;");
        connectButton.textContent = "Connecting...";
        connectButton.disabled = true;

        setTimeout(() => {
          // Hide server card
          serverCardContainer.style.display = "none";

          // Show gallery overview with fade-in
          galleryOverview.style.display = "flex";
          galleryOverview.style.opacity = 0;
          let opacity = 0;
          const fadeInInterval = setInterval(() => {
            opacity += 0.05;
            galleryOverview.style.opacity = opacity;
            if (opacity >= 1) clearInterval(fadeInInterval);
          }, 20);

          // ENABLE GALLERY AND ANALYSIS BUTTONS
          const galleryBtn = document.getElementById("galleryBtn");
          const analysisBtn = document.getElementById("analysisBtn");
          if (galleryBtn) galleryBtn.disabled = false;
          if (analysisBtn) analysisBtn.disabled = false;

          console.log("%c✅ Gallery overview displayed and buttons enabled.", "color: limegreen;");
        }, 1500); // simulate connection delay
      });

      // DISCONNECT
      disconnectButton.addEventListener("click", () => {
        console.log("%c🛑 Disconnecting from server...", "color: red;");
        disconnectButton.textContent = "Disconnecting...";
        disconnectButton.disabled = true;

        setTimeout(() => {
          // Fade out gallery overview
          let opacity = 1;
          const fadeOutInterval = setInterval(() => {
            opacity -= 0.05;
            galleryOverview.style.opacity = opacity;
            if (opacity <= 0) {
              clearInterval(fadeOutInterval);
              galleryOverview.style.display = "none";

              // Show server card again
              serverCardContainer.style.display = "flex";

              // Reset disconnect button
              disconnectButton.textContent = "Disconnect";
              disconnectButton.disabled = false;

              // Reset connect button
              connectButton.textContent = "Connect to server";
              connectButton.disabled = false;

              console.log("%c✅ Server card displayed again.", "color: red;");
            }
          }, 20);
        }, 500); // optional delay
      });

    } else {
      console.warn("%c⚠️ Server card, connect button, disconnect button, or gallery overview not found!", "color: orange;");
    }

    // ================================
    // GALLERY DETAIL MINIMIZE TOGGLE (disappear method)
    // ================================
    const detailPane = document.getElementById("detailPane"); // right pane
    const minimizeBtn = document.getElementById("minimizeBtn");
    const leftColumn = document.querySelector(".gallery-left");

    if (detailPane && minimizeBtn && leftColumn) {
      minimizeBtn.addEventListener("click", () => {
        const isMinimized = detailPane.classList.contains("minimized");

        if (isMinimized) {
          // Restore right pane
          detailPane.classList.remove("minimized");
          leftColumn.style.flex = "3"; // restore left column width
          minimizeBtn.textContent = "Hide Details";
        } else {
          // Minimize right pane with smooth scale and shrink
          detailPane.classList.add("minimized");
          leftColumn.style.flex = "4.5"; // expand left column
          minimizeBtn.textContent = "Show Details";
        }
      });
    } else {
      console.warn("%c⚠️ Detail pane, minimize button, or left column not found!", "color: orange;");
    }

    // ================================
    // PAGE SWITCHING LOGIC + NAVBAR ACTIVE STATE
    // ================================
    const homeBtn = document.getElementById("homeBtn");
    const galleryBtn = document.getElementById("galleryBtn");
    const analysisBtn = document.getElementById("analysisBtn");

    const homePage = document.getElementById("homePage");
    const galleryPage = document.getElementById("galleryPage");
    const analysisPage = document.getElementById("analysisPage");

    const navButtons = [homeBtn, galleryBtn, analysisBtn];

    function showPage(pageToShow) {
      const pages = [homePage, galleryPage, analysisPage];
      pages.forEach(page => {
        if (page) page.style.display = (page === pageToShow) ? "flex" : "none";
      });

      // Update active class on navbar buttons
      navButtons.forEach(btn => {
        if (!btn) return;
        if ((btn === homeBtn && pageToShow === homePage) ||
            (btn === galleryBtn && pageToShow === galleryPage) ||
            (btn === analysisBtn && pageToShow === analysisPage)) {
          btn.classList.add("active");
        } else {
          btn.classList.remove("active");
        }
      });
    }

    // Attach click events
    if (homeBtn) homeBtn.addEventListener("click", () => showPage(homePage));
    if (galleryBtn) galleryBtn.addEventListener("click", () => showPage(galleryPage));
    if (analysisBtn) analysisBtn.addEventListener("click", () => showPage(analysisPage));

    // Show Home by default
    showPage(homePage);

  });

  console.log("%c✅ functions.js initialization complete.", "color: limegreen;");
} else {
  console.log("%c⚠️ functions.js already initialized — skipping duplicate load.", "color: orange;");
}
