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
    const loadingScreenContainer = document.getElementById("loadingScreenContainer");
    const galleryOverview = document.getElementById("galleryOverview");

    const galleryBtn = document.getElementById("galleryBtn");
    const analysisBtn = document.getElementById("analysisBtn");

    let serverConnected = false;

    // ================================
    // DISPLAY LOGGED-IN USER & DROPDOWN
    // ================================
    const userNameElement = document.getElementById("userName");
    const dropdownUserName = document.getElementById("dropdownUserName");
    const dropdownUserEmail = document.getElementById("dropdownUserEmail");

    let loggedInUserName = ""; // store user name globally

    if (ipcRenderer && userNameElement) {
      ipcRenderer.on("user-data", (event, data) => {
        console.log("%c📧 Full user data received:", "color: yellow;", data);

        if (data && data.name) {
          loggedInUserName = data.name; // store globally
          userNameElement.textContent = `Hello, ${loggedInUserName}!`;

          if (dropdownUserName) dropdownUserName.textContent = loggedInUserName;
          if (dropdownUserEmail && data.email) {
            console.log("%c✉️ Setting email to:", "color: yellow;", data.email);
            dropdownUserEmail.textContent = data.email;
          } else {
            console.log("%c❌ Email not found in data:", "color: red;", data);
          }
          console.log("%c👤 Logged-in user set to:", "color: cyan;", loggedInUserName);
        }
        
        //Connect to local server of gallery
        console.log("%c🖧 Connecting to server...", "color: limegreen;");

        if (!ipcRenderer) {
          console.warn("ipcRenderer not available. Running outside Electron?");
          return;
        }

        ipcRenderer.send('connect-desktop-server');

        ipcRenderer.once('desktop-server-status', (event, status) => {
          if (status.success) {
            console.log("%c✅ Desktop server started successfully.", "color: limegreen;");

            fadeOut(loadingScreenContainer, 400, () => fadeIn(galleryOverview, 400));
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
          }
        });

      });
    }

    // User Dropdown Functionality
    const userGreeting = document.getElementById('userGreeting');
    const userDropdown = document.getElementById('userDropdown');

    if (userGreeting && userDropdown) {
      console.log("%c✅ User dropdown elements found", "color: cyan;");

      // Toggle dropdown on click
      userGreeting.addEventListener('click', (e) => {
        e.stopPropagation();
        userDropdown.classList.toggle('show');
        userGreeting.classList.toggle('active');
        console.log("%c👆 Dropdown toggled", "color: cyan;");
      });

      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!userGreeting.contains(e.target)) {
          userDropdown.classList.remove('show');
          userGreeting.classList.remove('active');
        }
      });

      // Prevent dropdown from closing when clicking inside it
      userDropdown.addEventListener('click', (e) => e.stopPropagation());

      // Dropdown menu item handlers
      const changeProfileBtn = document.getElementById('changeProfileBtn');
      const changeAppearanceBtn = document.getElementById('changeAppearanceBtn');
      const logoutBtn = document.getElementById('logoutBtn');

      if (changeProfileBtn) {
        changeProfileBtn.addEventListener('click', () => {
          // Show account selection modal
          const accountModal = document.getElementById('accountSelectionModal');
          if (accountModal) {
            accountModal.classList.add('show');
            console.log("%c👥 Account selection modal opened", "color: cyan;");
          }

          // Close dropdown
          userDropdown.classList.remove('show');
          userGreeting.classList.remove('active');
        });
      }

      if (changeAppearanceBtn) {
        changeAppearanceBtn.addEventListener('change', (e) => {
            if (e.target.checked) {
                document.body.classList.add('dark-mode');
            } else {
                document.body.classList.remove('dark-mode');
            }
        });
      }

      if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            console.log('Logout clicked');
            if (confirm('Are you sure you want to log out?')) {
                if (ipcRenderer) {
                    console.log('Sending logout to main process...');
                    ipcRenderer.send('logout');
                    ipcRenderer.send('disconnect-desktop-server');
                          
                    ipcRenderer.once('desktop-server-disconnected', () => {
                      fadeOut(galleryOverview, 400, () => {
                        fadeIn(loadingScreenContainer, 400);
                        let loggedInUserName = "";
                        serverConnected = false;
                        if (galleryBtn) galleryBtn.disabled = true;
                        if (analysisBtn) analysisBtn.disabled = true;

                        console.log("%c✅ Server card displayed again. Buttons disabled.", "color: red;");
                      });
                    });
                } else {
                    console.warn('ipcRenderer not available — cannot log out!');
                }
            }
            userDropdown.classList.remove('show');
            userGreeting.classList.remove('active');
        });
      }

      ipcRenderer.on('logout-success', () => {
        console.log("Logged out, login window should appear");
      });
    }

    // ================================
    // AVATAR + NAME MODAL LOGIC
    // ================================
    const axios = require('axios'); // Node-style import for Electron renderer

    const accountModal = document.getElementById('accountSelectionModal');
    const accountModalOverlay = accountModal?.querySelector('.account-modal-overlay');
    const navbarUserAvatar = document.getElementById('navbarUserAvatar');
    const navbarUserName = document.getElementById('navbarUserName'); // optional element for showing name
    const prevBtn = document.getElementById('prevAvatar');
    const nextBtn = document.getElementById('nextAvatar');
    const currentAvatarImg = document.getElementById('currentAvatar');
    const avatarLabel = document.getElementById('avatarLabel');
    const applyBtn = document.getElementById('applyAvatarChanges');
    const firstNameInput = document.getElementById('firstName');
    const lastNameInput = document.getElementById('lastName');

    // Avatar list
    const avatars = [
      { src: '../images/Earl.png', label: 'LABRADOR' },
      { src: '../images/Edrian.png', label: 'POMERANIAN' },
      { src: '../images/Ken2.png', label: 'KEN' },
      { src: '../images/Joaquin.png', label: 'SHIH TZU' },
      { src: '../images/Jigs.png', label: 'CORGI' },
    ];

    let currentIndex = 0;

    // Show avatar in modal
    function updateModalAvatar() {
      const avatar = avatars[currentIndex];
      currentAvatarImg.src = avatar.src;
      avatarLabel.textContent = avatar.label;
    }

    // Carousel arrows
    prevBtn.addEventListener('click', () => {
      currentIndex = (currentIndex - 1 + avatars.length) % avatars.length;
      updateModalAvatar();
    });
    nextBtn.addEventListener('click', () => {
      currentIndex = (currentIndex + 1) % avatars.length;
      updateModalAvatar();
    });

    // Close modal on overlay click
    accountModalOverlay.addEventListener('click', () => {
      accountModal.classList.remove('show');
    });

    // Apply changes (update database + UI + localStorage)
    applyBtn.addEventListener('click', async () => {
      const avatar = avatars[currentIndex];
      const firstName = firstNameInput.value.trim();
      const lastName = lastNameInput.value.trim();

      // Prepare payload with only non-empty fields
      const payload = {};
      if (firstName) payload.first_name = firstName;
      if (lastName) payload.last_name = lastName;
      payload.avatar = avatar.src; // optional: backend may ignore if no column

      try {
        // Send update to backend (Flask)
        await axios.post('http://127.0.0.1:5000/update-user', payload, { withCredentials: true });

        console.log('✅ User updated successfully');

        // Update navbar avatar immediately
        if (navbarUserAvatar) navbarUserAvatar.src = avatar.src;
        // Update navbar name if available
        if (navbarUserName) {
          if (firstName) navbarUserName.textContent = firstName;
          if (lastName) navbarUserName.textContent += lastName ? ' ' + lastName : '';
        }

        // Save to localStorage
        localStorage.setItem('userAvatar', avatar.src);
        if (firstName) localStorage.setItem('userFirstName', firstName);
        if (lastName) localStorage.setItem('userLastName', lastName);

        // Close modal
        accountModal.classList.remove('show');
      } catch (err) {
        console.error('❌ Failed to update user in DB:', err);
        alert('Failed to save changes. Please try again.');
      }
    });

    // Load saved avatar and names on page load
    window.addEventListener('DOMContentLoaded', () => {
      const savedAvatar = localStorage.getItem('userAvatar');
      if (savedAvatar && navbarUserAvatar) navbarUserAvatar.src = savedAvatar;

      const savedFirst = localStorage.getItem('userFirstName');
      const savedLast = localStorage.getItem('userLastName');
      if (savedFirst && firstNameInput) firstNameInput.value = savedFirst;
      if (savedLast && lastNameInput) lastNameInput.value = savedLast;

      updateModalAvatar();
    });

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
    // GALLERY DETAIL MINIMIZE TOGGLE
    // ================================
    const detailPane = document.getElementById("detailPane");
    const minimizeDetail = document.getElementById("minimizeDetail");
    const leftColumn = document.querySelector(".gallery-left");

    if (detailPane && minimizeDetail && leftColumn) {
      minimizeDetail.addEventListener("click", () => {
        const isMinimized = detailPane.classList.contains("minimized");
        if (isMinimized) {
          detailPane.classList.remove("minimized");
          // leftColumn.style.flex = "3.5";
          minimizeDetail.innerHTML = "<i class='bi bi-layout-text-sidebar-reverse'></i> Hide Details";
        } else {
          detailPane.classList.add("minimized");
          // leftColumn.style.flex = "3.5";
          minimizeDetail.innerHTML = "<i class='bi bi-layout-text-sidebar-reverse'></i> Show Details";
        }
      });
    }

    // ================================
    // GALLERY IMAGE LOADING
    // ================================
    const imageGrid = document.querySelector(".gallery-left .image-grid");
    const refreshButton = document.getElementById('refreshButton');
    const sortAnalyzed = document.getElementById('sortAnalyzed');
    const sortRaw = document.getElementById('sortRaw');
    const sortDermatitis = document.getElementById('sortDermatitis');
    const sortMange = document.getElementById('sortMange');
    const sortHotspot = document.getElementById('sortHotspot');
    const sortHealthy = document.getElementById('sortHealthy');
    const sortCheckboxes = [
      sortAnalyzed,
      sortRaw,
      sortDermatitis,
      sortMange,
      sortHotspot,
      sortHealthy
    ].filter(Boolean);

    sortCheckboxes.forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        renderGalleryImages();
      });
    });

    let refreshInterval = 60000; // 60 seconds
    let countdown = refreshInterval / 1000; // in seconds
    let countdownTimer;

    let analyzeModeActive = false;
    let allGalleryImages = [];
    let filteredGalleryImages = [];
    let selectedImageFilenames = new Set();
    let lastSelectedFilename = null;
    let lastSelectedIndex = null;
    let lastActiveFilename = null;
    let analysisPageInitialized = false;

    window.currentAnalysisSource = null;

    // Load gallery images from server
    async function loadGalleryImages() {
      if (!imageGrid) return;

      try {
        const response = await fetch('http://localhost:5001/images');
        const data = await response.json();

        if (data.success) {
          allGalleryImages = Array.isArray(data.images) ? data.images : [];
          renderGalleryImages();
        } else {
          allGalleryImages = [];
          filteredGalleryImages = [];
          clearSelection();
          imageGrid.innerHTML = '<div class="no-images">No images uploaded yet.</div>';
        }
      } catch (error) {
        console.error('Error loading gallery images:', error);
        allGalleryImages = [];
        filteredGalleryImages = [];
        clearSelection();
        imageGrid.innerHTML = '<div class="no-images">Failed to load images from server.</div>';
      }
    }

    function getActiveGalleryFilters() {
      const statuses = [];
      const diseases = [];

      if (sortAnalyzed?.checked) statuses.push('analyzed');
      if (sortRaw?.checked) statuses.push('raw');
      if (sortDermatitis?.checked) diseases.push('dermatitis');
      if (sortMange?.checked) diseases.push('mange');
      if (sortHotspot?.checked) diseases.push('hotspot');
      if (sortHealthy?.checked) diseases.push('healthy');

      return { statuses, diseases };
    }

    function applyGalleryFilters(images, filters) {
      if (!filters.statuses.length && !filters.diseases.length) {
        return [...images];
      }

      return images.filter(image => {
        const imageStatus = image.analyzed ? 'analyzed' : 'raw';
        const imageDisease = (image.disease || '').toLowerCase();

        const statusMatches = !filters.statuses.length || filters.statuses.includes(imageStatus);
        const diseaseMatches = !filters.diseases.length || filters.diseases.includes(imageDisease);

        return statusMatches && diseaseMatches;
      });
    }

    function renderGalleryImages() {
      if (!imageGrid) return;

      const filters = getActiveGalleryFilters();
      const filtered = applyGalleryFilters(allGalleryImages, filters);
      filteredGalleryImages = filtered;

      Array.from(selectedImageFilenames).forEach(filename => {
        if (!filtered.some(img => img.filename === filename)) {
          selectedImageFilenames.delete(filename);
        }
      });

      if (lastSelectedFilename && !filtered.some(img => img.filename === lastSelectedFilename)) {
        lastSelectedFilename = null;
        lastSelectedIndex = null;
      }

      if (lastActiveFilename && !filtered.some(img => img.filename === lastActiveFilename)) {
        lastActiveFilename = null;
      }

        imageGrid.innerHTML = '';

      if (!filtered.length) {
        selectedImageFilenames.clear();
        lastSelectedFilename = null;
        lastSelectedIndex = null;
        lastActiveFilename = null;
        imageGrid.innerHTML = '<div class="no-images">No images match the current filters.</div>';
        return;
      }

      filtered.forEach((image, index) => {
            const div = document.createElement('div');
            div.classList.add('image-item');
        div.dataset.filename = image.filename;
        div.dataset.disease = image.disease || '';
        div.dataset.analyzed = image.analyzed ? 'true' : 'false';
        div.dataset.confidence = image.confidence || '';
        div.dataset.uploadedAt = image.uploaded_at || '';
        if (typeof image.size !== 'undefined') {
          div.dataset.size = image.size;
        }

            if (image.analyzed) {
              div.classList.add('analyzed');
            }

            const img = document.createElement('img');
            img.src = `http://localhost:5001/images/${image.filename}`;
            img.alt = image.filename;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';

            div.appendChild(img);
            
            if (image.analyzed) {
              const badge = document.createElement('div');
              badge.className = 'analyzed-badge';
              badge.innerHTML = '<i class="bi bi-check-circle-fill"></i>';
              badge.title = `Analyzed: ${image.disease || 'N/A'} (${image.confidence || '0'}%)`;
              div.appendChild(badge);
            }

        if (selectedImageFilenames.has(image.filename)) {
          div.classList.add('selected');
        }

        if (image.filename === lastSelectedFilename) {
          div.classList.add('last-selected');
          lastSelectedIndex = index;
        }

        if (image.filename === lastActiveFilename) {
              div.classList.add('active');
        }

        div.addEventListener('click', (event) => handleImageItemClick(event, image));

        imageGrid.appendChild(div);
      });

      applyAnalyzeModeStyles();

      if (analyzeModeActive && lastSelectedFilename) {
        const imageData = filtered.find(img => img.filename === lastSelectedFilename);
        if (imageData) {
          showImageDetails(imageData);
        }
      } else if (!analyzeModeActive && lastActiveFilename) {
        const imageData = filtered.find(img => img.filename === lastActiveFilename);
        if (imageData) {
          showImageDetails(imageData);
        }
      }

      syncSelectedState();
    }

    function applyAnalyzeModeStyles() {
      if (!imageGrid) return;
      const items = Array.from(imageGrid.querySelectorAll('.image-item'));
      items.forEach(item => {
        if (analyzeModeActive) {
          item.classList.add('selectable');
        } else {
          item.classList.remove('selectable');
        }
      });
    }

    function handleImageItemClick(event, image) {
      event.stopPropagation();

      if (analyzeModeActive) {
        selectImage(event, image);
        } else {
        document.querySelectorAll('.image-item.active').forEach(el => el.classList.remove('active'));
        event.currentTarget.classList.add('active');
        lastActiveFilename = image.filename;
        showImageDetails(image);
      }
    }

    function clearSelection() {
      if (!imageGrid) return;
      Array.from(imageGrid.querySelectorAll('.image-item')).forEach(img => {
        img.classList.remove('selected', 'last-selected', 'active');
      });
      selectedImageFilenames = new Set();
      lastSelectedFilename = null;
      lastSelectedIndex = null;
      lastActiveFilename = null;
    }

    function syncSelectedState() {
      if (!imageGrid) return;
      selectedImageFilenames = new Set(
        Array.from(imageGrid.querySelectorAll('.image-item.selected')).map(el => el.dataset.filename)
      );
    }

    function showImageDetails(image) {
      const detailPane = document.getElementById("detailPane");
      if (!detailPane || !image) return;

      lastActiveFilename = image.filename || null;
      
      // Remove minimized class to show details
      detailPane.classList.remove('minimized');

      // Parse date and time from uploaded_at
      const uploadedDate = image.uploaded_at ? new Date(image.uploaded_at) : null;
      const dateStr = uploadedDate ? uploadedDate.toLocaleDateString() : 'N/A';
      const timeStr = uploadedDate ? uploadedDate.toLocaleTimeString() : 'N/A';
      
      // Format file size
      const sizeKB = image.size ? Math.round(image.size / 1024) : 0;
      const sizeStr = sizeKB > 0 ? `${sizeKB} KB` : 'Unknown';
      
      // Check if analyzed
      const isAnalyzed = image.analyzed || false;
      const diagnosis = image.disease || 'N/A';
      const confidence = image.confidence || '0';
      
      // Create analysis status badge
      const analysisStatus = isAnalyzed 
        ? `<span class="status-badge analyzed-status"><i class="bi bi-check-circle-fill"></i> Analyzed</span>`
        : `<span class="status-badge raw-status"><i class="bi bi-circle"></i> Raw (Not Analyzed)</span>`;

      const detailContent = detailPane.querySelector('.detail-content');
      if (detailContent) {
        // Use diagnosis name if analyzed, otherwise show "Not Analyzed"
        const displayName = isAnalyzed ? diagnosis : 'Not Analyzed';
        const displayNameClass = isAnalyzed ? 'diagnosis-value' : '';
        
        detailContent.innerHTML = `
          <h3>Image Details</h3>
          <div class="detail-preview">
            <img src="http://localhost:5001/images/${image.filename}" alt="${image.filename}">
          </div>
          <div class="detail-info">
            <div class="detail-row">
              <span class="detail-label"><i class="bi bi-heart-pulse"></i> Diagnosis:</span>
              <span class="detail-value ${displayNameClass}">${displayName}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label"><i class="bi bi-calendar"></i> Date:</span>
              <span class="detail-value">${dateStr}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label"><i class="bi bi-clock"></i> Time:</span>
              <span class="detail-value">${timeStr}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label"><i class="bi bi-hdd"></i> Size:</span>
              <span class="detail-value">${sizeStr}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label"><i class="bi bi-info-circle"></i> Status:</span>
              <span class="detail-value">${analysisStatus}</span>
            </div>
            ${isAnalyzed ? `
            <div class="detail-row analysis-info">
              <span class="detail-label"><i class="bi bi-graph-up"></i> Confidence:</span>
              <span class="detail-value confidence-value">${confidence}%</span>
            </div>
            ` : ''}
          </div>
        `;
      }
    }


    let lastAnalyzeState = false; // remember previous state

    function updateRefreshButtonText() {
      if (!refreshButton) return;

      // Detect mode change (ON <-> OFF)
      const modeChanged = analyzeModeActive !== lastAnalyzeState;
      lastAnalyzeState = analyzeModeActive;

      // Only fade if mode has just changed
      if (modeChanged) {
        refreshButton.classList.add('fade-out');

        setTimeout(() => {
          if (analyzeModeActive) {
            refreshButton.classList.add('disabled');
            refreshButton.innerHTML = `<i class="bi bi-pause-circle"></i> Refresh Disabled`;
          } else {
            refreshButton.classList.remove('disabled');
            refreshButton.innerHTML = `<i class="bi bi-arrow-clockwise"></i> Refresh (${countdown}s)`;
          }
          refreshButton.classList.remove('fade-out');
        }, 300);
      } else {
        // Normal updates (no fade)
        if (analyzeModeActive) {
          refreshButton.innerHTML = `<i class="bi bi-pause-circle"></i> Refresh Disabled`;
        } else {
          refreshButton.innerHTML = `<i class="bi bi-arrow-clockwise"></i> Refresh (${countdown}s)`;
        }
      }
    }

    // Manual refresh
    if (refreshButton) {
      refreshButton.addEventListener('click', () => {
        if (analyzeModeActive) {
          console.log("⚠️ Refresh disabled during Analyze Mode.");
          return; // 🚫 stop here, no refresh
        }

        loadGalleryImages();
        countdown = refreshInterval / 1000;
        updateRefreshButtonText();
      });
    }

    // Auto-refresh every interval (only if not analyzing)
    setInterval(() => {
      if (galleryPage && galleryPage.style.display !== 'none' && !analyzeModeActive) {
        loadGalleryImages();
        countdown = refreshInterval / 1000; // reset countdown after refresh
      }
    }, refreshInterval);

    // Countdown timer, updates every second
    countdownTimer = setInterval(() => {
      if (galleryPage && galleryPage.style.display !== 'none') {
        if (!analyzeModeActive && countdown > 0) {
          countdown--;
        }
        updateRefreshButtonText();
      }
    }, 1000);

    // Initial load when gallery button is clicked
    if (galleryBtn) {
      galleryBtn.addEventListener('click', () => {
        showPage(galleryPage);
        loadGalleryImages();
        countdown = refreshInterval / 1000;
        updateRefreshButtonText();
      });
    }

    // Initialize button text
    updateRefreshButtonText();

    const analyzeModeButton = document.getElementById('analyzeModeButton');
    const analyzeSelected = document.getElementById('analyzeFloatingButton');
    const galleryColumn = document.querySelector('.gallery-columns');

    function enterAnalyzeMode() {
        analyzeModeActive = true;
        if (analyzeModeButton) {
            analyzeModeButton.innerHTML = `<i class="bi bi-x-lg"></i> Cancel`;
            analyzeModeButton.classList.add('active');
        }
        if (analyzeSelected) {
            analyzeSelected.style.display = "block";
        }
        applyAnalyzeModeStyles();
        if (galleryColumn) {
            galleryColumn.addEventListener('click', clearSelectionOnEmpty);
        }
        updateRefreshButtonText();
    }

    function exitAnalyzeMode(options = { clearSelection: true }) {
        analyzeModeActive = false;
        if (analyzeModeButton) {
            analyzeModeButton.innerHTML = '<i class="bi bi-box-arrow-in-down"></i> Analyze Images';
            analyzeModeButton.classList.remove('active');
        }
        if (analyzeSelected) {
            analyzeSelected.style.display = "none";
        }
        applyAnalyzeModeStyles();
        if (galleryColumn) {
            galleryColumn.removeEventListener('click', clearSelectionOnEmpty);
        }
        if (options.clearSelection) {
            clearSelection();
        }
            updateRefreshButtonText();
    }

    if (analyzeModeButton) {
        analyzeModeButton.addEventListener('click', () => {
            if (analyzeModeActive) {
                exitAnalyzeMode();
            } else {
                enterAnalyzeMode();
            }
        });
    }

    if (analyzeSelected) {
        analyzeSelected.addEventListener('click', async (event) => {
            event.stopPropagation();

            if (!selectedImageFilenames.size) {
                alert('Please select at least one image to analyze.');
                return;
            }

            const filenames = Array.from(selectedImageFilenames);
            const imagesToAnalyze = filenames
                .map(filename => filteredGalleryImages.find(img => img.filename === filename) || allGalleryImages.find(img => img.filename === filename))
                .filter(Boolean);

            if (!imagesToAnalyze.length) {
                alert('Selected images are no longer available.');
                exitAnalyzeMode();
                return;
            }

            if (imagesToAnalyze.length > 1) {
                console.warn('Multiple images selected; only the first image will be prepared for analysis.');
            }

            const targetImage = imagesToAnalyze[0];

            exitAnalyzeMode();

            openAnalysisPage(async () => {
                try {
                    await displayImageFromGallery(targetImage);
                    setTimeout(() => {
                        autoAnalyzeSelectedImage();
                    }, 200);
                } catch (error) {
                    console.error('Failed to prepare selected image for analysis:', error);
                    alert('Unable to load the selected image for analysis. Please try again.');
                }
            });
        });
    }

    // Function to handle click selection with Shift/Ctrl
    function selectImage(e, imageDataOverride = null) {
        if (!imageGrid) return;
        e.stopPropagation();

        const images = Array.from(imageGrid.querySelectorAll('.image-item'));
        const currentIndex = images.indexOf(e.currentTarget);

        if (currentIndex === -1) return;

        if (e.ctrlKey || e.metaKey) {
            e.currentTarget.classList.toggle('selected');
            if (e.currentTarget.classList.contains('selected')) {
                images.forEach(img => img.classList.remove('last-selected'));
                e.currentTarget.classList.add('last-selected');
                lastSelectedIndex = currentIndex;
                lastSelectedFilename = e.currentTarget.dataset.filename || null;
            } else {
                e.currentTarget.classList.remove('last-selected');
                if ((e.currentTarget.dataset.filename || null) === lastSelectedFilename) {
                    lastSelectedIndex = null;
                    lastSelectedFilename = null;
                }
            }
        } else if (e.shiftKey && lastSelectedIndex !== null) {
            const [start, end] = currentIndex > lastSelectedIndex ? [lastSelectedIndex, currentIndex] : [currentIndex, lastSelectedIndex];
            images.forEach(img => img.classList.remove('last-selected'));
            for (let i = start; i <= end; i++) {
                images[i].classList.add('selected');
            }
            const lastElement = images[currentIndex];
            lastElement.classList.add('last-selected');
            lastSelectedIndex = currentIndex;
            lastSelectedFilename = lastElement.dataset.filename || null;
        } else {
            images.forEach(img => img.classList.remove('selected', 'last-selected'));
            e.currentTarget.classList.add('selected', 'last-selected');
            lastSelectedIndex = currentIndex;
            lastSelectedFilename = e.currentTarget.dataset.filename || null;
        }

        syncSelectedState();

        document.querySelectorAll('.image-item.active').forEach(el => el.classList.remove('active'));
        const lastSelectedElement = imageGrid.querySelector('.image-item.last-selected');
        if (lastSelectedElement) {
            lastSelectedElement.classList.add('active');
            lastActiveFilename = lastSelectedElement.dataset.filename || null;
            const filename = lastSelectedElement.dataset.filename;
            const imageData = imageDataOverride || filteredGalleryImages.find(img => img.filename === filename) || allGalleryImages.find(img => img.filename === filename);
            if (imageData) {
                showImageDetails(imageData);
            }
        } else {
            lastActiveFilename = null;
        }
    }

    // Clear selection when clicking empty space
    function clearSelectionOnEmpty(e) {
        if (!e.target.closest('.image-item')) {
            clearSelection();
        }
    }

    // Initialize analysis page when it's shown
    function initializeAnalysisPage() {
        if (analysisPageInitialized) {
            loadAnalysisHistory();
            return;
        }
        analysisPageInitialized = true;
        console.log('Initializing analysis page components...');
        try {
            setupImageUpload();
            console.log('Image upload setup complete');
            setupGallerySelection();
            console.log('Gallery selection setup complete');
            setupAnalysisButton();
            console.log('Analysis button setup complete');
            setupChatInterface();
            console.log('Chat interface setup complete');
            
            // Setup clear history button
            const clearHistoryBtn = document.getElementById('clearHistoryBtn');
            if (clearHistoryBtn) {
                clearHistoryBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    clearAnalysisHistory();
                });
            }
            
            loadAnalysisHistory();
            console.log('Analysis history loaded');
            setupClearHistoryButton();
            console.log('Clear history button setup complete');
        } catch (error) {
            console.error('Error in initializeAnalysisPage:', error);
        }
    }
    
    // Shared image handling function
    function handleImageFile(file) {
        if (!file || !file.type.startsWith('image/')) {
            console.error('Invalid file type');
            return;
        }
        
        const uploadArea = document.getElementById('imageUploadArea');
        const uploadPlaceholder = uploadArea?.querySelector('.upload-placeholder');
        const imagePreview = document.getElementById('imagePreview');
        const previewImage = document.getElementById('previewImage');
        
        if (!uploadArea || !uploadPlaceholder || !imagePreview || !previewImage) {
            console.error('Required elements not found');
            return;
        }
        
        console.log('Processing image file:', file.name);
        
        const reader = new FileReader();
        reader.onload = (e) => {
            previewImage.src = e.target.result;
            uploadPlaceholder.style.display = 'none';
            imagePreview.style.display = 'block';
            previewImage.dataset.sourceFilename = '';
            window.currentAnalysisSource = {
                type: 'upload',
                filename: file.name || 'uploaded-image'
            };
            console.log('Image loaded successfully');
        };
        reader.onerror = (e) => {
            console.error('Error reading file:', e);
            alert('Error loading image. Please try again.');
        };
        reader.readAsDataURL(file);
    }
    
    // Image upload and preview functionality
    function setupImageUpload() {
        const uploadArea = document.getElementById('imageUploadArea');
        const uploadPlaceholder = uploadArea.querySelector('.upload-placeholder');
        const imagePreview = document.getElementById('imagePreview');
        const previewImage = document.getElementById('previewImage');
        const changeImageBtn = document.getElementById('changeImageBtn');
        
        // Drag and drop functionality
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadPlaceholder.style.borderColor = '#c4a484';
            uploadPlaceholder.style.background = 'rgba(217, 185, 155, 0.1)';
        });
        
        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadPlaceholder.style.borderColor = '#d9b99b';
            uploadPlaceholder.style.background = 'rgba(217, 185, 155, 0.05)';
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadPlaceholder.style.borderColor = '#d9b99b';
            uploadPlaceholder.style.background = 'rgba(217, 185, 155, 0.05)';
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handleImageFile(files[0]);
            }
        });
        
        // File input functionality
        uploadPlaceholder.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Create a new file input each time
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'image/*';
            fileInput.style.display = 'none';
            
            fileInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files.length > 0) {
                    handleImageFile(e.target.files[0]);
                }
                // Clean up immediately after use
                if (fileInput.parentNode) {
                    fileInput.parentNode.removeChild(fileInput);
                }
            });
            
            // Add to DOM, trigger click, then remove
            document.body.appendChild(fileInput);
            fileInput.click();
            
            // Clean up after a short delay to ensure the file dialog has opened
            setTimeout(() => {
                if (fileInput.parentNode) {
                    fileInput.parentNode.removeChild(fileInput);
                }
            }, 100);
        });
        
        // Change image button
        changeImageBtn.addEventListener('click', () => {
            uploadPlaceholder.style.display = 'flex';
            imagePreview.style.display = 'none';
            const analysisResults = document.getElementById('analysisResults');
            if (analysisResults) {
                analysisResults.style.display = 'none';
            }
            previewImage.src = '';
            previewImage.dataset.sourceFilename = '';
            window.currentAnalysisSource = null;
        });
    }
    
    // Gallery selection functionality
    function setupGallerySelection() {
        const selectFromGalleryBtn = document.getElementById('selectFromGalleryBtn');
        
        selectFromGalleryBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Create a new file input each time
            const galleryFileInput = document.createElement('input');
            galleryFileInput.type = 'file';
            galleryFileInput.accept = 'image/*';
            galleryFileInput.style.display = 'none';
            
            galleryFileInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files.length > 0) {
                    handleImageFile(e.target.files[0]);
                }
                // Clean up immediately after use
                if (galleryFileInput.parentNode) {
                    galleryFileInput.parentNode.removeChild(galleryFileInput);
                }
            });
            
            // Add to DOM, trigger click, then remove
            document.body.appendChild(galleryFileInput);
            galleryFileInput.click();
            
            // Clean up after a short delay to ensure the file dialog has opened
            setTimeout(() => {
                if (galleryFileInput.parentNode) {
                    galleryFileInput.parentNode.removeChild(galleryFileInput);
                }
            }, 100);
        });
    }

    async function fetchImageAsDataURL(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch image (${response.status})`);
        }

        const blob = await response.blob();
        return await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    async function displayImageFromGallery(image) {
        if (!image || !image.filename) {
            throw new Error('Invalid image data provided.');
        }

        const uploadArea = document.getElementById('imageUploadArea');
        const uploadPlaceholder = uploadArea?.querySelector('.upload-placeholder');
        const imagePreview = document.getElementById('imagePreview');
        const previewImage = document.getElementById('previewImage');
        const analysisResults = document.getElementById('analysisResults');

        if (!uploadArea || !uploadPlaceholder || !imagePreview || !previewImage) {
            throw new Error('Analysis components are not available.');
        }

        const imageUrl = `http://localhost:5001/images/${image.filename}`;
        const dataUrl = await fetchImageAsDataURL(imageUrl);

        previewImage.src = dataUrl;
        previewImage.alt = image.filename;
        previewImage.dataset.sourceFilename = image.filename;
        uploadPlaceholder.style.display = 'none';
        imagePreview.style.display = 'block';
        if (analysisResults) {
            analysisResults.style.display = 'none';
        }
        const resultDiagnosis = document.getElementById('resultDiagnosis');
        const resultConfidence = document.getElementById('resultConfidence');
        if (resultDiagnosis) {
            resultDiagnosis.textContent = '-';
        }
        if (resultConfidence) {
            resultConfidence.textContent = '-';
        }

        window.currentAnalysisSource = {
            type: 'gallery',
            filename: image.filename,
            disease: image.disease || '',
            confidence: image.confidence || '',
            analyzed: Boolean(image.analyzed)
        };
    }

    function autoAnalyzeSelectedImage() {
        if (window.currentAnalysisSource?.type !== 'gallery') return;

        const analyzeBtn = document.getElementById('analyzeBtn');
        const previewImage = document.getElementById('previewImage');
        if (!analyzeBtn || !previewImage || !previewImage.src) return;

        if (!analyzeBtn.disabled) {
            analyzeBtn.click();
        }
    }
    
    // Save analyzed image to gallery with metadata
    async function saveAnalyzedImageToGallery(imageSrc, disease, confidence) {
        try {
            // Convert data URL to blob
            const response = await fetch(imageSrc);
            const blob = await response.blob();
            
            // Create FormData
            const formData = new FormData();
            formData.append('image', blob, 'analyzed_image.jpg');
            formData.append('analyzed', 'true');
            formData.append('disease', disease);
            formData.append('confidence', confidence.toString());
            if (window.currentAnalysisSource?.type === 'gallery' && window.currentAnalysisSource.filename) {
                formData.append('source_filename', window.currentAnalysisSource.filename);
            }
            
            // Upload to desktop server
            const uploadResponse = await fetch('http://localhost:5001/upload', {
                method: 'POST',
                body: formData
            });
            
            if (!uploadResponse.ok) {
                throw new Error('Failed to upload image');
            }
            
            const result = await uploadResponse.json();
            console.log('Image saved to gallery:', result);
            
            // Refresh gallery if on gallery page
            const galleryPage = document.getElementById('galleryPage');
            if (galleryPage && galleryPage.style.display !== 'none') {
                setTimeout(() => {
                    loadGalleryImages();
                }, 500);
            }
            
            return result.filename;
        } catch (error) {
            console.error('Error saving image to gallery:', error);
            throw error;
        }
    }
    
    // Analysis button functionality
    function setupAnalysisButton() {
        const analyzeBtn = document.getElementById('analyzeBtn');
        const analysisResults = document.getElementById('analysisResults');
        const resultDiagnosis = document.getElementById('resultDiagnosis');
        const resultConfidence = document.getElementById('resultConfidence');
        
        analyzeBtn.addEventListener('click', async () => {
            const previewImage = document.getElementById('previewImage');
            if (!previewImage.src) return;
            
            // Show loading state
            analyzeBtn.disabled = true;
            analyzeBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Analyzing...';
            
            try {
                // Call real YOLO analysis API
                const analysisResult = await performRealAnalysis(previewImage.src);
                
                // Show results
                analysisResults.style.display = 'block';
                resultDiagnosis.textContent = analysisResult.disease;
                resultConfidence.textContent = `${analysisResult.confidence}%`;
                
                // Save analyzed image to gallery
                const savedFilename = await saveAnalyzedImageToGallery(previewImage.src, analysisResult.disease, analysisResult.confidence);
                
                // Add to history with filename
                await addToAnalysisHistory(previewImage.src, analysisResult.disease, `${analysisResult.confidence}%`, savedFilename);
                
                // Show initial LLM recommendation in chat
                showInitialRecommendation(analysisResult.recommendation);
                
                // Store current analysis data for chat context
                window.currentAnalysis = {
                    diagnosis: analysisResult.disease,
                    confidence: analysisResult.confidence
                };
                
                // Debug: Log the stored analysis data
                console.log('DEBUG: Stored analysis data:', window.currentAnalysis);
                
                // Ensure chat input is clickable and focused after analysis
                setTimeout(() => {
                    restoreChatInputClickability();
                }, 100);
                
            } catch (error) {
                console.error('Analysis failed:', error);
                alert('Analysis failed. Please try again.');
            } finally {
                // Reset button
                analyzeBtn.disabled = false;
                analyzeBtn.innerHTML = 'Analyze';
            }
        });
        
        async function performRealAnalysis(imageSrc) {
            try {
                const response = await fetch('http://localhost:5000/analyze', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        frame: imageSrc
                    })
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const result = await response.json();
                return result;
            } catch (error) {
                console.error('Error calling analysis API:', error);
                throw error;
            }
        }
    }
    
    // Chat interface functionality
    function setupChatInterface() {
        const chatInput = document.getElementById('chatInput');
        const sendMessageBtn = document.getElementById('sendMessageBtn');
        const chatMessages = document.getElementById('chatMessages');
        
        function sendMessage() {
            const message = chatInput.value.trim();
            if (!message) return;
            
            // Add user message
            addChatMessage(message, 'user');
            chatInput.value = '';
            
            // Show typing indicator
            const typingIndicator = addTypingIndicator();
            
            // Call LLM API for response
            callLLMAPI(message)
                .then(response => {
                    // Remove typing indicator
                    removeTypingIndicator(typingIndicator);
                    
                    // Add bot response
                    addChatMessage(response.response, 'bot');
                })
                .catch(error => {
                    console.error('Error getting LLM response:', error);
                    // Remove typing indicator
                    removeTypingIndicator(typingIndicator);
                    
                    // Add error message
                    addChatMessage("I apologize, but I'm having trouble processing your request right now. Please try again or consult a veterinarian for immediate assistance.", 'bot');
                });
        }
        
        async function callLLMAPI(message) {
            // LLM works with or without analysis - if analysis exists, it enhances the response
            const currentAnalysis = window.currentAnalysis || { diagnosis: '', confidence: 0 };
            
            // Debug: Log the data being sent to the API
            console.log('DEBUG: Sending to chat API:', {
                message: message,
                diagnosis: currentAnalysis.diagnosis || 'None',
                confidence: currentAnalysis.confidence || 0
            });
            
            const response = await fetch('http://localhost:5000/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',  // Include session cookie
                body: JSON.stringify({
                    message: message,
                    diagnosis: currentAnalysis.diagnosis || '',
                    confidence: currentAnalysis.confidence || 0
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        }
        
        function addTypingIndicator() {
            const typingDiv = document.createElement('div');
            typingDiv.className = 'chat-message bot-message typing-indicator';
            typingDiv.innerHTML = `
                <div class="message-content">
                    <span class="typing-dots">
                        <span>.</span><span>.</span><span>.</span>
                    </span>
                </div>
            `;
            chatMessages.appendChild(typingDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
            return typingDiv;
        }
        
        function removeTypingIndicator(typingDiv) {
            if (typingDiv && typingDiv.parentNode) {
                typingDiv.parentNode.removeChild(typingDiv);
            }
        }
        
        function showInitialRecommendation(recommendation) {
            // Clear existing messages except the welcome message
            const welcomeMessage = chatMessages.querySelector('.bot-message');
            chatMessages.innerHTML = '';
            if (welcomeMessage) {
                chatMessages.appendChild(welcomeMessage);
            }
            
            // Add the initial recommendation
            addChatMessage(recommendation, 'bot');
        }
        
        sendMessageBtn.addEventListener('click', sendMessage);
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
        
        // Ensure chat input is always focusable
        chatInput.addEventListener('click', () => {
            chatInput.focus();
            if (window.require && window.require('electron')) {
                const { ipcRenderer } = window.require('electron');
                if (ipcRenderer) {
                    ipcRenderer.send('focus-window');
                }
            }
        });
        
        // Auto-focus chat input when analysis page is shown
        const analysisPage = document.getElementById('analysisPage');
        if (analysisPage) {
            const observer = new MutationObserver(() => {
                if (analysisPage.style.display !== 'none') {
                    // Small delay to ensure page is fully rendered
                    setTimeout(() => {
                        chatInput.focus();
                    }, 100);
                }
            });
            observer.observe(analysisPage, { attributes: true, attributeFilter: ['style'] });
        }
        
        function addChatMessage(message, sender) {
            const messageDiv = document.createElement('div');
            messageDiv.className = `chat-message ${sender}-message`;
            messageDiv.innerHTML = `
                <div class="message-content">${message}</div>
            `;
            chatMessages.appendChild(messageDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }
    
    // Function to restore chat input clickability
    function restoreChatInputClickability() {
        const chatInput = document.getElementById('chatInput');
        const chatInputArea = document.querySelector('.chat-input-area');
        const recommendationsBox = document.querySelector('.recommendations-box');
        
        if (chatInput) {
            // Remove any disabled state
            chatInput.disabled = false;
            chatInput.style.pointerEvents = 'auto';
            chatInput.style.zIndex = '20';
            // Focus the input to ensure it's interactive
            chatInput.focus();
        }
        
        if (chatInputArea) {
            chatInputArea.style.pointerEvents = 'auto';
            chatInputArea.style.zIndex = '20';
        }
        
        if (recommendationsBox) {
            recommendationsBox.style.zIndex = '2';
            recommendationsBox.style.pointerEvents = 'auto';
        }
        
        // Remove any lingering popup overlays
        const blockingOverlays = document.querySelectorAll('.popup-overlay:not(.analysis-details-popup .popup-overlay), .analysis-details-popup');
        blockingOverlays.forEach(overlay => {
            // Only remove if it's not part of an active popup
            const popup = overlay.closest('.analysis-details-popup');
            if (!popup || !document.body.contains(popup)) {
                if (overlay.parentNode) {
                    overlay.parentNode.removeChild(overlay);
                }
            }
        });
        
        console.log('DEBUG: Chat input clickability restored');
    }
    
    // Global handler to restore clickability after alerts
    const originalAlert = window.alert;
    window.alert = function(message) {
        const result = originalAlert.call(window, message);
        setTimeout(() => {
            restoreChatInputClickability();
        }, 100);
        return result;
    };
    
    // Analysis history functionality - now user-specific from server
    async function loadAnalysisHistory() {
        const historyList = document.getElementById('analysisHistoryList');
        if (!historyList) return;
        
        // Clear existing items except sample
        const sampleItem = historyList.querySelector('.history-item');
        historyList.innerHTML = '';
        if (sampleItem) {
            historyList.appendChild(sampleItem);
        }
        
        // Add history items
        history.forEach(item => {
            addHistoryItem(item.imageSrc, item.diagnosis, item.confidence);
        });
    }
    
    // Clear history functionality
    function setupClearHistoryButton() {
        const clearHistoryBtn = document.getElementById('clearHistoryBtn');
        if (!clearHistoryBtn) return;
        
        clearHistoryBtn.addEventListener('click', async () => {
            // Confirm before clearing
            const confirmed = confirm('Are you sure you want to clear all analysis history? This will delete:\n\n- All analysis history in the app\n- All diagnosis records in the CSV file\n\nThis action cannot be undone.');
            
            if (confirmed) {
                try {
                    // Clear localStorage
                    localStorage.removeItem('analysisHistory');
                    
                    // Clear from CSV via API
                    const response = await fetch('http://localhost:5000/clear-analysis-history', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        credentials: 'include'
                    });
                    
                    if (response.ok) {
                        const result = await response.json();
                        console.log('History cleared:', result);
                        
                        // Reload history display (will be empty)
                        loadAnalysisHistory();
                        
                        // Show success message
                        alert('Analysis history has been cleared successfully.');
                    } else {
                        throw new Error('Failed to clear history from server');
                    }
                } catch (error) {
                    console.error('Error clearing history:', error);
                    alert('Error clearing history. Please try again.');
                }
            }
        });
    }
    
    function addToAnalysisHistory(imageSrc, diagnosis, confidence) {
        const history = JSON.parse(localStorage.getItem('analysisHistory') || '[]');
        const newItem = {
            imageSrc,
            diagnosis,
            confidence,
            timestamp: new Date().toISOString()
        };
        
        history.unshift(newItem); // Add to beginning
        if (history.length > 10) history.pop(); // Keep only last 10
        
        localStorage.setItem('analysisHistory', JSON.stringify(history));
        addHistoryItem(imageSrc, diagnosis, confidence, newItem.timestamp);
    }
    
    function addHistoryItem(imageSrc, diagnosis, confidence, timestamp = null) {
        const historyList = document.getElementById('analysisHistoryList');
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        historyItem.style.cursor = 'pointer';
        
        const displayDate = timestamp ? new Date(timestamp).toLocaleDateString() : new Date().toLocaleDateString();
        
        historyItem.innerHTML = `
            <div class="history-image">
                <img src="${imageSrc}" alt="Analysis Image" class="history-img">
            </div>
            <div class="history-details">
                <div class="history-name">${displayDate}</div>
                <div class="history-diagnosis">${diagnosis}</div>
                <div class="history-confidence">${confidence}</div>
            </div>
        `;
        
        // Add click event to show details popup
        historyItem.addEventListener('click', () => {
            showAnalysisDetailsPopup(imageSrc, diagnosis, confidence, timestamp);
        });
        
        // Insert after sample item or at beginning
        const sampleItem = historyList.querySelector('.history-item');
        if (sampleItem) {
            historyList.insertBefore(historyItem, sampleItem.nextSibling);
        } else {
            historyList.appendChild(historyItem);
        }
    }
    
    function showAnalysisDetailsPopup(imageSrc, diagnosis, confidence, timestamp) {
        const displayDate = timestamp ? new Date(timestamp).toLocaleString() : new Date().toLocaleString();
        
        const popup = document.createElement('div');
        popup.className = 'analysis-details-popup';
        popup.innerHTML = `
            <div class="popup-overlay"></div>
            <div class="popup-content">
                <div class="popup-header">
                    <h4>Analysis Details</h4>
                    <button class="popup-close-btn">&times;</button>
                </div>
                <div class="popup-body">
                    <div class="popup-image">
                        <img src="${imageSrc}" alt="Analysis Image">
                    </div>
                    <div class="popup-details">
                        <div class="detail-row">
                            <span class="detail-label">Date & Time:</span>
                            <span class="detail-value">${displayDate}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Diagnosis:</span>
                            <span class="detail-value diagnosis-value">${diagnosis}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Confidence Score:</span>
                            <span class="detail-value confidence-value">${confidence}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Status:</span>
                            <span class="detail-value status-value">Completed</span>
                        </div>
                    </div>
                </div>
                <div class="popup-footer">
                    <button class="btn btn-secondary" id="closePopupBtn">Close</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(popup);
        
        // Close functionality
        const closePopup = () => {
            if (popup && popup.parentNode) {
                document.body.removeChild(popup);
            }
            // Ensure chat input is clickable after popup closes
            setTimeout(() => {
                restoreChatInputClickability();
            }, 50);
        };
        
        popup.querySelector('.popup-close-btn').addEventListener('click', closePopup);
        popup.querySelector('#closePopupBtn').addEventListener('click', closePopup);
        popup.querySelector('.popup-overlay').addEventListener('click', closePopup);
    }

    // ================================
    // PAGE SWITCHING WITH FADE
    // ================================
    const homeBtn = document.getElementById("homeBtn");
    const galleryPage = document.getElementById("galleryPage");
    const analysisPage = document.getElementById("analysisPage");
    const homePage = document.getElementById("homePage");

    const navButtons = [homeBtn, galleryBtn, analysisBtn];

    function openAnalysisPage(afterOpen) {
      showPage(analysisPage);
      initializeAnalysisPage();
      if (typeof afterOpen === 'function') {
        setTimeout(() => {
          afterOpen();
        }, 150);
      }
    }

    function showPage(pageToShow) {
      // Prevent re-showing the page if it’s already visible
      if (pageToShow.style.display !== "none") return;

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

        if (pageToShow !== galleryPage && analyzeModeActive) {
          exitAnalyzeMode();
        }

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
    if (analysisBtn) analysisBtn.addEventListener("click", () => {
      openAnalysisPage(() => {
        console.log('%c🔬 Analysis page ready', 'color: cyan;');
      });
    });

    showPage(homePage);

  }); // end DOMContentLoaded

  console.log("%c✅ functions.js initialization complete.", "color: limegreen;");
} else {
  console.log("%c⚠️ functions.js already initialized — skipping duplicate load.", "color: orange;");
}

  // ============================================
  // CUSTOM DROPDOWN MENU FOR ANALYSIS PAGE LOGIC
  // ============================================
  const dropdownButton = document.getElementById('dropdownButton');
  const dropdownMenu = document.getElementById('dropdownMenu');

  if (dropdownButton && dropdownMenu) {
    // Toggle dropdown on button click
    dropdownButton.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdownMenu.classList.toggle('show');
      console.log('Dropdown toggled');
    });

    // Handle dropdown item selection
    const dropdownItems = dropdownMenu.querySelectorAll('div');
    dropdownItems.forEach(item => {
      item.addEventListener('click', (e) => {
        const selectedValue = e.target.textContent.trim();
        
        // Update button text (keep the arrow)
        dropdownButton.innerHTML = `${selectedValue} <span>▼</span>`;
        
        // Close dropdown
        dropdownMenu.classList.remove('show');
        
        // Store selected model
        window.selectedModel = selectedValue;
        
        console.log('Selected model:', selectedValue);
        
        // You can trigger any additional logic here
        // For example, update the analysis function to use this model
      });
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!dropdownButton.contains(e.target) && !dropdownMenu.contains(e.target)) {
        dropdownMenu.classList.remove('show');
      }
    });
    
    console.log('%c✅ Simple dropdown initialized', 'color: limegreen;');
  }