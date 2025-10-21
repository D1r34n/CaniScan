// This function ensures all HTML is loaded before any JavaScript runs, preventing crashes.
document.addEventListener('DOMContentLoaded', () => {
  // --- CODE FOR INDEX.HTML ---
  // This entire block will only run if it detects the home button on the page.
    const homeBtn = document.getElementById('homeBtn');
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

    // Other Page Elements
    const connectBtn = document.getElementById('connectPhoneButton');
    const disconnectBtn = document.getElementById('disconnectPhoneButton');
    const analysisVideo = document.getElementById('analysisVideo');
    const statusIndicator = document.querySelector('.phone-status .status-indicator');
    const galleryGrid = document.getElementById('galleryGrid');
    const createFolderBtn = document.getElementById('createFolderBtn');

let stream = null;
let connected = false;

connectBtn.addEventListener('click', async () => {
    if (!connected) {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            video.srcObject = stream;
            await video.play();

            video.style.display = "block";
            placeholder.style.display = 'none';

            connectBtn.innerHTML = '<i class="bi bi-phone-fill me-2"></i>Disconnect Phone Camera';
            connectBtn.classList.remove('btn-primary');
            connectBtn.classList.add('btn-danger');

            connected = true;
            analyzeBtn.disabled = !(connected && dogBreedSelect.value !== "Select Dog Breed");

        } catch (err) {
            console.error("Error accessing webcam:", err);
            alert("Could not access the camera.");
        }
    } else {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            video.srcObject = null;
        }

        video.style.display = "none";
        placeholder.style.display = 'block';

        connectBtn.innerHTML = '<i class="bi bi-phone-fill me-2"></i>Connect Phone';
        connectBtn.classList.remove('btn-danger');
        connectBtn.classList.add('btn-primary');
        
        //Hide gallery overview
        galleryOverview.style.display = "none";

        updatePhoneStatus(false);
    }
  }, 5000);

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
    
    // This is the restored function
    function createFolder(name) {
        const folder = { id: Date.now(), name: name, type: 'species', subfolders: [], images: [] };
        galleryFolders.push(folder);
        renderGallery();
    }

    // This is the restored function
    function showServerImages() {
        const modal = document.createElement('div');
        modal.className = 'server-images-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h5>Uploaded Images from Server</h5>
                    <button class="close-btn">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="images-grid">
                        ${serverImages.map(img => `
                            <div class="image-item">
                                <img src="${SERVER_URL}/images/${img.filename}" alt="${img.filename}">
                                <div class="image-info">
                                    <small>${img.filename}</small>
                                    <small>${(img.size / 1024).toFixed(1)} KB</small>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.querySelector('.close-btn').addEventListener('click', () => document.body.removeChild(modal));
        modal.addEventListener('click', (e) => {
            if (e.target === modal) document.body.removeChild(modal);
        });
    }

    async function renderGallery() {
        if (!connected) {
            galleryGrid.innerHTML = '<p class="text-center text-muted">Please connect to the server on the Home page to view the gallery.</p>';
            return;
        }
        galleryGrid.innerHTML = '<p class="text-center text-muted">Loading images...</p>';
        serverImages = await loadServerImages();
        galleryGrid.innerHTML = '';

        if (createFolderBtn) {
            const createBtn = document.createElement('div');
            createBtn.className = 'gallery-item';
            createBtn.innerHTML = `<i class="bi bi-folder-plus"></i><h6>Create New Folder</h6>`;
            createBtn.addEventListener('click', () => createFolderBtn.click());
            galleryGrid.appendChild(createBtn);
        }

        if (serverImages.length > 0) {
            const serverSection = document.createElement('div');
            serverSection.className = 'gallery-item server-images';
            serverSection.innerHTML = `
                <i class="bi bi-cloud-upload"></i>
                <h6>Uploaded Images</h6>
                <small class="text-muted">${serverImages.length} images</small>
            `;
            serverSection.addEventListener('click', () => showServerImages());
            galleryGrid.appendChild(serverSection);
        }
    }

    // --- Event Listeners ---
    homeBtn.addEventListener('click', () => switchPage('home'));
    galleryBtn.addEventListener('click', () => switchPage('gallery'));
    analysisBtn.addEventListener('click', () => switchPage('analysis'));

    createFolderBtn.addEventListener('click', () => {
        const folderName = prompt('Enter folder name:');
        if (folderName && folderName.trim()) {
            createFolder(folderName.trim());
        }
    });

        connectBtn.addEventListener('click', () => {
            if (!connected) {
                if (!serverConnected) {
                    alert('Cannot connect. The desktop server is not running. Please start the server first.');
                    return;
                }
                connectBtn.innerHTML = '<i class="bi bi-box-arrow-right me-2"></i>Disconnect';
                connectBtn.classList.remove('btn-primary');
                connectBtn.classList.add('btn-danger');
                updatePhoneStatus(true);
            } else {
                connectBtn.innerHTML = '<i class="bi bi-phone-fill me-2"></i>Connect to Server';
                connectBtn.classList.remove('btn-danger');
                connectBtn.classList.add('btn-primary');
                updatePhoneStatus(false);
            }
        });

        // --- File/Folder Selection Functions ---
        
        async function selectImageFolder() {
            try {
                // Check if we're in Electron environment
                if (typeof require !== 'undefined') {
                    const { ipcRenderer } = require('electron');
                    
                    // Send message to main process to open file dialog
                    const result = await ipcRenderer.invoke('select-image-folder');
                    
                    if (result && result.length > 0) {
                        const selectedPath = result[0];
                        console.log('Selected folder:', selectedPath);
                        
                        // Send the selected path to Flask backend
                        await processSelectedFolder(selectedPath);
                    } else {
                        console.log('No folder selected');
                    }
                } else {
                    // Fallback for web environment - use HTML5 file input
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.webkitdirectory = true;
                    input.multiple = true;
                    
                    input.onchange = async (e) => {
                        const files = Array.from(e.target.files);
                        if (files.length > 0) {
                            // Get the directory path from the first file
                            const firstFile = files[0];
                            const directoryPath = firstFile.webkitRelativePath.split('/')[0];
                            
                            console.log('Selected directory:', directoryPath);
                            console.log('Files:', files.map(f => f.name));
                            
                            // Process the selected files
                            await processSelectedFiles(files);
                        }
                    };
                    
                    input.click();
                }
            } catch (error) {
                console.error('Error selecting folder:', error);
                alert('Error opening folder selection dialog. Please try again.');
            }
        }

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
        
        function showLoadingModal(message) {
            return createModal('Processing...', `
                <div class="text-center">
                    <div class="spinner-border text-primary mb-3" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p>${message}</p>
                </div>
            `);
        }

        // --- Image Management Functions ---
        
        async function performImageAction(endpoint, data, successMessage) {
            try {
                const response = await fetch(`${SERVER_URL}/${endpoint}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                const result = await response.json();
                
                if (result.success) {
                    alert(successMessage);
                    renderGallery();
                } else {
                    alert(result.message || 'Operation failed.');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('An error occurred. Please try again.');
            }
        }

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
});