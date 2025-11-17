// Home Page Functions
import { loadGalleryImages, analyzeModeActive, exitAnalyzeMode } from './gallery_page.js';

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
    updateOnlineStatus();

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
            const res = await fetch("http://127.0.0.1:5000/status", { method: "GET", credentials: "include" });
            const data = await res.json();
            if (!data.logged_in) { console.log("%c❌ No user logged in.", "color: red;"); return; }

            loggedInUserName = data.name || "User";
            userNameElement.textContent = `Hello, ${loggedInUserName}!`;
            if (dropdownUserName) dropdownUserName.textContent = loggedInUserName;
            if (dropdownUserEmail && data.email) dropdownUserEmail.textContent = data.email;

            console.log("%c👤 Logged-in user:", "color: cyan;", loggedInUserName);
            tryConnectDesktopServer();
        } catch (err) {
            console.error("Failed to check Flask session:", err);
        }
    }
    initUserSession();

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
    // AVATAR MODAL
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

    // ================================
    // STATS CARDS WITH RETRY
    // ================================
    const statsRetryDelay = 5000; // retry every 5 seconds if failed

    async function loadStatsCards() {
        try {
            const res = await fetch('http://127.0.0.1:5001/images');
            const data = await res.json();
            if (!data.success) throw new Error(data.message || "Unknown error");

            const images = data.images;
            let rawCount = 0;
            const diseaseCounts = {
                'Allergic Dermatitis': 0,
                'Fungal Infection': 0,
                'Hotspot': 0,
                'Mange': 0,
                'Healthy': 0
            };

            images.forEach(img => {
                if (!img.analyzed) { rawCount++; return; }
                switch ((img.disease || '').toLowerCase()) {
                    case 'allergic dermatitis': diseaseCounts['Allergic Dermatitis']++; break;
                    case 'fungal infection': diseaseCounts['Fungal Infection']++; break;
                    case 'hotspot': diseaseCounts['Hotspot']++; break;
                    case 'mange': diseaseCounts['Mange']++; break;
                    case 'healthy': diseaseCounts['Healthy']++; break;
                }
            });

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

            // (Optional) update healthy/top disease insights here
            if (typeof updateStatsChart === 'function') updateStatsChart();

            console.log("%c✅ Synced gallery overview with gallery server.", "color: limegreen;");
        } catch (err) {
            console.error("Error loading stats cards:", err);
            console.log(`Retrying in ${statsRetryDelay / 1000}s...`);
            setTimeout(loadStatsCards, statsRetryDelay); // retry automatically
        }
    }

    // initial load
    loadStatsCards();

}

// End of Home Page Functions

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
            const resultDiagnosis = document.getElementById('resultDiagnosis');
            const resultConfidence = document.getElementById('resultConfidence');
            const resultInferenceTime = document.getElementById('resultInferenceTime');
            
            if (analysisResults) {
                analysisResults.style.display = 'block'; 
                resultDiagnosis.textContent = 'Pending...'; 
                resultConfidence.textContent = '--'; 
                if (resultInferenceTime) {
                    resultInferenceTime.textContent = '--';
                }
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
            console.log('Select from gallery button clicked');
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
        const resultInferenceTime = document.getElementById('resultInferenceTime');
        if (resultDiagnosis) {
            resultDiagnosis.textContent = '-';
        }
        if (resultConfidence) {
            resultConfidence.textContent = '-';
        }
        if (resultInferenceTime) {
            resultInferenceTime.textContent = '-';
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

