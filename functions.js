// Window Controls
const { ipcRenderer } = require('electron');

document.getElementById('minimize').addEventListener('click', () => {
  ipcRenderer.send('minimize-window');
});

document.getElementById('close').addEventListener('click', () => {
  ipcRenderer.send('close-window');
});

// Account Login Password Show
const passwordInput = document.getElementById("password");
const togglePassword = document.getElementById("togglePassword");
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const errorBox = document.getElementById("error-box");

// Track error box timeout to prevent conflicts
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
  // Clear any existing timeout
  if (errorBoxTimeout) {
    clearTimeout(errorBoxTimeout);
    errorBoxTimeout = null;
  }

  errorBox.textContent = message;

  // Update class for type
  errorBox.classList.remove("alert-success", "alert-danger");
  errorBox.classList.add(type === "success" ? "alert-success" : "alert-danger");

  // Show message
  errorBox.classList.remove("hide");
  errorBox.classList.add("show");

  // Fade out after 5 seconds
  errorBoxTimeout = setTimeout(() => {
    errorBox.classList.remove("show");
    errorBox.classList.add("hide");

    // Clear text after fade completes
    setTimeout(() => {
      errorBox.textContent = "";
      errorBoxTimeout = null;
    }, 400);
  }, 5000);
}

// Helper function to disable/enable form during submission
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
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
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
document.addEventListener("DOMContentLoaded", () => {
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
});

// Fetch dog breeds dataset
fetch('fci-breeds.csv')
  .then(response => response.text())
  .then(data => {
    const lines = data.split('\n').slice(1);
    const select = document.getElementById('dogBreed');
    lines.forEach(line => {
      if(line.trim() !== "") {
        const columns = line.split(',');
        const breedName = columns[1].trim();
        const option = document.createElement('option');
        option.textContent = breedName;
        option.value = breedName;
        select.appendChild(option);
      }
    });
  })
.catch(err => console.error('Error loading CSV:', err));

// Navigation elements
const homeBtn = document.getElementById('homeBtn');
const galleryBtn = document.getElementById('galleryBtn');
const analysisBtn = document.getElementById('analysisBtn');
const homePage = document.getElementById('homePage');
const galleryPage = document.getElementById('galleryPage');
const analysisPage = document.getElementById('analysisPage');

// Phone connection elements
const connectBtn = document.getElementById('connectPhoneButton');
const disconnectBtn = document.getElementById('disconnectPhoneButton');
const video = document.getElementById('phoneVideo');
const placeholder = document.querySelector('.connectPhoneNote');
const analyzeBtn = document.getElementById('analyzeButton');
const analysisVideo = document.getElementById('analysisVideo');

// Status indicators
const phoneStatus = document.getElementById('phoneStatus');
const statusIndicator = document.querySelector('.status-indicator');
const serverStatus = document.getElementById('serverStatus');
const serverStatusText = document.getElementById('serverStatusText');

// Gallery elements
const createFolderBtn = document.getElementById('createFolderBtn');
const galleryGrid = document.getElementById('galleryGrid');

// Server configuration
const SERVER_URL = 'http://localhost:5000';
let stream = null;
let connected = false;
let serverConnected = false;
let currentPage = 'home';
let serverCheckInterval = null;

// Server connection functions
async function checkServerStatus() {
  try {
    const response = await fetch(`${SERVER_URL}/health`);
    const data = await response.json();
    return data.status === 'healthy';
  } catch (error) {
    console.error('Server check failed:', error);
    return false;
  }
}

async function loadServerImages() {
  try {
    const response = await fetch(`${SERVER_URL}/images`);
    const data = await response.json();
    return data.success ? data.images : [];
  } catch (error) {
    console.error('Failed to load images:', error);
    return [];
  }
}


function updateServerStatus(isConnected) {
  serverConnected = isConnected;
  
  if (isConnected) {
    serverStatusText.textContent = 'Desktop server connected';
    serverStatus.className = 'mt-3 text-center connected';
    serverStatusText.innerHTML = '<i class="bi bi-check-circle me-1"></i>Desktop server connected';
  } else {
    serverStatusText.textContent = 'Desktop server disconnected';
    serverStatus.className = 'mt-3 text-center disconnected';
    serverStatusText.innerHTML = '<i class="bi bi-x-circle me-1"></i>Desktop server disconnected';
  }
}

// Start server monitoring
async function startServerMonitoring() {
  const isConnected = await checkServerStatus();
  updateServerStatus(isConnected);
  
  // Check server status every 5 seconds
  serverCheckInterval = setInterval(async () => {
    const isConnected = await checkServerStatus();
    updateServerStatus(isConnected);
    
    // If server is connected and we have images, refresh gallery
    if (isConnected && currentPage === 'gallery') {
      await renderGallery();
    }
  }, 5000);
}

// Navigation functionality
function switchPage(page) {
  // Hide all pages first
  homePage.style.display = 'none';
  galleryPage.style.display = 'none';
  analysisPage.style.display = 'none';
  
  // Remove the 'active' class from all navigation buttons
  homeBtn.classList.remove('active');
  galleryBtn.classList.remove('active');
  analysisBtn.classList.remove('active');
  
  // Show the selected page and set its button to 'active'
  switch(page) {
    case 'home':
      homePage.style.display = 'block';
      homeBtn.classList.add('active');
      break;
    case 'gallery':
      galleryPage.style.display = 'block';
      galleryBtn.classList.add('active');
      break;
    case 'analysis':
      analysisPage.style.display = 'block';
      analysisBtn.classList.add('active');
      break;
  }
  
  currentPage = page;
}

// Navigation event listeners
homeBtn.addEventListener('click', () => switchPage('home'));

galleryBtn.addEventListener('click', () => {
  /*if (connected && serverConnected) {
    switchPage('gallery');
  } else {
    const issues = [];
    if (!connected) issues.push('device');
    if (!serverConnected) issues.push('desktop server');
    alert(`Please connect your ${issues.join(' and ')} first to access the gallery.`);
  }*/ 
  switchPage('galleryPage');
});

analysisBtn.addEventListener('click', () => {
  /*if (connected && serverConnected) {
    switchPage('analysis');
  } else {
    const issues = [];
    if (!connected) issues.push('device');
    if (!serverConnected) issues.push('desktop server');
    alert(`Please connect your ${issues.join(' and ')} first to access analysis.`);
  }*/
  switchPage('analysisPage');
});

// Update phone connection status
function updatePhoneStatus(isConnected) {
  connected = isConnected;
  
  if (isConnected) {
    statusIndicator.innerHTML = '<i class="bi bi-phone text-success"></i><span>Device Connected</span>';
    statusIndicator.classList.add('connected');
    
    // Enable navigation buttons only if server is also connected
    if (serverConnected) {
      galleryBtn.disabled = false; 
      analysisBtn.disabled = false; 
    }
  } else {
    statusIndicator.innerHTML = '<i class="bi bi-phone-x text-danger"></i><span>Device Disconnected</span>';
    statusIndicator.classList.remove('connected');
    
    // Disable navigation buttons
    galleryBtn.disabled = true;
    analysisBtn.disabled = true;
    
    // Switch back to home page if on other pages
    if (currentPage !== 'home') {
      switchPage('home');
    }
  }
} 

// Update navigation button states based on both device and server connection
/*function updateNavigationButtons() {
  const canNavigate = connected && serverConnected;
  galleryBtn.disabled = !canNavigate;
  analysisBtn.disabled = !canNavigate; 
}*/

connectBtn.addEventListener('click', () => {
    if (!connected) { // If we are currently disconnected...
        
        // First, check if the server is actually running.
        // The 'serverConnected' variable is already kept up-to-date by your app.
        if (!serverConnected) {
            alert('Cannot connect. The desktop server is not running. Please start the server first.');
            return; // Stop here if the server is offline
        }

        // If the server is online, proceed to "connect"
        console.log("Server connection confirmed. Unlocking features.");

        // Update the button to show a "Disconnect" state
        connectBtn.innerHTML = '<i class="bi bi-box-arrow-right me-2"></i>Disconnect';
        connectBtn.classList.remove('btn-primary');
        connectBtn.classList.add('btn-danger');

        // Update the UI to show a connected status and enable other buttons
        updatePhoneStatus(true); // This will update the "Device Connected/Disconnected" text
        updateNavigationButtons(); // This will enable the Gallery and Analysis buttons

    } else { // If we are currently connected and want to disconnect...
        
        console.log("Disconnecting and locking features.");

        // Revert the button to its original "Connect" state
        connectBtn.innerHTML = '<i class="bi bi-phone-fill me-2"></i>Connect to Server';
        connectBtn.classList.remove('btn-danger');
        connectBtn.classList.add('btn-primary');

        // Update the UI to show a disconnected status and disable features
        updatePhoneStatus(false);
        updateNavigationButtons();
    }
});

disconnectBtn.addEventListener('click', () => {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        video.srcObject = null;
    }

    // Switch back to home page
    switchPage('home');

    // Disconnect video
    video.style.display = "none";
    placeholder.style.display = 'block';

    // Reset phone button
    connectBtn.innerHTML = '<i class="bi bi-phone-fill me-2"></i>Connect Device';
    connectBtn.classList.remove('btn-danger');
    connectBtn.classList.add('btn-primary');

    updatePhoneStatus(false);
    updateNavigationButtons();
    analyzing = false;
});

analyzing = false;
// ✅ ANALYZE BUTTON - SWITCHES TO ANALYSIS PAGE
// analyzeBtn.addEventListener('click', () => {
//     // Change navbar
//     navbar.style.backgroundColor = "#00bf63";
//     navbarTitle.innerHTML = '<i class="bi bi-check-circle-fill me-2"></i>AI Analysis Results';
//     navbarSubtitle.textContent = "";

//     // Hide capture page, show analysis page
//     capturePage.style.display = "none";
//     analysisPage.style.display = "flex";

//     // Transfer video stream to analysis page
//     if (stream) {
//         analysisVideo.srcObject = stream;
//         analysisVideo.play();
//         analysisVideo.style.display = "block";
//     }
// });

//PYTHON WITH FLASK

analyzeBtn.addEventListener('click', async () => {
  if (analyzing) return; // prevent overlap
  analyzing = true;

  // Switch to analysis page
  switchPage('analysis');

  if (stream) {
    analysisVideo.srcObject = stream;
    analysisVideo.play();
    analysisVideo.style.display = "block";
  }

  // 2️⃣ Capture frame from live video
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0);
  const frameData = canvas.toDataURL('image/jpeg');

  try {
    // 3️⃣ Send frame to Flask
    const response = await fetch('http://127.0.0.1:5000/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ frame: frameData, breed: dogBreedSelect.value })
    });

    if (!response.ok) throw new Error('Server error');
    const result = await response.json();

    const diseaseName = document.querySelector('.diagnosis-disease');
    const confidenceBadge = document.querySelector('.confidence-badge');
    const recommendationsBox = document.querySelector('.recommendations-box');

    diseaseName.textContent = result.disease || "No detection";
    confidenceBadge.textContent = result.confidence ? `${result.confidence}%` : "—";

    if (result.disease === "No disease detected" || result.confidence === 0) {
      recommendationsBox.textContent =
        "✅ No visible signs of disease detected. Try capturing another angle or better lighting.";
    } else if (result.confidence > 80) {
      recommendationsBox.textContent =
        `⚠️ High confidence: ${result.disease}. Please consult a veterinarian.`;
    } else if (result.confidence > 50) {
      recommendationsBox.textContent =
        `🔍 Possible ${result.disease}. Capture a clearer image to confirm.`;
    } else {
      recommendationsBox.textContent =
        "🟢 Low confidence detection. Possibly normal skin condition.";
    }

  } catch (err) {
    console.error('Error during analysis:', err);
  }

  analyzing = false;
});

setInterval(() => {
  if (connected && !analyzing && currentPage === 'analysis') {
    analyzeBtn.click();
  }
}, 1000); // analyze every 1 second

// Gallery functionality
let galleryFolders = [];
let serverImages = [];

// Create folder functionality
createFolderBtn.addEventListener('click', () => {
  const folderName = prompt('Enter folder name (e.g., "Golden Retriever"):');
  if (folderName && folderName.trim()) {
    createFolder(folderName.trim());
  }
});

function createFolder(name) {
  const folder = {
    id: Date.now(),
    name: name,
    type: 'species',
    subfolders: [],
    images: []
  };
  
  galleryFolders.push(folder);
  renderGallery();
}

function createSubfolder(parentId, name) {
  const parentFolder = galleryFolders.find(f => f.id === parentId);
  if (parentFolder) {
    const subfolder = {
      id: Date.now(),
      name: name,
      type: 'disease',
      parentId: parentId,
      images: []
    };
    
    parentFolder.subfolders.push(subfolder);
    renderGallery();
  }
}

async function renderGallery() {
  galleryGrid.innerHTML = '';
  
  // Load server images
  serverImages = await loadServerImages();
  
  // Add create folder button
  const createBtn = document.createElement('div');
  createBtn.className = 'gallery-item';
  createBtn.innerHTML = `
    <i class="bi bi-folder-plus"></i>
    <h6>Create New Folder</h6>
  `;
  createBtn.addEventListener('click', () => createFolderBtn.click());
  galleryGrid.appendChild(createBtn);
  
  // Add server images section
  if (serverImages.length > 0) {
    const serverSection = document.createElement('div');
    serverSection.className = 'gallery-item server-images';
    serverSection.innerHTML = `
      <i class="bi bi-cloud-upload"></i>
      <h6>Uploaded Images</h6>
      <small class="text-muted">${serverImages.length} images from server</small>
    `;
    serverSection.addEventListener('click', () => showServerImages());
    galleryGrid.appendChild(serverSection);
  }
  
  // Render folders
  galleryFolders.forEach(folder => {
    const folderElement = document.createElement('div');
    folderElement.className = 'gallery-item';
    folderElement.innerHTML = `
      <i class="bi bi-folder-fill"></i>
      <h6>${folder.name}</h6>
      <small class="text-muted">${folder.subfolders.length} subfolders</small>
    `;
    
    folderElement.addEventListener('click', () => {
      if (folder.type === 'species') {
        const subfolderName = prompt(`Enter disease name for ${folder.name} (e.g., "Fungal Infection"):`);
        if (subfolderName && subfolderName.trim()) {
          createSubfolder(folder.id, subfolderName.trim());
        }
      }
    });
    
    galleryGrid.appendChild(folderElement);
    
    // Render subfolders
    folder.subfolders.forEach(subfolder => {
      const subfolderElement = document.createElement('div');
      subfolderElement.className = 'gallery-item';
      subfolderElement.style.marginLeft = '20px';
      subfolderElement.innerHTML = `
        <i class="bi bi-folder2"></i>
        <h6>${subfolder.name}</h6>
        <small class="text-muted">${subfolder.images.length} images</small>
      `;
      
      subfolderElement.addEventListener('click', () => {
        // TODO: Show images in this subfolder
        alert(`Viewing images in ${folder.name} > ${subfolder.name}`);
      });
      
      galleryGrid.appendChild(subfolderElement);
    });
  });
}

function showServerImages() {
  // Create a modal or overlay to show server images
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
                <small>${new Date(img.uploaded_at).toLocaleDateString()}</small>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Close modal functionality
  modal.querySelector('.close-btn').addEventListener('click', () => {
    document.body.removeChild(modal);
  });
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  });
}

// Initialize gallery
renderGallery();

initializeIPAddress();

// Update server status monitoring to also update navigation buttons
const originalUpdateServerStatus = updateServerStatus;
updateServerStatus = function(isConnected) {
  originalUpdateServerStatus(isConnected);
  updateNavigationButtons();
};
