// This function ensures all HTML is loaded before any JavaScript runs, preventing crashes.
document.addEventListener('DOMContentLoaded', () => {

  // --- CODE FOR INDEX.HTML ---
  // This entire block will only run if it detects the home button on the page.
  const homeBtn = document.getElementById('homeBtn');
  if (homeBtn) {
    const { ipcRenderer } = require('electron');

    // Window Controls
    document.getElementById('minimize').addEventListener('click', () => {
        ipcRenderer.send('minimize-window');
    });
    document.getElementById('close').addEventListener('click', () => {
        ipcRenderer.send('close-window');
    });


    // Send username
    ipcRenderer.on("user-data", (event, data) => {
      const userNameSpan = document.getElementById("userName");
      if (userNameSpan) {
        userNameSpan.textContent = `Welcome, ${data.name}!`;
      }
    });

    // Navigation Elements
    const galleryBtn = document.getElementById('galleryBtn');
    const analysisBtn = document.getElementById('analysisBtn');
    const homePage = document.getElementById('homePage');
    const homeConnection = document.getElementById('homeConnection');
    const galleryOverview = document.getElementById('galleryOverview');
    const galleryPage = document.getElementById('galleryPage');
    const analysisPage = document.getElementById('analysisPage');
    const sortGallery = document.getElementById('sortGallery');

    // Other Page Elements
    const connectBtn = document.getElementById('connectPhoneButton');
    const disconnectBtn = document.getElementById('disconnectPhoneButton');
    const analysisVideo = document.getElementById('analysisVideo');
    const statusIndicator = document.querySelector('.phone-status .status-indicator');
    const galleryGrid = document.getElementById('galleryGrid');
    // const createFolderBtn = document.getElementById('createFolderBtn');

    // Server Configuration
    const SERVER_URL = 'http://localhost:5001';
    let stream = null;
    let connected = false; // This is the user-facing "connected" state
    let serverConnected = false; // This is the actual server health
    let currentPage = 'home';
    let serverCheckInterval = null;
    let analyzing = false;
    let galleryFolders = [];
    let serverImages = [];
    
    // --- Navigation Functionality ---
    function switchPage(page) {
        homePage.style.display = 'none';
        galleryPage.style.display = 'none';
        analysisPage.style.display = 'none';

        homeBtn.classList.remove('active');
        galleryBtn.classList.remove('active');
        analysisBtn.classList.remove('active');

        switch (page) {
            case 'home':
                homePage.style.display = 'flex';
                homeBtn.classList.add('active');
                break;
            case 'gallery':
                galleryPage.style.display = 'flex';
                galleryBtn.classList.add('active');
                if (connected) renderGallery(); // Only render if "connected"
                break;
            case 'analysis':
                analysisPage.style.display = 'flex';
                analysisBtn.classList.add('active');
                break;
        }
        currentPage = page;
    }

    // --- Server Connection Functions ---
    async function checkServerStatus() {
        try {
            const response = await fetch(`${SERVER_URL}/health`);
            const data = await response.json();
            return data.status === 'healthy';
        } catch (error) {
            return false;
        }
    }
    
    function updatePhoneStatus(isConnected) {
        connected = isConnected;
        if (isConnected) {
            // statusIndicator.innerHTML = '<i class="bi bi-hdd-stack text-success"></i><span>Server Connected</span>';
            // statusIndicator.classList.add('connected');
            galleryOverview.style.display = "flex";
            homeConnection.style.display = "none";
            galleryBtn.disabled = false;
            analysisBtn.disabled = false;

        } else {
            // statusIndicator.innerHTML = '<i class="bi bi-hdd-stack-fill text-danger"></i><span>Server Disconnected</span>';
            // statusIndicator.classList.remove('connected');
            // if (currentPage !== 'home') {
            //     switchPage('home');
            // }
            galleryOverview.style.display = "none";
            homeConnection.style.display = "flex";
            galleryBtn.disabled = true;
            analysisBtn.disabled = true;
        }
    }

    async function startServerMonitoring() {
    // On startup, just get the server status and store it. Don't change the UI.
    serverConnected = await checkServerStatus();

    // Set an interval to keep checking the server's real status
    serverCheckInterval = setInterval(async () => {
    serverConnected = await checkServerStatus();

    // ADDED FEATURE: If the server goes down *after* you've connected,
    // this will automatically disconnect the app for you.
    if (connected && !serverConnected) {
        console.log("Server connection lost. Forcing disconnect.");
        // Manually trigger the disconnect logic
        homeConnection.style.display = "flex";
        connectBtn.innerHTML = '<i class="bi bi-phone-fill me-2"></i>Connect to Server';
        connectBtn.classList.remove('btn-danger');
        connectBtn.classList.add('btn-primary');
        
        //Hide gallery overview
        galleryOverview.style.display = "none";

        updatePhoneStatus(false);
    }
  }, 5000);
}

    // --- Gallery Functions ---
    async function loadServerImages() {
        if (!serverConnected) return [];
        try {
            const response = await fetch(`${SERVER_URL}/images`);
            const data = await response.json();
            return data.success ? data.images : [];
        } catch (error) {
            console.error('Failed to load images:', error);
            return [];
        }
    }

    async function renderGallery() {
        if (!connected) {
            galleryGrid.innerHTML = '<p class="text-center text-muted">Please connect to the server on the Home page to view the gallery.</p>';
            return;
        }
        galleryGrid.innerHTML = '<p class="text-center text-muted">Loading images...</p>';
        
        // This line fetches the images
        serverImages = await loadServerImages(); 
        
        
        // Get the current sort value from the dropdown
        const sortValue = sortGallery.value;

        // Sort the serverImages array based on the value
        if (sortValue === 'name') {
            serverImages.sort((a, b) => a.filename.localeCompare(b.filename));
        } else if (sortValue === 'date') {
            // This assumes your server sends an 'uploaded_at' field (which it should)
            // It sorts from newest to oldest
            serverImages.sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at));
        } else if (sortValue === 'size') {
            // This sorts from smallest to largest
            serverImages.sort((a, b) => a.size - b.size);
        }   

        galleryGrid.innerHTML = ''; // Clear the "Loading..." text

        // This section now loops over the *sorted* serverImages array
        if (serverImages.length > 0) {
            serverImages.forEach(img => {
                const item = document.createElement('div');
                item.className = 'gallery-item';
                item.innerHTML = `
                    <img src="${SERVER_URL}/images/${img.path}" alt="${img.filename}">
                    <h6>${img.filename}</h6>
                    <small>${(img.size / 1024).toFixed(1)} KB</small>
                `;
                item.addEventListener('click', () => {
                    showImageDetailsModal(img);
                });
                galleryGrid.appendChild(item);
            });
        } else {
            galleryGrid.innerHTML = '<p class="text-center text-muted">No server images found.</p>';
        }
    }

    // --- SHOW IMAGE DETAILS MODAL ---
    function showImageDetailsModal(imageObject) {
        // Create the modal elements
        const modal = document.createElement('div');
        modal.className = 'image-detail-modal'; // This will be the overlay

        // Format details
        const imageUrl = `${SERVER_URL}/images/${imageObject.path}`;
        const fileSize = (imageObject.size / 1024).toFixed(1) + ' KB';
        // Check if uploaded_at exists, otherwise show 'Unknown'
        const uploadedDate = imageObject.uploaded_at 
            ? new Date(imageObject.uploaded_at).toLocaleString() 
            : 'Unknown';

        // Set the modal content
        modal.innerHTML = `
            <div class="modal-content">
                <span class="modal-close-btn">&times;</span>
                <div class="modal-body">
                    <div class="modal-image-container">
                        <img src="${imageUrl}" alt="${imageObject.filename}" class="modal-image">
                    </div>
                    <div class="modal-details">
                        <h4>Image Details</h4>
                        <p><strong>Filename:</strong> ${imageObject.filename}</p>
                        <p><strong>File Size:</strong> ${fileSize}</p>
                        <p><strong>Uploaded:</strong> ${uploadedDate}</p>
                        <p><strong>Path:</strong> ${imageObject.path}</p>
                    </div>
                </div>
            </div>
        `;

        // Add to the page
        document.body.appendChild(modal);

        // Add close functionality
        const closeBtn = modal.querySelector('.modal-close-btn');
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        // Add close on overlay click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) { // Only if clicking the overlay itself
                document.body.removeChild(modal);
            }
        });
    }

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

    // --- Event Listeners ---
    homeBtn.addEventListener('click', () => switchPage('home'));
    galleryBtn.addEventListener('click', () => switchPage('gallery'));
    analysisBtn.addEventListener('click', () => switchPage('analysis'));
    sortGallery.addEventListener('change', renderGallery);

    // Initialize analysis page when analysis page is shown
    const originalSwitchPage = switchPage;
    switchPage = function(page) {
        originalSwitchPage(page);
        if (page === 'analysis') {
            console.log('Switching to analysis page, initializing...');
            setTimeout(() => {
                try {
                    initializeAnalysisPage();
                    console.log('Analysis page initialized successfully');
                } catch (error) {
                    console.error('Error initializing analysis page:', error);
                }
            }, 100); // Small delay to ensure DOM is ready
        }
    };

        connectBtn.addEventListener('click', () => {
            if (!connected) {
                if (!serverConnected) {
                    alert('Cannot connect. The desktop server is not running. Please start the server first.');
                    return;
                }
                connectBtn.innerHTML = '<i class="bi bi-box-arrow-right me-2"></i>Disconnect';
                connectBtn.classList.remove('btn-primary');
                connectBtn.classList.add('btn-danger');

                galleryOverview.style.display = "flex";
                homeConnection.style.display = "none";
                updatePhoneStatus(true);
            }
        });

        disconnectBtn.addEventListener('click', () => {
            if (!connected) {
                if (!serverConnected) {
                    alert('Cannot connect. The desktop server is not running. Please start the server first.');
                    return;
                }
                connectBtn.innerHTML = '<i class="bi bi-box-arrow-right me-2"></i>Disconnect';
                connectBtn.classList.remove('btn-primary');
                connectBtn.classList.add('btn-danger');

                galleryOverview.style.display = "none";
                homeConnection.style.display = "flex";
                updatePhoneStatus(false);
            }
        });

        // --- File/Folder Selection Functions ---

        function createModal(title, body, buttons = []) {
            const modal = document.createElement('div');
            modal.className = 'server-images-modal';
            
            const buttonHTML = buttons.map(btn => 
                `<button class="btn ${btn.class}" id="${btn.id}" ${btn.disabled ? 'disabled' : ''}>${btn.text}</button>`
            ).join('');
            
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 400px;">
                    <div class="modal-header">
                        <h5>${title}</h5>
                        <button class="close-btn">&times;</button>
                    </div>
                    <div class="modal-body">${body}</div>
                    ${buttons.length ? `<div class="modal-footer">${buttonHTML}</div>` : ''}
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Add close functionality
            modal.querySelector('.close-btn').addEventListener('click', () => document.body.removeChild(modal));
            modal.addEventListener('click', (e) => {
                if (e.target === modal) document.body.removeChild(modal);
            });
            
            return modal;
        }

        // --- Image Management Functions ---
        
        disconnectBtn.addEventListener('click', () => {
            if (disconnectBtn.textContent.includes('Select Photo')) {
                showPhotoSelectionModal();
            } else {
                // Original disconnect functionality
                connectBtn.innerHTML = '<i class="bi bi-phone-fill me-2"></i>Connect to Server';
                connectBtn.classList.remove('btn-danger');
                connectBtn.classList.add('btn-primary');
                updatePhoneStatus(false);
            }
        });
        
        disconnectBtn.addEventListener('click', () => {
            if (disconnectBtn.textContent.includes('Select Photo')) {
                showPhotoSelectionModal();
            } else {
                // Original disconnect functionality
                connectBtn.innerHTML = '<i class="bi bi-phone-fill me-2"></i>Connect to Server';
                connectBtn.classList.remove('btn-danger');
                connectBtn.classList.add('btn-primary');
                updatePhoneStatus(false);
            }
        });
        startServerMonitoring();
    }
});