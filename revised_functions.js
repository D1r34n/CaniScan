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
    const leftColumn = document.querySelector(".gallery-left");

    if (detailPane && minimizeDetail && leftColumn) {
      minimizeDetail.addEventListener("click", () => {
        const isMinimized = detailPane.classList.contains("minimized");
        if (isMinimized) {
          detailPane.classList.remove("minimized");
          leftColumn.style.flex = "3";
          minimizeDetail.innerHTML = "<i class='bi bi-layout-text-sidebar-reverse'></i> Hide Details";
        } else {
          detailPane.classList.add("minimized");
          leftColumn.style.flex = "4.5";
          minimizeDetail.innerHTML = "<i class='bi bi-layout-text-sidebar-reverse'></i> Show Details";
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

     // Initialize analysis page when it's shown
    function initializeAnalysisPage() {
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
            loadAnalysisHistory();
            console.log('Analysis history loaded');
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
            document.getElementById('analysisResults').style.display = 'none';
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
                // Simulate YOLOv8 analysis (replace with actual API call)
                await simulateAnalysis();
                
                // Show results
                analysisResults.style.display = 'block';
                resultDiagnosis.textContent = 'Fungal Infection';
                resultConfidence.textContent = '87%';
                
                // Add to history
                addToAnalysisHistory(previewImage.src, 'Fungal Infection', '87%');
                
            } catch (error) {
                console.error('Analysis failed:', error);
                alert('Analysis failed. Please try again.');
            } finally {
                // Reset button
                analyzeBtn.disabled = false;
                analyzeBtn.innerHTML = 'Analyze';
            }
        });
        
        async function simulateAnalysis() {
            // Simulate processing time
            return new Promise(resolve => setTimeout(resolve, 2000));
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
            
            // Simulate bot response
            setTimeout(() => {
                const responses = [
                    "Based on the analysis, I recommend consulting with a veterinarian for proper treatment.",
                    "For fungal infections, keep the affected area clean and dry. Avoid scratching.",
                    "Consider using antifungal treatments as prescribed by your vet.",
                    "Monitor your dog's condition and watch for any changes in behavior or symptoms."
                ];
                const randomResponse = responses[Math.floor(Math.random() * responses.length)];
                addChatMessage(randomResponse, 'bot');
            }, 1000);
        }
        
        sendMessageBtn.addEventListener('click', sendMessage);
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
        
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
    
    // Analysis history functionality
    function loadAnalysisHistory() {
        // Load from localStorage or server
        const history = JSON.parse(localStorage.getItem('analysisHistory') || '[]');
        const historyList = document.getElementById('analysisHistoryList');
        
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
            document.body.removeChild(popup);
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
    if (analysisBtn) analysisBtn.addEventListener("click", () => {
    showPage(analysisPage); // 1. Show the page

    // 2. Use a small delay to let the page fade in
    setTimeout(() => {
        try {
            // 3. Initialize all the analysis functions you just pasted
            initializeAnalysisPage(); 
            console.log('%c🔬 Analysis page initialized successfully', 'color: cyan;');
        } catch (error) {
            console.error('Error initializing analysis page:', error);
        }
    }, 100); // 100ms matches your fade-in time
});

    showPage(homePage);

  }); // end DOMContentLoaded

  console.log("%c✅ functions.js initialization complete.", "color: limegreen;");
} else {
  console.log("%c⚠️ functions.js already initialized — skipping duplicate load.", "color: orange;");
}
