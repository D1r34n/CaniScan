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
        homeConnection.style.display = "block";
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

            homeConnection.style.display = "none";
            galleryOverview.style.display = "block";
            updatePhoneStatus(true);
        } else {
            connectBtn.innerHTML = '<i class="bi bi-phone-fill me-2"></i>Connect';
            connectBtn.classList.remove('btn-danger');
            connectBtn.classList.add('btn-primary');

            homeConnection.style.display = "block";
            galleryOverview.style.display = "none";
            updatePhoneStatus(false);
        }
    });

    startServerMonitoring();
  }
});