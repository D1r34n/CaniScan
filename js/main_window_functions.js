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
    const userNameElement = document.getElementById("userName");
    const dropdownUserName = document.getElementById("dropdownUserName");
    const slideContainer = dropdownUserName?.querySelector(".user-slide span");
    const userGreeting = document.getElementById('userGreeting');
    const userDropdown = document.getElementById('userDropdown');
    const logoutBtn = document.getElementById('logoutBtn');

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
    const openAccountModal = document.getElementById("changeProfileBtn");

    const qrContainer = document.getElementById('qrCodeContainer');
    const openBtn = document.getElementById('openQRCodeBtn');
    const closeBtnQR = document.getElementById('closeQRCodeBtn');

    const loading = document.getElementById('qrLoading');
    const qrDisplay = document.getElementById('qrDisplay');
    const errorSection = document.getElementById('qrError');
    const successSection = document.getElementById('qrSuccess');

    const qrImage = document.getElementById('qrImage');
    const serverUrlLabel = document.getElementById('serverUrlLabel');
    const connectionStatusText = document.getElementById('connectionStatusText');

    const statsRetryDelay = 5000;
    const retryDelay = 5000;
    const serverUrl = "http://127.0.0.1:5001";

    let isOnline = navigator.onLine;
    let serverConnected = false;
    let userLoggedIn = false;
    let gallerySynced = false;
    let loggedInUserName = "";
    let fadeLocked = false;
    let listenersAttached = false;
    let currentIndex = 0;
    let checkInterval = null;
    let connectionCheckCount = 0;

    const avatars = [
        { id: 0, src: '../images/Earl.png', label: 'LABRADOR' },
        { id: 1, src: '../images/Edrian.png', label: 'POMERANIAN' },
        { id: 2, src: '../images/Joaquin.png', label: 'SHIH TZU' },
        { id: 3, src: '../images/Jigs.png', label: 'CORGI' },
    ];

    // ================================
    // ELECTRON IPC
    // ================================
    let ipcRenderer;
    try {
        const electron = require('electron');
        ipcRenderer = electron.ipcRenderer;
        console.log("Electron detected, ipcRenderer loaded.");
    } catch { console.log("Not running in Electron, skipping ipcRenderer."); }

    minimizeBtn?.addEventListener('click', () => ipcRenderer?.send('minimize-window'));
    closeBtn?.addEventListener('click', () => ipcRenderer?.send('close-window'));

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

    function fadeInLoading() {
        if (!fadeLocked) {
            fadeLocked = true;
            fadeIn(loadingScreenContainer, 200);
            fadeOut(galleryOverview, 200, () => { fadeLocked = false; });
        }
    }

    function fadeOutLoading() {
        if (!fadeLocked) {
            fadeLocked = true;
            fadeOut(loadingScreenContainer, 400, () => {
                fadeIn(galleryOverview, 400);
                fadeLocked = false;
            });
        }
    }

    // ================================
    // ONLINE / OFFLINE
    // ================================
    function updateOnlineStatus() {
        isOnline = navigator.onLine;
        if (!isOnline) {
            console.warn("%c📡 You are offline", "color: orange;");
            fadeInLoading();
        } else {
            console.log("%c✅ App is online", "color: limegreen;");
            checkReadyToFadeOut();
        }
    }
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // ================================
    // CHECK READY TO FADE OUT LOADING
    // ================================
    function checkReadyToFadeOut() {
        if (isOnline && serverConnected && userLoggedIn && gallerySynced) {
            fadeOutLoading();
        }
    }

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
        checkReadyToFadeOut();
    }

    // ============================================
    // SAFE WATCHDOG INITIALIZER (runs only once)
    // ============================================
    let watchdogInitialized = false;

    function initWatchdog() {
        if (watchdogInitialized) return; // prevent duplicates
        watchdogInitialized = true;

        console.log("%c🔍 Initializing watchdog listener...", "color: yellow;");

        const evtSource = new EventSource(`http://${serverIP}/events`);

        evtSource.onmessage = function(event) {
            console.log("%c" + event.data, "color: limegreen; font-weight: bold;");
            loadStatsCards();
            loadGalleryImages(); // auto-refresh gallery
        };

        evtSource.onerror = function() {
            console.warn("Watchdog lost connection. Will retry automatically.");
        };
    }

    function tryConnectDesktopServer() {
        if (!ipcRenderer) return;
        ipcRenderer.send('connect-desktop-server');
        ipcRenderer.once('desktop-server-status', async (event, status) => {
            if (status.success) {
                console.log("%c✅ Desktop server started successfully.", "color: limegreen;");
                serverConnected = true;

                galleryBtn?.removeAttribute('disabled');
                analysisBtn?.removeAttribute('disabled');

                // Load IP from desktop server BEFORE watchdog
                try {
                    await fetchServerIP();
                    initWatchdog();
                } catch (err) {
                    console.error("Failed to fetch server IP before starting watchdog:", err);
                }

                checkReadyToFadeOut();

            } else {
                console.error("%c❌ Failed to start desktop server:", "color: red;", status.message);
                setTimeout(tryConnectDesktopServer, retryDelay);
            }
        });
    }

    let serverIP = '127.0.0.1:5001'; // default/fallback

    // Fetch current server IP dynamically from backend
    async function fetchServerIP() {
        try {
            const res = await fetch(`http://${serverIP}/ip`);
            const ipAddress = document.getElementById('ipAddress');
            if (!res.ok) throw new Error('Failed to fetch IP');
            const data = await res.json();
            if (data.success && data.ip) {
                serverIP = `${data.ip}:5001`; // update serverIP dynamically
            } else {
                console.warn('Could not retrieve IP from server, keeping default.');
            }
            ipAddress.textContent = serverIP;
        } catch (err) {
            console.error('Error fetching dynamic server IP:', err);
        }
    }

    // Copy IP to clipboard using current serverIP
    async function copyServerIP() {
        try {
            const res = await fetch(`http://${serverIP}/ip`);
            if (!res.ok) throw new Error('Failed to fetch IP');

            const data = await res.json();
            if (data.success && data.ip) {
                await navigator.clipboard.writeText(data.ip);

                const slideContainer = document.getElementById('ipAddress');
                slideContainer.textContent = 'Copied!';
                slideContainer.style.color = "#4caf50";

                setTimeout(() => {
                    slideContainer.textContent = data.ip;
                    slideContainer.style.color = "#2f3035";
                }, 1500);
            } else {
                console.error('No IP returned', data);
                alert('Failed to retrieve server IP.');
            }
        } catch (err) {
            console.error('Error fetching/copying IP:', err);
            alert('Error fetching server IP.');
        }
    }
    // ================================
    // USER SESSION
    // ================================
    async function initUserSession() {
        if (!userNameElement || userLoggedIn) return;
        try {
            const res = await fetch("http://127.0.0.1:5000/status", { method: "GET", credentials: "include" });
            const data = await res.json();

            if (!data.logged_in) {
                console.log("%c❌ No user logged in.", "color: red;");
                serverConnected = false;
                fadeInLoading();
                return;
            }

            userLoggedIn = true;
            loggedInUserName = data.name || "User";
            const fullName = `${data.name || ''} ${data.lastname || ''}`.trim();
            userNameElement.textContent = `Hello, ${loggedInUserName}!`;
            slideContainer.textContent = fullName || 'User';

            const emailClipBoard = document.getElementById('copyEmailBtn');

            if (!listenersAttached && dropdownUserName) {
                listenersAttached = true;
                dropdownUserName.addEventListener('mouseenter', () => {
                    slideContainer.textContent = data.email || 'user@gmail.com';
                    dropdownUserName.querySelector(".user-slide").classList.add('slide');
                });
                dropdownUserName.addEventListener('mouseleave', () => {
                    slideContainer.textContent = fullName || 'User';
                    dropdownUserName.querySelector(".user-slide").classList.remove('slide');
                });

                emailClipBoard.addEventListener('click', async () => {
                    try {
                        await navigator.clipboard.writeText(data.email);
                        slideContainer.textContent = 'Copied!';
                        slideContainer.style.color = "#4caf50";
                        dropdownUserName.style.userSelect = 'none';
                        dropdownUserName.querySelector(".user-slide").classList.remove('slide');
                        setTimeout(() => {
                            slideContainer.textContent = data.email || 'user@gmail.com';
                            slideContainer.style.color = "white";
                            dropdownUserName.querySelector(".user-slide").classList.add('slide');
                        }, 1500);
                    } catch (err) { console.error('Failed to copy email:', err); }
                });
            }

            document.getElementById('copyIPBtn').addEventListener('click', copyServerIP);   

            console.log("%c👤 Logged-in user:", "color: cyan;", loggedInUserName);
            serverConnected = true;
            checkReadyToFadeOut();
            tryConnectDesktopServer();

        } catch (err) {
            console.error("Failed to check Flask session:", err);
            serverConnected = false;
            fadeInLoading();
        }
    }

    // ================================
    // GALLERY SYNC
    // ================================
    async function loadGalleryOverview() {
        if (gallerySynced) return;
        try {
            await loadGalleryImages();
            gallerySynced = true;
            checkReadyToFadeOut();
        } catch (err) {
            console.error("Failed to load gallery:", err);
            setTimeout(loadGalleryOverview, 5000);
        }
    }

    // ================================
    // STATS CARDS
    // ================================

    const rawViewBtn = document.getElementById('rawViewBtn');
    const dermatitisBtn = document.getElementById('dermatitisBtn');
    const fungalBtn = document.getElementById('fungalBtn');
    const hotspotsBtn = document.getElementById('hotspotsBtn');
    const mangeBtn = document.getElementById('mangeBtn');
    const healthyBtn = document.getElementById('healthyBtn');

    const sortRaw = document.getElementById('sortRaw');
    const sortDermatitis = document.getElementById('sortDermatitis');
    const sortFungal = document.getElementById('sortFungal');
    const sortHotspot = document.getElementById('sortHotspot');
    const sortMange = document.getElementById('sortMange');
    const sortHealthy = document.getElementById('sortHealthy');

    const sortDropdownContainer = document.querySelector('.sort-dropdown-container');
    const sortDropdownButton = document.getElementById('sortDropdown');

    const applyFilter = (e, checkboxIdToActivate) => {
        e.stopPropagation();

        showPage(galleryPage);
        loadGalleryImages();

        if (sortDropdownButton) {
            // 1. Open the dropdown
            sortDropdownContainer.classList.add('show'); 
            
            // 2. Find all checkboxes
            const allSortCheckboxes = sortDropdownContainer.querySelectorAll('.form-check-input'); 

            // 3. Clear all checks and set the target check
            allSortCheckboxes.forEach(checkbox => {
                // Uncheck every box...
                checkbox.checked = false;
            });
            
            // ...then explicitly check the target box using the passed ID
            const targetCheckbox = document.getElementById(checkboxIdToActivate);
            if (targetCheckbox) {
                targetCheckbox.checked = true;
                console.log(`Filter activated: ${checkboxIdToActivate} is now checked.`);
            }
        }
    };

    rawViewBtn.addEventListener('click', (e) => applyFilter(e, 'sortRaw'));
    dermatitisBtn.addEventListener('click', (e) => applyFilter(e, 'sortDermatitis'));
    fungalBtn.addEventListener('click', (e) => applyFilter(e, 'sortFungal'));
    hotspotsBtn.addEventListener('click', (e) => applyFilter(e, 'sortHotspot'));
    mangeBtn.addEventListener('click', (e) => applyFilter(e, 'sortMange'));
    healthyBtn.addEventListener('click', (e) => applyFilter(e, 'sortHealthy'));

    const buttonMap = {
    'Raw': rawViewBtn,
    'Healthy': healthyBtn,
    'Allergic Dermatitis': dermatitisBtn,
    'Fungal Infection': fungalBtn,
    'Hot Spots': hotspotsBtn, // Use 'Hot Spots' label to match cardsData
    'Mange': mangeBtn
    };

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
        // (Counters logic remains the same)
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
        // Update numbers in existing stats cards 🚀
        // ===========================
        
        // 1. Map card names to their corresponding DOM IDs
        const cardIdMap = {
            'Raw': 'rawCard',
            'Healthy': 'healthyCard',
            'Allergic Dermatitis': 'dermatitisCard',
            'Fungal Infection': 'fungalCard',
            'Hot Spots': 'hotspotCard', 
            'Mange': 'mangeCard'
        };

        const cardsData = [
            { label: 'Raw', count: rawCount },
            { label: 'Healthy', count: diseaseCounts['Healthy'] },
            { label: 'Allergic Dermatitis', count: diseaseCounts['Allergic Dermatitis'] },
            { label: 'Fungal Infection', count: diseaseCounts['Fungal Infection'] },
            { label: 'Hot Spots', count: diseaseCounts['Hotspot'] }, 
            { label: 'Mange', count: diseaseCounts['Mange'] }
        ];

        cardsData.forEach(card => {
            const cardId = cardIdMap[card.label];
            const cardEl = document.getElementById(cardId);
            
            if (cardEl) {
                // Find the span with class 'number' inside the specific card
                const countSpan = cardEl.querySelector('.number');
                if (countSpan) {
                    countSpan.textContent = card.count;
                }
            }

            // 🛑 NEW LOGIC: Disable button if count is 0
            const buttonEl = buttonMap[card.label];
            if (buttonEl) {
                // buttonEl.disabled will be true if count is 0, false otherwise
                buttonEl.disabled = (card.count === 0);

                // Optional: Add a class to the whole card for visual feedback (e.g., grey-out)
                const statCardEl = buttonEl.closest('.stat-card');
                if (statCardEl) {
                    statCardEl.classList.toggle('disabled-card', card.count === 0);
                }
            }
        });

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

            // filteredCounts contains only the diseases that have a count > 0
            const filteredCounts = Object.entries(normalizedCounts).filter(([_, count]) => count > 0);

            const lowestText = lowestInsightCard.querySelector('.insight-text strong');
            const lowestIcon = lowestInsightCard.querySelector('i');

            if (filteredCounts.length > 0) {
                filteredCounts.sort((a, b) => a[1] - b[1]);
                const [lowestDisease, lowestCount] = filteredCounts[0];
                const totalAnalyzed = Object.values(normalizedCounts).reduce((sum, c) => sum + c, 0);

                // --- NEW CHECK FOR ONLY ONE DISEASE PRESENT ---
                if (filteredCounts.length === 1) {
                    lowestText.textContent = `Only ${lowestDisease} detected. No other major diseases found!`;
                    
                    // Set a neutral/positive style for this unique scenario
                    lowestIcon.classList.remove("bi-exclamation-circle", "bi-search");
                    lowestIcon.classList.add("bi-lightbulb"); // Use a "lightbulb" or "info" icon
                    lowestInsightCard.classList.remove("alert");
                    
                } else {
                    // --- Original logic for multiple diseases present ---
                    const percentage = ((lowestCount / totalAnalyzed) * 100).toFixed(1);

                    lowestText.textContent = `${lowestDisease} accounts for ${percentage}% of all analyzed images.`;

                    if (percentage < 10) {
                        lowestIcon.classList.remove("bi-search");
                        lowestIcon.classList.add("bi-exclamation-circle");
                        lowestInsightCard.classList.add("alert");
                    } else {
                        lowestIcon.classList.add("bi-search");
                        lowestIcon.classList.remove("bi-exclamation-circle");
                        lowestInsightCard.classList.remove("alert");
                    }
                }
            } else {
                // --- Logic for ZERO diseases detected ---
                // This check is the same as the solution in the previous step
                
                const totalDiseases = mainDiseases.reduce((sum, disease) => sum + diseaseCounts[disease], 0);

                if (totalDiseases === 0) {
                    lowestText.textContent = "Great news! No major diseases detected in analyzed images.";
                    
                    lowestIcon.classList.remove("bi-exclamation-circle", "bi-search");
                    lowestIcon.classList.add("bi-hand-thumbs-up");
                    lowestInsightCard.classList.remove("alert");
                } else {
                    // Fallback (Should only happen if logic is flawed or if there's only 'Healthy' count)
                    lowestText.textContent = "No disease detected yet.";
                }
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
    // ACCOUNT MODAL
    // ================================
    function updateModalAvatar() {
        const avatar = avatars[currentIndex];
        currentAvatarImg.src = avatar.src;
        avatarLabel.textContent = avatar.label;
    }

    prevBtn?.addEventListener('click', () => { currentIndex=(currentIndex-1+avatars.length)%avatars.length; updateModalAvatar(); });
    nextBtn?.addEventListener('click', () => { currentIndex=(currentIndex+1)%avatars.length; updateModalAvatar(); });
    accountModalOverlay?.addEventListener('click', () => accountModal.classList.remove('show'));
    applyBtn?.addEventListener('click', async () => {
        const avatar = avatars[currentIndex];
        try {
            const payload={avatar_id:avatar.id,first_name:firstNameInput.value.trim()||undefined,last_name:lastNameInput.value.trim()||undefined};
            await require('axios').post('http://127.0.0.1:5000/update-user', payload,{withCredentials:true});
            navbarUserAvatar.src = avatar.src;
            if(payload.first_name||payload.last_name) loggedInUserName=`${payload.first_name||''} ${payload.last_name||''}`.trim()||loggedInUserName;
            localStorage.setItem('userAvatar',avatar.src);
            localStorage.setItem('userAvatarID',avatar.id);
            accountModal.classList.remove('show');
        } catch(err){ console.error(err); alert('Failed to save changes.'); }
    });

    openAccountModal?.addEventListener("click",()=>accountModal.classList.add("show"));

    // -------------------------------
    // UI HELPERS
    // -------------------------------
    function showSection(section) {
        loading.style.display = "none";
        qrDisplay.style.display = "none";
        errorSection.style.display = "none";
        successSection.style.display = "none";

        if (section === "loading") loading.style.display = "block";
        if (section === "qr") qrDisplay.style.display = "block";
        if (section === "error") errorSection.style.display = "block";
        if (section === "success") successSection.style.display = "block";
    }

    function showQRCodeOverlay() {
        // Make sure the QR container is visible
        qrContainer.classList.add("active");

        // Reset all sections
        loading.style.display = "block";
        qrDisplay.style.display = "none";
        errorSection.style.display = "none";
        successSection.style.display = "none";

        // Reset connection status text for a fresh QR scan
        connectionStatusText.innerText = "Waiting for connection...";
        connectionStatusText.style.color = "";          // Restore default color
        connectionStatusText.classList.add("status-text"); // Re-enable pulsing animation

        // Generate QR code from the server
        generateQRCode();
    }

    function hideQRCode() {
        qrContainer.classList.remove("active");
        stopConnectionCheck();
    }

    // -------------------------------
    // QR GENERATION
    // -------------------------------
    async function generateQRCode() {
        try {
            const response = await fetch(`${serverUrl}/qr/generate`);
            const data = await response.json();

            if (!data.success) return showError("Failed to generate QR code.");

            qrImage.src = data.qr_code;
            serverUrlLabel.textContent = data.server_url;

            showSection("qr");
            startConnectionCheck();

        } catch (e) {
            showError("Cannot connect to server. Ensure it's running.");
        }
    }

    function showError(message) {
        document.getElementById("qrErrorMessage").innerText = message;
        showSection("error");
    }

    // -------------------------------
    // CONNECTION CHECKER
    // -------------------------------
    function startConnectionCheck() {
        connectionCheckCount = 0;
        const timeLimit = 5; // 5 checks

        // Ensure any previous interval is cleared
        if (checkInterval) clearInterval(checkInterval);

        checkInterval = setInterval(() => {
            connectionCheckCount++;

            fetch(`${serverUrl}/connection-status`)
                .then(response => response.json())
                .then(data => {
                    if (data.phoneConnected) {
                        stopConnectionCheck();
                        onPhoneConnected(data.connections[0]);
                        return;
                    }

                    if (connectionCheckCount >= timeLimit) {
                        stopConnectionCheck();
                        showTimeoutMessage();
                    }
                })
                .catch(err => {
                    console.warn("Connection check failed:", err);

                    if (connectionCheckCount >= timeLimit) {
                        stopConnectionCheck();
                        showTimeoutMessage();
                    }
                });

        }, 1500);
    }

    function stopConnectionCheck() {
        if (checkInterval) {
            clearInterval(checkInterval);
            checkInterval = null;
        }
    }

    function showTimeoutMessage() {
        connectionStatusText.innerText = "Connection timeout. Please try again.";
        connectionStatusText.classList.remove("status-text");
        connectionStatusText.style.color = "#ff9800";
    }

    function onPhoneConnected(info) {
        stopConnectionCheck();

        document.getElementById("deviceName").innerText = info.device_name;
        document.getElementById("deviceIP").innerText = info.ip;
        document.getElementById("deviceTime").innerText =
            new Date(info.connected_at).toLocaleTimeString();

        showSection("success");
    }

    openBtn?.addEventListener("click", showQRCodeOverlay);
    closeBtnQR?.addEventListener("click", hideQRCode);

    // ================================
    // IMAGE UPLOAD HANDLER
    // ================================
    window.handleImageFile = function(file){
        if(!file||!file.type.startsWith('image/')) return console.error('Invalid file type');
        const uploadArea=document.getElementById('imageUploadArea');
        const uploadPlaceholder=uploadArea?.querySelector('.upload-placeholder');
        const imagePreview=document.getElementById('imagePreview');
        const previewImage=document.getElementById('previewImage');
        if(!uploadArea||!uploadPlaceholder||!imagePreview||!previewImage) return console.error('Required elements missing');
        const reader=new FileReader();
        reader.onload=(e)=>{ previewImage.src=e.target.result; uploadPlaceholder.style.display='none'; imagePreview.style.display='block'; previewImage.dataset.sourceFilename=''; window.currentAnalysisSource={type:'upload',filename:file.name||'uploaded-image'}; };
        reader.onerror=(e)=>{ console.error(e); alert('Error loading image.'); };
        reader.readAsDataURL(file);
    };

    // ================================
    // ALERT OVERRIDE
    // ================================
    const originalAlert=window.alert;
    window.alert=function(message){ const r=originalAlert.call(window,message); setTimeout(()=>restoreChatInputClickability(),100); return r; };

    // ================================
    // PAGE SWITCHING
    // ================================
    const homeBtn = document.getElementById("homeBtn");
    const galleryPage = document.getElementById("galleryPage");
    const analysisPage = document.getElementById("analysisPage");
    const homePage = document.getElementById("homePage");
    const navButtons = [homeBtn,galleryBtn,analysisBtn];

    function showPage(page){
        if(!page||page.style.display!=="none") return;
        if(!serverConnected&&(page===galleryPage||page===analysisPage)){alert("⚠️ Connect to server first!"); return;}
        const pages=[homePage,galleryPage,analysisPage];
        const fadeOutPromises=pages.map(p=>p&&p!==page?new Promise(r=>fadeOut(p,100,r)):Promise.resolve());
        Promise.all(fadeOutPromises).then(()=>{
            fadeIn(page,100);
            if(page!==galleryPage&&analyzeModeActive) exitAnalyzeMode();
            navButtons.forEach(btn=>btn?.classList.toggle("active",(btn===homeBtn&&page===homePage)||(btn===galleryBtn&&page===galleryPage)||(btn===analysisBtn&&page===analysisPage)));
        });
    }

    window.showPage = showPage;

    homeBtn?.addEventListener("click",()=>showPage(homePage));
    galleryBtn?.addEventListener("click",()=>{ showPage(galleryPage); loadGalleryImages(); });
    analysisBtn?.addEventListener("click",()=>{
        showPage(analysisPage);
        setTimeout(()=>{
            if(window.analysisPageFunctions?.restoreChatInputClickability) restoreChatInputClickability();
            if(window._analysisPageCallback){ const cb=window._analysisPageCallback; window._analysisPageCallback=null; setTimeout(()=>cb?.(),300);}
        },150);
    });

    // ================================
    // INITIAL LOAD
    // ================================
    (async function initApp(){
        updateOnlineStatus();
        await initUserSession();
        await loadGalleryOverview();
        await loadStatsCards();
        await checkServerConnection();
        showPage(homePage);
    })();
}
