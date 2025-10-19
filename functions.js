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

const connectBtn = document.getElementById('connectPhoneButton');
const disconnectBtn = document.getElementById('disconnectPhoneButton');
const video = document.getElementById('phoneVideo');
const placeholder = document.querySelector('.connectPhoneNote');
const analyzeBtn = document.getElementById('analyzeButton');
const dogBreedSelect = document.getElementById('dogBreed');
const navbar = document.getElementById('navigationBar');
const navbarTitle = document.getElementById('navbarTitle');
const navbarSubtitle = document.getElementById('navbarSubtitle');

// Page elements
const capturePage = document.getElementById('capturePage');
const analysisPage = document.getElementById('analysisPage');
const analysisVideo = document.getElementById('analysisVideo');

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

        connected = false;
        analyzeBtn.disabled = true;
    }
});

dogBreedSelect.addEventListener('change', () => {
    analyzeBtn.disabled = !(connected && dogBreedSelect.value !== "Select Dog Breed");
});

disconnectBtn.addEventListener('click', () => {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        video.srcObject = null;
    }

    // Change navbar
    navbar.style.backgroundColor = "#004aad";
    navbarTitle.innerHTML = '<i class="bi bi-check-circle-fill me-2"></i>Dog Skin Disease Analyzer';
    navbarSubtitle.textContent = "Upload a photo and provide details for diagnosis";

    // Hide capture page, show analysis page
    capturePage.style.display = "flex";
    analysisPage.style.display = "none";

    // Disconnect video
    video.style.display = "none";
    placeholder.style.display = 'block';

    // Reset phone button
    connectBtn.innerHTML = '<i class="bi bi-phone-fill me-2"></i>Connect Phone';
    connectBtn.classList.remove('btn-danger');
    connectBtn.classList.add('btn-primary');

    // Reset dog select breed
    dogBreedSelect.value = "Select Dog Breed";
    
    connected = false;
    analyzeBtn.disabled = true;
    analyzing = false;
});

dogBreedSelect.addEventListener('change', () => {
    analyzeBtn.disabled = !(connected && dogBreedSelect.value !== "Select Dog Breed");
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

  // 1️⃣ Switch UI only the first time
  if (capturePage.style.display !== "none") {
    navbar.style.backgroundColor = "#00bf63";
    navbarTitle.innerHTML = '<i class="bi bi-check-circle-fill me-2"></i>AI Analysis Results';
    navbarSubtitle.textContent = "";

    capturePage.style.display = "none";
    analysisPage.style.display = "flex";

    if (stream) {
      analysisVideo.srcObject = stream;
      analysisVideo.play();
      analysisVideo.style.display = "block";
    }
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
  if (connected && !analyzing && analysisPage.style.display === "flex") {
    analyzeBtn.click();
  }
}, 1000); // analyze every 5 seconds
