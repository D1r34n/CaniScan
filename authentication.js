    // --- CODE FOR AUTHENTICATION.HTML ---
    // This entire block will only run if it detects the login form on the page.
    document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById("login-form");
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

  // Name format validation
  const namePattern = /^[A-Za-zÀ-ÖØ-öø-ÿ' -]+$/; 
  if (!namePattern.test(firstName)) {
    showMessage("Invalid first name.", "error");
    return;
  } else if (!namePattern.test(lastName)) {
    showMessage("Invalid last name.", "error");
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
});

// End of authentication.html logic