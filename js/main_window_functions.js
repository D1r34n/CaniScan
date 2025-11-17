// Home Page Functions
import { loadGalleryImages, analyzeModeActive, exitAnalyzeMode } from './gallery_page.js';
import { restoreChatInputClickability } from './analysis_page.js';

if (!window._functionReloadProtected) {
    window._functionReloadProtected = true;

    console.log("%c⚙️ Initializing functions.js...", "color: cyan; font-weight: bold;");

    // ================================
    // VARIABLES
    // ================================
    const minimizeBtn = document.getElementById('minimize');
    const closeBtn = document.getElementById('close');

    const loadingScreenContainer = document.getElementById("loadingScreenContainer");
    const galleryOverview = document.getElementById("galleryOverview");

    const galleryBtn = document.getElementById("galleryBtn");
    const analysisBtn = document.getElementById("analysisBtn");

    let isOnline = navigator.onLine;
    let serverConnected = false;
    let wasOnline = isOnline;
    let wasServerConnected = serverConnected;

    const userNameElement = document.getElementById("userName");
    const dropdownUserName = document.getElementById("dropdownUserName");
    const dropdownUserEmail = document.getElementById("dropdownUserEmail");

    const userGreeting = document.getElementById('userGreeting');
    const userDropdown = document.getElementById('userDropdown');

    let loggedInUserName = "";

    // ================================
    // ELECTRON IPC
    // ================================
    let ipcRenderer;
    try {
        const electron = require('electron');
        ipcRenderer = electron.ipcRenderer;
        console.log("Electron detected, ipcRenderer loaded.");
    } catch (err) {
        console.log("Not running in Electron, skipping ipcRenderer.");
    }

    if (minimizeBtn && ipcRenderer) minimizeBtn.addEventListener('click', () => ipcRenderer.send('minimize-window'));
    if (closeBtn && ipcRenderer) closeBtn.addEventListener('click', () => ipcRenderer.send('close-window'));

    // ================================
    // FADE UTILS
    // ================================
    function fadeIn(element, duration = 400) {
        if (!element) return;
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
        if (!element) { if(callback) callback(); return; }
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
    // ONLINE / OFFLINE
    // ================================
    function updateOnlineStatus() {
        isOnline = navigator.onLine;
        if (isOnline === wasOnline && serverConnected === wasServerConnected) return;
        wasOnline = isOnline;
        wasServerConnected = serverConnected;

        if (!isOnline) {
            console.warn("%c📡 You are offline", "color: orange;");
            fadeIn(loadingScreenContainer, 200);
            fadeOut(galleryOverview, 200);
        } else {
            console.log("%c✅ App is online", "color: limegreen;");
            if (serverConnected) {
                fadeOut(loadingScreenContainer, 200);
                fadeIn(galleryOverview, 200);
            }
        }
    }
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // ================================
    // SERVER CONNECTION
    // ================================
    async function checkServerConnection() {
        if (!isOnline) return;
        try {
            const res = await fetch('http://127.0.0.1:5000/status');
            serverConnected = res.ok;
        } catch {
            serverConnected = false;
        }
        updateOnlineStatus();
    }
    setInterval(checkServerConnection, 5000);

    // ================================
    // DESKTOP SERVER RETRY LOGIC
    // ================================
    const retryDelay = 5000;
    function tryConnectDesktopServer() {
        if (!ipcRenderer) return;
        ipcRenderer.send('connect-desktop-server');

        ipcRenderer.once('desktop-server-status', (event, status) => {
            if (status.success) {
                console.log("%c✅ Desktop server started successfully.", "color: limegreen;");
                serverConnected = true;
                fadeOut(loadingScreenContainer, 400, () => fadeIn(galleryOverview, 400));
                if (galleryBtn) galleryBtn.disabled = false;
                if (analysisBtn) analysisBtn.disabled = false;
                // optionally show server IP
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
                                    setTimeout(() => { ipSpan.textContent = originalIP; ipSpan.style.color = "#333"; }, 1500);
                                }).catch(err => console.error("Failed to copy IP:", err));
                        });
                    }
                }
            } else {
                console.error("%c❌ Failed to start desktop server:", "color: red;", status.message);
                console.log(`Retrying in ${retryDelay / 1000} seconds...`);
                setTimeout(tryConnectDesktopServer, retryDelay);
            }
        });
    }

    // ================================
    // INIT USER SESSION
    // ================================
    async function initUserSession() {
        if (!userNameElement) return;

        try {
            const res = await fetch("http://127.0.0.1:5000/status", {
                method: "GET",
                credentials: "include"
            });
            const data = await res.json();

            if (!data.logged_in) {
                console.log("%c❌ No user logged in.", "color: red;");
                serverConnected = false; // ensure serverConnected is false
                updateOnlineStatus();    // immediately update UI
                return;
            }

            loggedInUserName = data.name || "User";
            userNameElement.textContent = `Hello, ${loggedInUserName}!`;
            if (dropdownUserName) dropdownUserName.textContent = loggedInUserName;
            if (dropdownUserEmail && data.email) dropdownUserEmail.textContent = data.email;

            console.log("%c👤 Logged-in user:", "color: cyan;", loggedInUserName);

            serverConnected = true;     // mark server as connected
            updateOnlineStatus();       // update UI after session check

            tryConnectDesktopServer();  // existing logic for desktop server

        } catch (err) {
            console.error("Failed to check Flask session:", err);
            serverConnected = false;    // mark server as offline
            updateOnlineStatus();       // update UI accordingly
        }
    }
    initUserSession();

    // ================================
    // USER DROPDOWN TOGGLE
    // ================================
    if (userGreeting && userDropdown) {
        userGreeting.addEventListener("click", () => {
            userDropdown.classList.toggle("show");
        });

        // Close dropdown if clicking outside
        document.addEventListener("click", (event) => {
            if (!userGreeting.contains(event.target) &&
                !userDropdown.contains(event.target)) {
                userDropdown.classList.remove("show");
            }
        });
    }

    //Log out Button
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

    // ================================
    // PAGE SWITCHING
    // ================================
    const homeBtn = document.getElementById("homeBtn");
    const galleryPage = document.getElementById("galleryPage");
    const analysisPage = document.getElementById("analysisPage");
    const homePage = document.getElementById("homePage");
    const navButtons = [homeBtn, galleryBtn, analysisBtn];

    function showPage(pageToShow) {
        if (!pageToShow || pageToShow.style.display !== "none") return;
        if (!serverConnected && (pageToShow === galleryPage || pageToShow === analysisPage)) {
            alert("⚠️ You must connect to the server first!"); return;
        }
        const pages = [homePage, galleryPage, analysisPage];
        const fadeOutPromises = pages.map(p => p && p!==pageToShow ? new Promise(r=>fadeOut(p,100,r)) : Promise.resolve());
        Promise.all(fadeOutPromises).then(() => {
            fadeIn(pageToShow,100);
            if (pageToShow !== galleryPage && analyzeModeActive) exitAnalyzeMode();
            navButtons.forEach(btn => {
                if(!btn) return;
                btn.classList.toggle("active", (
                    (btn===homeBtn && pageToShow===homePage) ||
                    (btn===galleryBtn && pageToShow===galleryPage) ||
                    (btn===analysisBtn && pageToShow===analysisPage)
                ));
            });
        });
    }

    if (homeBtn) homeBtn.addEventListener("click", () => showPage(homePage));
    if (galleryBtn) galleryBtn.addEventListener('click', () => { showPage(galleryPage); loadGalleryImages(); });
    if (analysisBtn) analysisBtn.addEventListener("click", () => showPage(analysisPage));

    showPage(homePage);

    // ================================
    // Account Modal
    // ================================
    const axios = require('axios');
    const accountModal = document.getElementById('accountSelectionModal');
    const accountModalOverlay = accountModal?.querySelector('.account-modal-overlay');
    const navbarUserAvatar = document.getElementById('navbarUserAvatar');
    const prevBtn = document.getElementById('prevAvatar');
    const nextBtn = document.getElementById('nextAvatar');
    const currentAvatarImg = document.getElementById('currentAvatar');
    const avatarLabel = document.getElementById('avatarLabel');
    const applyBtn = document.getElementById('applyAvatarChanges');
    const firstNameInput = document.getElementById('firstName');
    const lastNameInput = document.getElementById('lastName');

    const avatars = [
        { id: 0, src: '../images/Earl.png', label: 'LABRADOR' },
        { id: 1, src: '../images/Edrian.png', label: 'POMERANIAN' },
        { id: 2, src: '../images/Joaquin.png', label: 'SHIH TZU' },
        { id: 3, src: '../images/Jigs.png', label: 'CORGI' },
    ];
    let currentIndex = 0;

    function updateModalAvatar() {
        const avatar = avatars[currentIndex];
        currentAvatarImg.src = avatar.src;
        avatarLabel.textContent = avatar.label;
    }

    prevBtn?.addEventListener('click', () => { currentIndex = (currentIndex-1+avatars.length)%avatars.length; updateModalAvatar(); });
    nextBtn?.addEventListener('click', () => { currentIndex = (currentIndex+1)%avatars.length; updateModalAvatar(); });
    accountModalOverlay?.addEventListener('click', () => accountModal.classList.remove('show'));

    applyBtn?.addEventListener('click', async () => {
        const avatar = avatars[currentIndex];
        const payload = {
            avatar_id: avatar.id,
            first_name: firstNameInput.value.trim() || undefined,
            last_name: lastNameInput.value.trim() || undefined
        };
        try {
            await axios.post('http://127.0.0.1:5000/update-user', payload, { withCredentials:true });
            navbarUserAvatar.src = avatar.src;
            if(payload.first_name || payload.last_name){
                loggedInUserName = `${payload.first_name||''} ${payload.last_name||''}`.trim() || loggedInUserName;
            }
            localStorage.setItem('userAvatar', avatar.src);
            localStorage.setItem('userAvatarID', avatar.id);
            accountModal.classList.remove('show');
        } catch(err){
            console.error('❌ Failed to update user in DB:', err);
            alert('Failed to save changes. Please try again.');
        }
    });

    (async () => {
        try {
            const res = await axios.get('http://127.0.0.1:5000/status', {withCredentials:true});
            const user = res.data;
            if(user.logged_in){
                const savedAvatarID = user.avatar_id ?? 0;
                currentIndex = savedAvatarID < avatars.length ? savedAvatarID : 0;
                navbarUserAvatar.src = avatars[currentIndex].src;
            }
            updateModalAvatar();
        } catch(err){
            console.error('⚠️ Could not fetch user status:', err);
            updateModalAvatar();
        }
    })();

    // Open Account Modal
    const openAccountModal = document.getElementById("changeProfileBtn");

    openAccountModal?.addEventListener("click", () => {
        accountModal.classList.add("show");
    });

    // ================================
    // STATS CARDS WITH RETRY
    // ================================
    const statsRetryDelay = 5000; // retry every 5 seconds if failed

    async function loadStatsCards() {
        try {
            const res = await fetch('http://127.0.0.1:5001/images');
            const data = await res.json();

            if (!data.success) {
                console.error("Failed to load images:", data.message);
                return;
            }

            const images = data.images;

            // ===========================
            // Initialize counters
            // ===========================
            let rawCount = 0;
            const diseaseCounts = {
                'Allergic Dermatitis': 0,
                'Fungal Infection': 0,
                'Hotspot': 0,
                'Mange': 0,
                'Healthy': 0
            };

            images.forEach(img => {
                if (!img.analyzed) {
                    rawCount++;
                } else if (img.disease) {
                    const diseaseName = img.disease.toLowerCase();
                    switch(diseaseName) {
                        case 'allergic dermatitis': diseaseCounts['Allergic Dermatitis']++; break;
                        case 'fungal infection': diseaseCounts['Fungal Infection']++; break;
                        case 'hotspot': diseaseCounts['Hotspot']++; break;
                        case 'mange': diseaseCounts['Mange']++; break;
                        case 'healthy': diseaseCounts['Healthy']++; break;
                        default: break; // ignore unknown diseases
                    }
                }
            });

            // ===========================
            // Build & render stats cards
            // ===========================
            const cardsData = [
                { label: 'Raw', count: rawCount },
                { label: 'Healthy', count: diseaseCounts['Healthy'] },
                { label: 'Allergic Dermatitis', count: diseaseCounts['Allergic Dermatitis'] },
                { label: 'Fungal Infection', count: diseaseCounts['Fungal Infection'] },
                { label: 'Hotspot', count: diseaseCounts['Hotspot'] },
                { label: 'Mange', count: diseaseCounts['Mange'] }
            ];

            const cardsContainer = document.getElementById('statsCardsRow');
            if (cardsContainer) {
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
            }

            // ===========================
            // Insight 1: Healthy scans
            // ===========================
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
                    healthyText.textContent = 'No Healthy scans detected yet.';
                    healthyInsightCard.classList.add("decline");
                } else if (diseaseCounts['Healthy'] < totalOther) {
                    healthyIcon.classList.remove("bi-arrow-up-circle");
                    healthyIcon.classList.add("bi-arrow-down-circle");
                    healthyText.textContent = 'Healthy scans decreased, showing overall decline.';
                    healthyInsightCard.classList.add("decline");
                } else {
                    healthyIcon.classList.remove("bi-arrow-down-circle");
                    healthyIcon.classList.add("bi-arrow-up-circle");
                    healthyText.textContent = 'Healthy scans increased, showing overall improvement.';
                    healthyInsightCard.classList.remove("decline");
                }
            }

            // ===========================
            // Insight 2: Top Disease
            // ===========================
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

            // ===========================
            // Insight 3: Lowest Disease
            // ===========================
            const lowestInsightCard = document.getElementById("lowestInsight");
            if (lowestInsightCard) {
                const mainDiseases = ['Allergic Dermatitis', 'Fungal Infection', 'Hotspot', 'Mange'];
                const normalizedCounts = {};
                mainDiseases.forEach(disease => normalizedCounts[disease] = diseaseCounts[disease] ?? 0);

                const filteredCounts = Object.entries(normalizedCounts).filter(([_, count]) => count > 0);

                if (filteredCounts.length > 0) {
                    filteredCounts.sort((a, b) => a[1] - b[1]);
                    const [lowestDisease, lowestCount] = filteredCounts[0];
                    const totalAnalyzed = Object.values(normalizedCounts).reduce((sum, c) => sum + c, 0);
                    const percentage = totalAnalyzed > 0 ? ((lowestCount / totalAnalyzed) * 100).toFixed(1) : 0;

                    const lowestIcon = lowestInsightCard.querySelector('i');
                    const lowestText = lowestInsightCard.querySelector('.insight-text strong');

                    lowestText.textContent = `${lowestDisease} accounts for only ${percentage}% of all analyzed images.`;

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
                    lowestInsightCard.querySelector('.insight-text strong').textContent = "No disease detected yet.";
                }
            }

            // ===========================
            // Optional: chart update
            // ===========================
            if (typeof updateStatsChart === 'function') updateStatsChart();

            console.log("%c✅ Synced gallery overview with gallery server.", "color: limegreen;");

        } catch (err) {
            console.error("Error loading stats cards:", err);
            setTimeout(loadStatsCards, statsRetryDelay);
        }
    }

    // initial load
    loadStatsCards();

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
}
