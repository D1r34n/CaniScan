// This function ensures all HTML is loaded before any JavaScript runs, preventing crashes.
document.addEventListener('DOMContentLoaded', () => {

    // --- CODE FOR AUTHENTICATION.HTML ---
    // This entire block will only run if it detects the login form on the page.
    const loginForm = document.getElementById("login-form");
    if (loginForm) {
        const { ipcRenderer } = require('electron');

        // Window Controls
        document.getElementById('minimize').addEventListener('click', () => {
            ipcRenderer.send('minimize-window');
        });
        document.getElementById('close').addEventListener('click', () => {
            ipcRenderer.send('close-window');
        });

        // --- authentication-related elements and functions ---
        const passwordInput = document.getElementById("password");
        const togglePassword = document.getElementById("togglePassword");
        const registerForm = document.getElementById("register-form");
        const errorBox = document.getElementById("error-box");
        let errorBoxTimeout = null;

        // Toggle password visibility
        togglePassword.addEventListener("click", () => {
            const isPassword = passwordInput.type === "password";
            passwordInput.type = isPassword ? "text" : "password";
            togglePassword.classList.toggle("bi-eye");
            togglePassword.classList.toggle("bi-eye-slash");
        });

        // Notification message
        function showMessage(message, type = "error") {
            if (errorBoxTimeout) clearTimeout(errorBoxTimeout);
            errorBox.textContent = message;
            errorBox.className = "alert"; // Reset classes
            errorBox.classList.add(type === "success" ? "alert-success" : "alert-danger", "show");

            errorBoxTimeout = setTimeout(() => {
                errorBox.classList.remove("show");
                errorBox.classList.add("hide");
            }, 5000);
        }

        // Helper function to disable/enable form
        function setFormLoading(form, isLoading) {
            const submitBtn = form.querySelector('button[type="submit"]');
            const inputs = form.querySelectorAll('input');
            
            if (isLoading) {
                submitBtn.disabled = true;
                submitBtn.dataset.originalText = submitBtn.textContent;
                submitBtn.textContent = "Loading...";
                inputs.forEach(input => input.disabled = true);
            } else {
                submitBtn.disabled = false;
                submitBtn.textContent = submitBtn.dataset.originalText || "Submit";
                inputs.forEach(input => input.disabled = false);
            }
        }

        // Fetch with timeout
        async function fetchWithTimeout(url, options = {}, timeout = 5000) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);
            try {
                const response = await fetch(url, { ...options, signal: controller.signal });
                clearTimeout(timeoutId);
                return response;
            } catch (error) {
                clearTimeout(timeoutId);
                if (error.name === 'AbortError') {
                    throw new Error('Request timeout - server took too long to respond');
                }
                throw error;
            }
        }

        // LOGIN FORM
        loginForm.addEventListener("submit", async (e) => {
          e.preventDefault();
        
          const email = document.getElementById("username").value.trim();
          const password = document.getElementById("password").value.trim();
        
          if (!email || !password) {
            showMessage("Please fill in both fields.", "error");
            return;
          }
        
          setFormLoading(loginForm, true);
        
          try {
            const res = await fetchWithTimeout("http://127.0.0.1:5000/login", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email, password }),
            });
        
            const data = await res.json();
        
            if (res.ok && data.success) {
              // Store token if provided
              if (data.token) {
                // In Electron, you might want to use a secure storage method
                sessionStorage.setItem('authToken', data.token);
              }
              
              ipcRenderer.send("login-success", data);
            } else {
              showMessage(data.message || "Invalid email or password.", "error");
            }
          } catch (err) {
            if (err.message.includes('timeout')) {
              showMessage("⚠️ Server timeout - please try again.", "error");
            } else {
              showMessage("⚠️ Could not connect to the server.", "error");
            }
          } finally {
            setFormLoading(loginForm, false);
          }
        });

        // REGISTER FORM
        registerForm.addEventListener("submit", async (e) => {
          e.preventDefault();

        const firstName = document.getElementById("first-name").value.trim();
        const lastName = document.getElementById("last-name").value.trim();
        const email = document.getElementById("reg-email").value.trim();
        const password = document.getElementById("reg-password").value.trim();
        const confirmPassword = document.getElementById("reg-confirm").value.trim();

        // Basic validation
        if (!firstName || !lastName || !email || !password || !confirmPassword) {
          showMessage("Please fill in all fields.", "error");
          return;
        }

        // Email format validation
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(email)) {
          showMessage("Please enter a valid email address.", "error");
          return;
        }

        // Password strength validation
        const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
        if (!passwordPattern.test(password)) {
          showMessage(
            "Password must be at least 8 characters, include uppercase, lowercase, and a number.",
            "error"
        );
        return;
      }

      if (password !== confirmPassword) {
        showMessage("Passwords do not match.", "error");
      return;
      }

      setFormLoading(registerForm, true);

    try {
    const res = await fetchWithTimeout("http://127.0.0.1:5000/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName, lastName, email, password }),
    });

    const data = await res.json();

    if (res.ok && data.success) {
      showMessage("Registration successful! You can now login.", "success");
      
      // Reset form and switch to login
      registerForm.reset();
      
      setTimeout(() => {
        document.getElementById("to-login").click();
      }, 1500);
    } else {
      showMessage(data.message || "Registration failed.", "error");
    }
  } catch (err) {
    if (err.message.includes('timeout')) {
      showMessage("⚠️ Server timeout - please try again.", "error");
    } else {
      showMessage("⚠️ Could not connect to the server.", "error");
    }
  } finally {
    setFormLoading(registerForm, false);
  }
});

// SWITCH FORMS
  const formTitle = document.getElementById("form-title");
  const toRegister = document.getElementById("to-register");
  const toLogin = document.getElementById("to-login");

  function animateSwitch(hideEl, showEl, newTitle, direction) {
    // Clear any existing error box timeout
    if (errorBoxTimeout) {
      clearTimeout(errorBoxTimeout);
      errorBoxTimeout = null;
    }

    // Check if error box is visible
    const isErrorVisible = errorBox.classList.contains("show");
    
    const performSwitch = () => {
      // Continue with the existing switch animation
      const outAnim = direction === "right" ? "slideOutLeft" : "slideOutRight";
      const inAnim = direction === "right" ? "slideInRight" : "slideInLeft";

      hideEl.style.animation = `${outAnim} 0.4s forwards`;

      // Fade title out
      formTitle.style.opacity = "0";
      formTitle.style.transform = "translateY(-10px)";
      formTitle.style.transition = "opacity 0.3s ease, transform 0.3s ease";

      setTimeout(() => {
        hideEl.style.display = "none";
        showEl.style.display = "block";
        showEl.style.animation = `${inAnim} 0.4s forwards`;

        setTimeout(() => {
          formTitle.textContent = newTitle;
          formTitle.style.opacity = "1";
          formTitle.style.transform = "none";
          formTitle.style.animation = `bounceIn 0.6s ease`;
        }, 150);
      }, 350);
    };

    // If error box is visible, wait for it to fade out first
    if (isErrorVisible) {
      errorBox.classList.remove("show");
      errorBox.classList.add("hide");
      
      // Wait for fade out animation (400ms) then perform switch
      setTimeout(() => {
        errorBox.textContent = "";
        performSwitch();
      }, 400);
    } else {
      // No error box visible, switch immediately
      performSwitch();
    }
  }

  // Switch to Register
  toRegister.addEventListener("click", (e) => {
    e.preventDefault();
    animateSwitch(loginForm, registerForm, "Register", "right");
  });

  // Switch to Login
  toLogin.addEventListener("click", (e) => {
    e.preventDefault();
    animateSwitch(registerForm, loginForm, "Login", "left");
  });
        
    } // End of authentication.html logic


    // --- CODE FOR INDEX.HTML ---
    // This entire block will only run if it detects the home button on the page.
    const homeBtn = document.getElementById('homeBtn');
    if (homeBtn) {
        
        // Navigation Elements
        const galleryBtn = document.getElementById('galleryBtn');
        const analysisBtn = document.getElementById('analysisBtn');
        const homePage = document.getElementById('homePage');
        const galleryPage = document.getElementById('galleryPage');
        const analysisPage = document.getElementById('analysisPage');

        // Other Page Elements
        const connectBtn = document.getElementById('connectPhoneButton');
        const disconnectBtn = document.getElementById('disconnectPhoneButton');
        const analysisVideo = document.getElementById('analysisVideo');
        const statusIndicator = document.querySelector('.phone-status .status-indicator');
        const galleryGrid = document.getElementById('galleryGrid');
        const backToGalleryBtn = document.getElementById('backToGalleryBtn');
        const galleryTitle = document.getElementById('galleryTitle');

        // Server Configuration
        const SERVER_URL = 'http://localhost:5001';
        let stream = null;
        let connected = false; // This is the user-facing "connected" state
        let serverConnected = false; // This is the actual server health
        let currentPage = 'home';
        let serverCheckInterval = null;
        let analyzing = false;
        
        // Gallery Navigation State
        let currentGalleryPath = [];
        let selectedImage = null;
        let photoSelectionMode = false;
        
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
                    homePage.style.display = 'block';
                    homeBtn.classList.add('active');
                    break;
                case 'gallery':
                    galleryPage.style.display = 'block';
                    galleryBtn.classList.add('active');
                    if (connected) renderGallery(); // Only render if "connected"
                    break;
                case 'analysis':
                    analysisPage.style.display = 'block';
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
                statusIndicator.innerHTML = '<i class="bi bi-hdd-stack text-success"></i><span>Server Connected</span>';
                statusIndicator.classList.add('connected');
            } else {
                statusIndicator.innerHTML = '<i class="bi bi-hdd-stack-fill text-danger"></i><span>Server Disconnected</span>';
                statusIndicator.classList.remove('connected');
                if (currentPage !== 'home') {
                    switchPage('home');
                }
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
            connectBtn.innerHTML = '<i class="bi bi-phone-fill me-2"></i>Connect to Server';
            connectBtn.classList.remove('btn-danger');
            connectBtn.classList.add('btn-primary');
            updatePhoneStatus(false);
        }
      }, 5000);
    }

        // --- Gallery Functions ---
        async function loadServerImages(path = '') {
            if (!serverConnected) return { images: [], folders: [] };
            try {
                const url = path ? `${SERVER_URL}/images?path=${encodeURIComponent(path)}` : `${SERVER_URL}/images`;
                const response = await fetch(url);
                const data = await response.json();
                return data.success ? { images: data.images, folders: data.folders, currentPath: data.current_path } : { images: [], folders: [] };
            } catch (error) {
                console.error('Failed to load images:', error);
                return { images: [], folders: [] };
            }
        }
        
        async function createFolder(name) {
            try {
                const response = await fetch(`${SERVER_URL}/folders`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        name: name,
                        path: currentGalleryPath.join('/')
                    })
                });
                
                const data = await response.json();
                if (data.success) {
                    renderGallery();
                    return true;
                } else {
                    alert(data.message || 'Failed to create folder');
                    return false;
                }
            } catch (error) {
                console.error('Failed to create folder:', error);
                alert('Failed to create folder. Please try again.');
                return false;
            }
        }


        function navigateToFolder(folderName) {
            currentGalleryPath.push(folderName);
            renderGallery();
        }

        function navigateBack() {
            if (currentGalleryPath.length > 0) {
                currentGalleryPath.pop();
                renderGallery();
            }
        }

        function renderBreadcrumb() {
            const breadcrumbContainer = document.createElement('div');
            breadcrumbContainer.className = 'gallery-breadcrumb';
            
            let breadcrumbHTML = '<span class="gallery-breadcrumb-item" data-path="[]">Gallery</span>';
            
            if (currentGalleryPath.length > 0) {
                let currentPath = [];
                for (let i = 0; i < currentGalleryPath.length; i++) {
                    currentPath.push(currentGalleryPath[i]);
                    breadcrumbHTML += `<span class="gallery-breadcrumb-separator">></span>`;
                    breadcrumbHTML += `<span class="gallery-breadcrumb-item" data-path='${JSON.stringify(currentPath)}'>${currentGalleryPath[i]}</span>`;
                }
            }
            
            breadcrumbContainer.innerHTML = breadcrumbHTML;
            
            // Add click handlers for breadcrumb navigation
            breadcrumbContainer.querySelectorAll('.gallery-breadcrumb-item').forEach(item => {
                item.addEventListener('click', () => {
                    const path = JSON.parse(item.dataset.path);
                    currentGalleryPath = path;
                    renderGallery();
                });
            });
            
            return breadcrumbContainer;
        }

        async function renderGallery() {
            if (!connected) {
                galleryGrid.innerHTML = '<p class="text-center text-muted">Please connect to the server on the Home page to view the gallery.</p>';
                return;
            }

            // Clear existing content and remove any existing breadcrumb
            galleryGrid.innerHTML = '';
            const existingBreadcrumb = galleryGrid.parentNode.querySelector('.gallery-breadcrumb');
            if (existingBreadcrumb) {
                existingBreadcrumb.remove();
            }

            // Add breadcrumb navigation
            const breadcrumb = renderBreadcrumb();
            galleryGrid.parentNode.insertBefore(breadcrumb, galleryGrid);

            // Show loading state
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'text-center text-muted';
            loadingDiv.innerHTML = '<p>Loading images...</p>';
            galleryGrid.appendChild(loadingDiv);

            // Load server data
            const currentPath = currentGalleryPath.join('/');
            const serverData = await loadServerImages(currentPath);
            const { images, folders } = serverData;

            // Clear loading state
            galleryGrid.innerHTML = '';

            // Show back button if not in root
            if (currentGalleryPath.length > 0) {
                backToGalleryBtn.style.display = 'inline-block';
                galleryTitle.textContent = currentGalleryPath[currentGalleryPath.length - 1];
            } else {
                backToGalleryBtn.style.display = 'none';
                galleryTitle.textContent = 'Gallery';
            }

            // Add select image folder button
            const selectBtn = document.createElement('div');
            selectBtn.className = 'folder-item';
            selectBtn.innerHTML = `
                <i class="bi bi-folder2-open"></i>
                <h6>Select Image Folder</h6>
            `;
            selectBtn.addEventListener('click', () => {
                selectImageFolder();
            });
            galleryGrid.appendChild(selectBtn);

            // Add create folder button
            const createBtn = document.createElement('div');
            createBtn.className = 'folder-item';
            createBtn.innerHTML = `
                <i class="bi bi-folder-plus"></i>
                <h6>Create New Folder</h6>
            `;
            createBtn.addEventListener('click', async () => {
                const folderName = prompt('Enter folder name:');
                if (folderName && folderName.trim()) {
                    await createFolder(folderName.trim());
                }
            });
            galleryGrid.appendChild(createBtn);

            // Add folders
            folders.forEach(folder => {
                const folderDiv = document.createElement('div');
                folderDiv.className = 'folder-item';
                folderDiv.innerHTML = `
                    <i class="bi bi-folder-fill"></i>
                    <h6>${folder.name}</h6>
                    <div class="folder-count">${folder.item_count} items</div>
                `;
                folderDiv.addEventListener('click', () => navigateToFolder(folder.name));
                galleryGrid.appendChild(folderDiv);
            });

            // Add images
            images.forEach(image => {
                const imageDiv = document.createElement('div');
                imageDiv.className = 'gallery-image-item';
                imageDiv.innerHTML = `
                    <img src="${SERVER_URL}/images/${image.path}" alt="${image.filename}" loading="lazy">
                    <div class="gallery-image-info">
                        <small>${image.filename}</small>
                        <small>${(image.size / 1024).toFixed(1)} KB</small>
                        <button class="btn btn-sm btn-danger mt-2" onclick="deleteImage('${image.path}')">
                            <i class="bi bi-trash"></i> Delete
                        </button>
                    </div>
                `;
                
                // Add click listener to the image itself (for selection or viewing)
                const imgElement = imageDiv.querySelector('img');
                if (photoSelectionMode) {
                    imgElement.addEventListener('click', () => selectImageForAnalysis(image));
                } else {
                    imgElement.addEventListener('click', () => viewImage(image));
                }
                
                galleryGrid.appendChild(imageDiv);

            });

            // If no content, show message
            if (galleryGrid.children.length === 0) {
                galleryGrid.innerHTML = '<p class="text-center text-muted">No items in this folder.</p>';
            }

            
        }


        function viewImage(image) {
            // Simple image viewer - could be enhanced with a modal
            const modal = document.createElement('div');
            modal.className = 'server-images-modal';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 80%; max-height: 80%;">
                    <div class="modal-header">
                        <h5>${image.filename}</h5>
                        <button class="close-btn">&times;</button>
                    </div>
                    <div class="modal-body text-center">
                        <img src="${SERVER_URL}/images/${image.path}" alt="${image.filename}" style="max-width: 100%; max-height: 60vh; object-fit: contain;">
                        <div class="mt-3">
                            <small class="text-muted">Size: ${(image.size / 1024).toFixed(1)} KB</small>
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

        function selectImageForAnalysis(image) {
            selectedImage = image;
            
            // Update analysis video container to show selected image
            const videoContainer = document.querySelector('.analysis-video-container');
            videoContainer.innerHTML = `
                <img src="${SERVER_URL}/images/${image.path}" alt="${image.filename}" style="width: 100%; height: 300px; object-fit: cover; border-radius: 15px;">
            `;
            
            // Close photo selection mode
            exitPhotoSelectionMode();
            
            // Switch to analysis page
            switchPage('analysis');
            
            // Update button text
            disconnectBtn.innerHTML = '<i class="bi bi-image me-2"></i>Select Photo';
        }

        function showPhotoSelectionModal() {
            const modal = document.createElement('div');
            modal.className = 'photo-selection-modal';
            modal.innerHTML = `
                <div class="photo-selection-content">
                    <div class="photo-selection-header">
                        <h5>Select Photo for Analysis</h5>
                        <button class="close-btn">&times;</button>
                    </div>
                    <div class="photo-selection-body">
                        <div class="photo-selection-grid" id="photoSelectionGrid">
                            <!-- Photos will be loaded here -->
                        </div>
                    </div>
                    <div class="photo-selection-footer">
                        <button class="btn btn-secondary" id="cancelSelection">Cancel</button>
                        <button class="btn btn-primary" id="confirmSelection" disabled>Select Photo</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Load photos in the modal
            loadPhotosInModal();
            
            // Event listeners
            modal.querySelector('.close-btn').addEventListener('click', () => {
                document.body.removeChild(modal);
            });
            
            modal.querySelector('#cancelSelection').addEventListener('click', () => {
                document.body.removeChild(modal);
            });
            
            modal.querySelector('#confirmSelection').addEventListener('click', () => {
                if (selectedImage) {
                    selectImageForAnalysis(selectedImage);
                    document.body.removeChild(modal);
                }
            });
            
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    document.body.removeChild(modal);
                }
            });
        }

        async function loadPhotosInModal() {
            const grid = document.getElementById('photoSelectionGrid');
            if (!grid) return;
            
            grid.innerHTML = '<p class="text-center text-muted">Loading photos...</p>';
            
            try {
                const serverData = await loadServerImages();
                const images = serverData.images;
                
                if (images.length === 0) {
                    grid.innerHTML = '<p class="text-center text-muted">No photos available. Please upload some images first.</p>';
                    return;
                }
                
                grid.innerHTML = '';
                
                images.forEach(image => {
                    const imageDiv = document.createElement('div');
                    imageDiv.className = 'photo-selection-item';
                    imageDiv.innerHTML = `
                        <img src="${SERVER_URL}/images/${image.path}" alt="${image.filename}">
                        <div class="photo-selection-info">
                            <small>${image.filename}</small>
                            <small>${(image.size / 1024).toFixed(1)} KB</small>
                        </div>
                    `;
                    
                    imageDiv.addEventListener('click', () => {
                        // Remove previous selection
                        document.querySelectorAll('.photo-selection-item').forEach(item => {
                            item.classList.remove('selected');
                        });
                        
                        // Select current image
                        imageDiv.classList.add('selected');
                        selectedImage = image;
                        
                        // Enable confirm button
                        document.getElementById('confirmSelection').disabled = false;
                    });
                    
                    grid.appendChild(imageDiv);
                });
            } catch (error) {
                console.error('Failed to load photos:', error);
                grid.innerHTML = '<p class="text-center text-danger">Failed to load photos. Please try again.</p>';
            }
        }

        function enterPhotoSelectionMode() {
            photoSelectionMode = true;
            galleryPage.classList.add('gallery-selection-mode');
            renderGallery();
        }

        function exitPhotoSelectionMode() {
            photoSelectionMode = false;
            galleryPage.classList.remove('gallery-selection-mode');
            renderGallery();
        }

        // --- Event Listeners ---
        homeBtn.addEventListener('click', () => switchPage('home'));
        galleryBtn.addEventListener('click', () => switchPage('gallery'));
        analysisBtn.addEventListener('click', () => switchPage('analysis'));

        backToGalleryBtn.addEventListener('click', () => {
            navigateBack();
        });

        // Add delete image functionality
        window.deleteImage = async function(imagePath) {
            if (confirm(`Are you sure you want to delete this image?`)) {
                try {
                    const response = await fetch(`${SERVER_URL}/images/${encodeURIComponent(imagePath)}`, {
                        method: 'DELETE'
                    });
                    
                    if (response.ok) {
                        // Re-render gallery
                        renderGallery();
                        alert('Image deleted successfully!');
                    } else {
                        alert('Failed to delete image. Please try again.');
                    }
                } catch (error) {
                    console.error('Error deleting image:', error);
                    alert('Error deleting image. Please try again.');
                }
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

        async function processSelectedFolder(folderPath) {
            try {
                // Show loading state
                const loadingModal = showLoadingModal('Processing selected folder...');
                
                // Send folder path to Flask backend
                const response = await fetch(`${SERVER_URL}/process-folder`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        folderPath: folderPath
                    })
                });
                
                const data = await response.json();
                
                // Remove loading modal
                document.body.removeChild(loadingModal);
                
                if (data.success) {
                    alert(`Successfully processed folder!\n\nProcessed ${data.processedCount} images.\nResults saved to: ${data.outputPath}`);
                    
                    // Refresh gallery to show any new images
                    renderGallery();
                    
                    // Optionally open the output folder
                    if (typeof require !== 'undefined') {
                        const { ipcRenderer } = require('electron');
                        ipcRenderer.invoke('open-folder', data.outputPath);
                    }
                } else {
                    alert(data.message || 'Failed to process folder. Please try again.');
                }
            } catch (error) {
                console.error('Error processing folder:', error);
                alert('Error processing folder. Please try again.');
            }
        }

        async function processSelectedFiles(files) {
            try {
                // Show loading state
                const loadingModal = showLoadingModal('Processing selected files...');
                
                // Filter for image files
                const imageFiles = files.filter(file => {
                    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/webp'];
                    return allowedTypes.includes(file.type) || /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(file.name);
                });
                
                if (imageFiles.length === 0) {
                    document.body.removeChild(loadingModal);
                    alert('No valid image files found in the selected folder.');
                    return;
                }
                
                // Process each image file
                const formData = new FormData();
                imageFiles.forEach((file, index) => {
                    formData.append(`images`, file);
                });
                
                const response = await fetch(`${SERVER_URL}/process-images`, {
                    method: 'POST',
                    body: formData
                });
                
                const data = await response.json();
                
                // Remove loading modal
                document.body.removeChild(loadingModal);
                
                if (data.success) {
                    alert(`Successfully processed ${data.processedCount} images!\n\nResults saved to: ${data.outputPath}`);
                    
                    // Refresh gallery to show any new images
                    renderGallery();
                } else {
                    alert(data.message || 'Failed to process images. Please try again.');
                }
            } catch (error) {
                console.error('Error processing files:', error);
                alert('Error processing files. Please try again.');
            }
        }

        function showLoadingModal(message) {
            const modal = document.createElement('div');
            modal.className = 'server-images-modal';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 400px;">
                    <div class="modal-header">
                        <h5>Processing...</h5>
                    </div>
                    <div class="modal-body text-center">
                        <div class="spinner-border text-primary mb-3" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <p>${message}</p>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            return modal;
        }

        // --- New Rename and Move Functions ---

        async function renameImage(imagePath, newFilename) {
            try {
                const response = await fetch(`${SERVER_URL}/rename-image`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        currentPath: imagePath,
                        newFilename: newFilename
                    })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    alert('File renamed successfully!');
                    renderGallery(); // Refresh the gallery
                } else {
                    alert(data.message || 'Failed to rename file.');
                }
            } catch (error) {
                console.error('Error renaming file:', error);
                alert('An error occurred. Please try again.');
            }
        }

        async function moveImage(imagePath, newFolderPath) {
             try {
                const response = await fetch(`${SERVER_URL}/move-image`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        currentPath: imagePath,
                        newFolderPath: newFolderPath
                    })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    alert('File moved successfully!');
                    renderGallery(); // Refresh the gallery
                } else {
                    alert(data.message || 'Failed to move file.');
                }
            } catch (error) {
                console.error('Error moving file:', error);
                alert('An error occurred. Please try again.');
            }
        }

        // Functions to be called from onclick attributes
        // We attach them to 'window' so they are globally accessible
        
        window.showRenamePrompt = async (imagePath, currentFilename) => {
            const newFilename = prompt("Enter new filename:", currentFilename);
            
            if (newFilename && newFilename.trim() && newFilename !== currentFilename) {
                // Basic validation
                if (!newFilename.includes('.')) {
                    alert('Invalid filename. Please include a file extension (e.g., .jpg).');
                    return;
                }
                if (newFilename.includes('/') || newFilename.includes('\\')) {
                    alert('Invalid filename. Cannot include slashes.');
                    return;
                }
                await renameImage(imagePath, newFilename.trim());
            }
        };

        window.showMoveModal = async (imagePath) => {
            // Fetch all folders from the root
            const serverData = await loadServerImages('');
            const allFolders = serverData.folders;

            // Create Modal
            const modal = document.createElement('div');
            modal.className = 'server-images-modal'; // Reuse existing modal style
            
            let folderOptionsHTML = '<option value="">(Root Gallery)</option>';
            allFolders.forEach(folder => {
                folderOptionsHTML += `<option value="${folder.path}">${folder.name}</option>`;
            });

            modal.innerHTML = `
                <div class="modal-content" style="max-width: 400px;">
                    <div class="modal-header">
                        <h5>Move Image</h5>
                        <button class="close-btn">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p>Select a folder to move this image to:</p>
                        <select id="folderMoveSelect" class="form-select">
                            ${folderOptionsHTML}
                        </select>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" id="cancelMoveBtn">Cancel</button>
                        <button class="btn btn-primary" id="confirmMoveBtn">Move</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Add event listeners
            modal.querySelector('.close-btn').addEventListener('click', () => document.body.removeChild(modal));
            modal.querySelector('#cancelMoveBtn').addEventListener('click', () => document.body.removeChild(modal));
            modal.querySelector('#confirmMoveBtn').addEventListener('click', () => {
                const selectedFolder = document.getElementById('folderMoveSelect').value;
                moveImage(imagePath, selectedFolder);
                document.body.removeChild(modal);
            });
            modal.addEventListener('click', (e) => {
                if (e.target === modal) document.body.removeChild(modal);
            });
        };

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