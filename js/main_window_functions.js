// Home Page Functions
import { 
    loadGalleryImages, 
    analyzeModeActive, 
    exitAnalyzeMode 
} from './gallery_page.js';

import {
    restoreChatInputClickability
} from './analysis_page.js';

// Protect against multiple loads of this script
if (!window._functionReloadProtected) {
  
  window._functionReloadProtected = true;

  // Variables
  const minimizeBtn = document.getElementById('minimize');
  const closeBtn = document.getElementById('close');  

  const loadingScreenContainer = document.getElementById("loadingScreenContainer");
  const galleryOverview = document.getElementById("galleryOverview");

  const galleryBtn = document.getElementById("galleryBtn");
  const analysisBtn = document.getElementById("analysisBtn");

  let serverConnected = false;

  const userNameElement = document.getElementById("userName");
  const dropdownUserName = document.getElementById("dropdownUserName");
  const dropdownUserEmail = document.getElementById("dropdownUserEmail");

  const userGreeting = document.getElementById('userGreeting');
  const userDropdown = document.getElementById('userDropdown');

  let loggedInUserName = ""; // store user name globally
  
  // Minimize and Close Button
  let ipcRenderer;
  try {
    const electron = require('electron');
    ipcRenderer = electron.ipcRenderer;
    console.log("Electron detected, ipcRenderer loaded.");
  } catch (err) {
    console.log("Not running in Electron, skipping ipcRenderer.");
  }

  if (minimizeBtn) minimizeBtn.addEventListener('click', () => ipcRenderer.send('minimize-window'));
  if (closeBtn) closeBtn.addEventListener('click', () => ipcRenderer.send('close-window'));
  
  // Check Log-in session and connect to gallery server
  async function initUserSession() {
    if (!userNameElement) return;

    try {
        // Fetch session info from Flask
        const res = await fetch("http://127.0.0.1:5000/status", {
            method: "GET",
            credentials: "include" // send cookies for session
        });

        const data = await res.json();

        if (data.logged_in) {
            console.log("%c📧 Logged in user data from session:", "color: yellow;", data);

            loggedInUserName = data.name || "User"; // fallback if name not sent
            userNameElement.textContent = `Hello, ${loggedInUserName}!`;

            if (dropdownUserName) dropdownUserName.textContent = loggedInUserName;
            if (dropdownUserEmail && data.email) {
                dropdownUserEmail.textContent = data.email;
            }

            console.log("%c👤 Logged-in user set to:", "color: cyan;", loggedInUserName);

            // Connect to local desktop server
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

                    // Show server IP
                    const statusSpan = document.getElementById("serverStatus");
                    const ipSpan = document.getElementById("serverIP");
                    const copyIPBtn = document.getElementById("copyIPBtn");

                    if (statusSpan && ipSpan && status.ip) {
                        statusSpan.textContent = "active";
                        const originalIP = `${status.ip}:5001`;
                        ipSpan.textContent = originalIP;

                        if (copyIPBtn) {
                            copyIPBtn.addEventListener("click", () => {
                                navigator.clipboard.writeText(originalIP)
                                    .then(() => {
                                        ipSpan.textContent = "IP copied!";
                                        ipSpan.style.color = "limegreen";

                                        setTimeout(() => {
                                            ipSpan.textContent = originalIP;
                                            ipSpan.style.color = "#333";
                                        }, 1500);
                                    })
                                    .catch(err => console.error("Failed to copy IP:", err));
                            });
                        }
                    }
                } else {
                    console.error("%c❌ Failed to start desktop server:", "color: red;", status.message);
                    console.log(`Retrying in ${retryDelay / 1000} seconds...`);
                    setTimeout(() => tryConnectDesktopServer(retryDelay), retryDelay);
                }
            });

        } else {
            console.log("%c❌ No user logged in.", "color: red;");
            // Optionally redirect to login page or show login form
        }
    } catch (err) {
        console.error("Failed to check Flask session:", err);
    }
  }

  
  // Page switch variables
  const homeBtn = document.getElementById("homeBtn");
  const galleryPage = document.getElementById("galleryPage");
  const analysisPage = document.getElementById("analysisPage");
  const homePage = document.getElementById("homePage");

  const navButtons = [homeBtn, galleryBtn, analysisBtn];

  // Fade in and out function
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
  // PAGE SWITCHING WITH FADE
  // ================================
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

  // Page Switching Using Fade
  function openAnalysisPage(afterOpen) {
    showPage(analysisPage);
    if (typeof afterOpen === 'function') {
      setTimeout(() => {
        afterOpen();
      }, 150);
    }
  }

  if (homeBtn) homeBtn.addEventListener("click", () => showPage(homePage));

  if (galleryBtn) {
      galleryBtn.addEventListener('click', () => {
      showPage(galleryPage);
      loadGalleryImages();
      });
  }

  if (analysisBtn) analysisBtn.addEventListener("click", () => {
    openAnalysisPage(() => {
      console.log('%c🔬 Analysis page ready', 'color: cyan;');
    });
  });
  
  // User Dropdown Functionality
  if (userGreeting && userDropdown) {

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

        if (!confirm('Are you sure you want to log out?')) return;

        if (!ipcRenderer) {
            console.warn('ipcRenderer not available — cannot log out!');
            return;
        }

        // Send single logout request; this now handles server disconnect & window destroy
        ipcRenderer.send('logout');

        // Optionally, listen for logout success/failure
        ipcRenderer.once('logout-success', (event, data) => {
            console.log(data.message);
            // No need to fadeOut/fadeIn anything; main window destroyed and login window shown
        });

        ipcRenderer.once('logout-failed', (event, data) => {
            console.error('Logout failed:', data.message);
            alert('Logout failed. Please try again.');
        });

        // Close the dropdown immediately
        userDropdown.classList.remove('show');
        userGreeting.classList.remove('active');
      });
    }
  }

  // AVATAR + NAME MODAL LOGIC
  const axios = require('axios'); // Node-style import for Electron renderer

  const accountModal = document.getElementById('accountSelectionModal');
  const accountModalOverlay = accountModal?.querySelector('.account-modal-overlay');
  const navbarUserAvatar = document.getElementById('navbarUserAvatar');
  const navbarUserName = document.getElementById('userName'); // optional element for showing name
  const prevBtn = document.getElementById('prevAvatar');
  const nextBtn = document.getElementById('nextAvatar');
  const currentAvatarImg = document.getElementById('currentAvatar');
  const avatarLabel = document.getElementById('avatarLabel');
  const applyBtn = document.getElementById('applyAvatarChanges');
  const firstNameInput = document.getElementById('firstName');
  const lastNameInput = document.getElementById('lastName');

  // Avatar list
  const avatars = [
    { id: 0, src: '../images/Earl.png', label: 'LABRADOR' },
    { id: 1, src: '../images/Edrian.png', label: 'POMERANIAN' },
    { id: 2, src: '../images/Joaquin.png', label: 'SHIH TZU' },
    { id: 3, src: '../images/Jigs.png', label: 'CORGI' },
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

  // === Apply Changes (Save to DB) ===
  applyBtn.addEventListener('click', async () => {
    const avatar = avatars[currentIndex];
    const firstName = firstNameInput.value.trim();
    const lastName = lastNameInput.value.trim();

    const payload = {};
    if (firstName) payload.first_name = firstName;
    if (lastName) payload.last_name = lastName;
    payload.avatar_id = avatar.id; // <-- Send integer ID, not path

    try {
      await axios.post('http://127.0.0.1:5000/update-user', payload, { withCredentials: true });

      console.log('✅ User updated successfully');

      // Reflect in UI immediately — keep old name if no new one provided
      const currentName = navbarUserName.textContent;
      const newName = `${firstName || ''} ${lastName || ''}`.trim();
      navbarUserAvatar.src = avatar.src;
      if (loggedInUserName) loggedInUserName = newName || currentName || 'User';

      // Save locally for instant reload
      localStorage.setItem('userAvatar', avatar.src);
      localStorage.setItem('userAvatarID', avatar.id);
      if (firstName) localStorage.setItem('userFirstName', firstName);
      if (lastName) localStorage.setItem('userLastName', lastName);

      accountModal.classList.remove('show');
    } catch (err) {
      console.error('❌ Failed to update user in DB:', err);
      alert('Failed to save changes. Please try again.');
    }
  });

  // === Load on Page Start ===
  window.addEventListener('DOMContentLoaded', async () => {
    try {
      // 1️⃣ Get user info from backend
      const res = await axios.get('http://127.0.0.1:5000/status', { withCredentials: true });
      const user = res.data;

      if (user.logged_in) {
        const savedAvatarID = user.avatar_id ?? 0;
        currentIndex = savedAvatarID < avatars.length ? savedAvatarID : 0;

        // Update navbar and modal
        const avatar = avatars[currentIndex];
        navbarUserAvatar.src = avatar.src;
        if (loggedInUserName) loggedInUserName = user.name || 'User';
      }

      updateModalAvatar();
    } catch (err) {
      console.error('⚠️ Could not fetch user status:', err);
      updateModalAvatar(); // fallback
    }
  });


    ipcRenderer.on('uploads-changed', async (event, data) => {
        console.log('Uploads changed:', data);

        // Wait for cards to update
        await loadStatsCards();

        // Update the chart after cards are updated
        if (typeof updateStatsChart === 'function') {
            updateStatsChart();
        }
    });

    async function loadStatsCards() {
        try {
            const res = await fetch('http://127.0.0.1:5001/images');
            const data = await res.json();

            if (!data.success) {
                console.error("Failed to load images:", data.message);
                return;
            }

            const images = data.images;

            // Initialize counters
            let rawCount = 0;
            let healthyCount = 0;
            const diseaseCounts = {
                'Allergic Dermatitis': 0,
                'Fungal Infection': 0,
                'Hotspot': 0,
                'Mange': 0,
                'Healthy': 0
            };

            // Count images
            images.forEach(img => {
                if (img.analyzed) {
                    if (img.disease) {
                        const diseaseName = img.disease.toLowerCase(); // normalize
                        switch (diseaseName) {
                            case 'allergic dermatitis':
                                diseaseCounts['Allergic Dermatitis']++;
                                break;
                            case 'fungal infection':
                                diseaseCounts['Fungal Infection']++;
                                break;
                            case 'hotspot':
                                diseaseCounts['Hotspot']++;
                                break;
                            case 'mange':
                                diseaseCounts['Mange']++;
                                break;
                            case 'healthy':
                                diseaseCounts['Healthy']++;
                                break;
                            default:
                                // unknown disease, ignore or log
                                break;
                        }
                    }
                } else {
                    rawCount++;
                }
            });

            // Build cards array in fixed order
            const cardsData = [
                { label: 'Raw', count: rawCount },
                { label: 'Healthy', count: diseaseCounts['Healthy'] },
                { label: 'Allergic Dermatitis', count: diseaseCounts['Allergic Dermatitis'] },
                { label: 'Fungal Infection', count: diseaseCounts['Fungal Infection'] },
                { label: 'Hotspot', count: diseaseCounts['Hotspot'] },
                { label: 'Mange', count: diseaseCounts['Mange'] }
            ];

            // Render stats cards
            const cardsContainer = document.getElementById('statsCardsRow');
            cardsContainer.innerHTML = '';
            cardsData.forEach(card => {
                const cardEl = document.createElement('div');
                cardEl.className = 'stat-card';
                cardEl.innerHTML = `
                    <div class="card-top">
                        <span>${card.label}</span>
                        <span class="number">${card.count}</span>
                    </div>
                    <button class="view-btn">View</button>
                `;
                cardsContainer.appendChild(cardEl);
            });

            // Update Healthy insight
            const healthyInsightCard = document.getElementById("healthyInsight");
            if (healthyInsightCard) {
                const totalOther = Object.entries(diseaseCounts)
                    .filter(([disease]) => disease !== 'Healthy')
                    .reduce((sum, [, count]) => sum + count, 0);

                const healthyIcon = healthyInsightCard.querySelector('i');
                const healthyText = healthyInsightCard.querySelector('.insight-text strong');

                if (diseaseCounts['Healthy'] === 0) {
                    healthyIcon.classList.remove("bi-arrow-up-circle");
                    healthyIcon.classList.add("bi-arrow-down-circle");
                    healthyText.textContent = `No Healthy scans detected yet.`;
                    healthyInsightCard.classList.add("decline");
                } else if (diseaseCounts['Healthy'] < totalOther) {
                    healthyIcon.classList.remove("bi-arrow-up-circle");
                    healthyIcon.classList.add("bi-arrow-down-circle");
                    healthyText.textContent = `Healthy scans decreased, showing overall decline.`;
                    healthyInsightCard.classList.add("decline");
                } else {
                    healthyIcon.classList.remove("bi-arrow-down-circle");
                    healthyIcon.classList.add("bi-arrow-up-circle");
                    healthyText.textContent = `Healthy scans increased, showing overall improvement.`;
                    healthyInsightCard.classList.remove("decline");
                }
            }

            // Update top disease insight
            const topDiseaseEl = document.getElementById('topDisease');
            if (topDiseaseEl) {
                const sorted = Object.entries(diseaseCounts)
                    .filter(([disease]) => disease !== 'Healthy')
                    .sort((a, b) => b[1] - a[1]);
                if (sorted.length > 0 && sorted[0][1] > 0) {
                    topDiseaseEl.textContent = sorted[0][0];
                } else {
                    topDiseaseEl.parentElement.textContent = "No disease detected in the gallery.";
                }
            }

            // Update third insight card (lowest disease excluding Healthy)
            const lowestInsightCard = document.getElementById("lowestInsight");
            if (lowestInsightCard) {
                const mainDiseases = ['Allergic Dermatitis', 'Fungal Infection', 'Hotspot', 'Mange'];

                // Ensure all main diseases exist in normalizedCounts with their counts
                const normalizedCounts = {};
                mainDiseases.forEach(disease => {
                    const key = Object.keys(diseaseCounts).find(k => k.toLowerCase() === disease.toLowerCase());
                    normalizedCounts[disease] = key ? diseaseCounts[key] : 0;
                });

                // Filter out diseases with 0 count
                const filteredCounts = Object.entries(normalizedCounts).filter(([_, count]) => count > 0);

                if (filteredCounts.length > 0) {
                    // Sort by count ascending and take the first one (lowest)
                    filteredCounts.sort((a, b) => a[1] - b[1]);
                    const [lowestDisease, lowestCount] = filteredCounts[0];

                    const totalAnalyzed = Object.values(normalizedCounts).reduce((sum, count) => sum + count, 0);
                    const percentage = totalAnalyzed > 0 ? ((lowestCount / totalAnalyzed) * 100).toFixed(1) : 0;

                    const lowestIcon = lowestInsightCard.querySelector('i');
                    const lowestText = lowestInsightCard.querySelector('.insight-text strong');

                    lowestText.textContent = `${lowestDisease} accounts for only ${percentage}% of all analyzed images.`;
                    console.log(`Lowest: ${lowestDisease} with ${lowestCount} images`);
                    
                    if (percentage < 10) {
                        lowestIcon.classList.remove("bi-search");
                        lowestIcon.classList.add("bi-exclamation-circle");
                        lowestInsightCard.classList.add("alert");
                    } else {
                        lowestIcon.classList.add("bi-search");
                        lowestIcon.classList.remove("bi-exclamation-circle");
                        lowestInsightCard.classList.remove("alert");
                    }
                } else {
                    // No disease detected at all
                    lowestInsightCard.querySelector('.insight-text strong').textContent = "No disease detected yet.";
                }
            }


            // Update chart
            if (typeof updateStatsChart === 'function') {
                updateStatsChart();
            }

        } catch (err) {
            console.error("Error loading stats cards:", err);
        }
    }

    // Load stats cards on page load
    await loadStatsCards();
    if (typeof updateStatsChart === 'function') {
        updateStatsChart();
    }

  // Check if session is initiated and connect automatically to gallery server
  initUserSession();

  // Start with home page
  showPage(homePage);

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
    
    
    // Global handler to restore clickability after alerts
    const originalAlert = window.alert;
    window.alert = function(message) {
        const result = originalAlert.call(window, message);
        setTimeout(() => {
            restoreChatInputClickability();
        }, 100);
        return result;
    };
    
    /*function showAnalysisDetailsPopup(imageSrc, diagnosis, confidence, timestamp) {
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

    */


  }; // end DOMContentLoaded
