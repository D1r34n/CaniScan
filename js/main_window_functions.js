// Home Page Functions
import { loadGalleryImages, analyzeModeActive, exitAnalyzeMode } from './gallery_page.js';
// Protect against multiple loads of this script
if (!window._functionReloadProtected) {
  
  window._functionReloadProtected = true;

  console.log("%c⚙️ Initializing functions.js...", "color: cyan; font-weight: bold;");

  // Variables
  const minimizeBtn = document.getElementById('minimize');
  const closeBtn = document.getElementById('close');  

  const loadingScreenContainer = document.getElementById("loadingScreenContainer");
  const galleryOverview = document.getElementById("galleryOverview");

  const galleryBtn = document.getElementById("galleryBtn");
  const analysisBtn = document.getElementById("analysisBtn");

  let serverConnected = false;

  const userNameElement = document.getElementById("userName");
  const dropdownUserName = document.getElementById("dropdownUserName");
  const dropdownUserEmail = document.getElementById("dropdownUserEmail");

  const userGreeting = document.getElementById('userGreeting');
  const userDropdown = document.getElementById('userDropdown');

  let loggedInUserName = ""; // store user name globally
  
  // Minimize and Close Button
  let ipcRenderer;
  try {
    const electron = require('electron');
    ipcRenderer = electron.ipcRenderer;
    console.log("Electron detected, ipcRenderer loaded.");
  } catch (err) {
    console.log("Not running in Electron, skipping ipcRenderer.");
  }

  if (minimizeBtn) minimizeBtn.addEventListener('click', () => ipcRenderer.send('minimize-window'));
  if (closeBtn) closeBtn.addEventListener('click', () => ipcRenderer.send('close-window'));
  
  // Check Log-in session and connect to gallery server
  async function initUserSession() {
    if (!userNameElement) return;

    try {
        // Fetch session info from Flask
        const res = await fetch("http://127.0.0.1:5000/status", {
            method: "GET",
            credentials: "include" // send cookies for session
        });

        const data = await res.json();

        if (data.logged_in) {
            console.log("%c📧 Logged in user data from session:", "color: yellow;", data);

            loggedInUserName = data.name || "User"; // fallback if name not sent
            userNameElement.textContent = `Hello, ${loggedInUserName}!`;

            if (dropdownUserName) dropdownUserName.textContent = loggedInUserName;
            if (dropdownUserEmail && data.email) {
                dropdownUserEmail.textContent = data.email;
            }

            console.log("%c👤 Logged-in user set to:", "color: cyan;", loggedInUserName);

            // Connect to local desktop server
            console.log("%c🖧 Connecting to server...", "color: limegreen;");

            if (!ipcRenderer) {
                console.warn("ipcRenderer not available. Running outside Electron?");
                return;
            }

            ipcRenderer.send('connect-desktop-server');

            ipcRenderer.once('desktop-server-status', (event, status) => {
                if (status.success) {
                    console.log("%c✅ Desktop server started successfully.", "color: limegreen;");

                    fadeOut(loadingScreenContainer, 400, () => fadeIn(galleryOverview, 400));
                    serverConnected = true;
                    if (galleryBtn) galleryBtn.disabled = false;
                    if (analysisBtn) analysisBtn.disabled = false;

                    // Show server IP
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

                                        setTimeout(() => {
                                            ipSpan.textContent = originalIP;
                                            ipSpan.style.color = "#333";
                                        }, 1500);
                                    })
                                    .catch(err => console.error("Failed to copy IP:", err));
                            });
                        }
                    }
                } else {
                    console.error("%c❌ Failed to start desktop server:", "color: red;", status.message);
                    console.log(`Retrying in ${retryDelay / 1000} seconds...`);
                    setTimeout(() => tryConnectDesktopServer(retryDelay), retryDelay);
                }
            });

        } else {
            console.log("%c❌ No user logged in.", "color: red;");
            // Optionally redirect to login page or show login form
        }
    } catch (err) {
        console.error("Failed to check Flask session:", err);
    }
  }

  // Fade in and out function
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

  // Page Switching Using Fade
  const homeBtn = document.getElementById("homeBtn");
  const galleryPage = document.getElementById("galleryPage");
  const analysisPage = document.getElementById("analysisPage");
  const homePage = document.getElementById("homePage");

  const navButtons = [homeBtn, galleryBtn, analysisBtn];

  function openAnalysisPage(afterOpen) {
    showPage(analysisPage);
    if (typeof afterOpen === 'function') {
      setTimeout(() => {
        afterOpen();
      }, 150);
    }
  }

  if (homeBtn) homeBtn.addEventListener("click", () => showPage(homePage));

  if (galleryBtn) {
      galleryBtn.addEventListener('click', () => {
      showPage(galleryPage);
      loadGalleryImages();
      });
  }

  if (analysisBtn) analysisBtn.addEventListener("click", () => {
    openAnalysisPage(() => {
      console.log('%c🔬 Analysis page ready', 'color: cyan;');
    });
  });
  
  // Setup Analysis Page Functions
    setupImageUpload();
    setupAnalysisButton();
    setupChatInterface();
    setupGallerySelection();

  // User Dropdown Functionality
  if (userGreeting && userDropdown) {

    // Toggle dropdown on click
    userGreeting.addEventListener('click', (e) => {
      e.stopPropagation();
      userDropdown.classList.toggle('show');
      userGreeting.classList.toggle('active');
      console.log("%c👆 Dropdown toggled", "color: cyan;");
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!userGreeting.contains(e.target)) {
        userDropdown.classList.remove('show');
        userGreeting.classList.remove('active');
      }
    });

    // Prevent dropdown from closing when clicking inside it
    userDropdown.addEventListener('click', (e) => e.stopPropagation());

    // Dropdown menu item handlers
    const changeProfileBtn = document.getElementById('changeProfileBtn');
    const changeAppearanceBtn = document.getElementById('changeAppearanceBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    if (changeProfileBtn) {
      changeProfileBtn.addEventListener('click', () => {
        // Show account selection modal
        const accountModal = document.getElementById('accountSelectionModal');
        if (accountModal) {
          accountModal.classList.add('show');
          console.log("%c👥 Account selection modal opened", "color: cyan;");
        }

        // Close dropdown
        userDropdown.classList.remove('show');
        userGreeting.classList.remove('active');
      });
    }

    if (changeAppearanceBtn) {
      changeAppearanceBtn.addEventListener('change', (e) => {
          if (e.target.checked) {
              document.body.classList.add('dark-mode');
          } else {
              document.body.classList.remove('dark-mode');
          }
      });
    }

    if (logoutBtn) {
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
            // No need to fadeOut/fadeIn anything; main window destroyed and login window shown
        });

        ipcRenderer.once('logout-failed', (event, data) => {
            console.error('Logout failed:', data.message);
            alert('Logout failed. Please try again.');
        });

        // Close the dropdown immediately
        userDropdown.classList.remove('show');
        userGreeting.classList.remove('active');
      });
    }
  }

  // AVATAR + NAME MODAL LOGIC
  const axios = require('axios'); // Node-style import for Electron renderer

  const accountModal = document.getElementById('accountSelectionModal');
  const accountModalOverlay = accountModal?.querySelector('.account-modal-overlay');
  const navbarUserAvatar = document.getElementById('navbarUserAvatar');
  const navbarUserName = document.getElementById('userName'); // optional element for showing name
  const prevBtn = document.getElementById('prevAvatar');
  const nextBtn = document.getElementById('nextAvatar');
  const currentAvatarImg = document.getElementById('currentAvatar');
  const avatarLabel = document.getElementById('avatarLabel');
  const applyBtn = document.getElementById('applyAvatarChanges');
  const firstNameInput = document.getElementById('firstName');
  const lastNameInput = document.getElementById('lastName');

  // Avatar list
  const avatars = [
    { id: 0, src: '../images/Earl.png', label: 'LABRADOR' },
    { id: 1, src: '../images/Edrian.png', label: 'POMERANIAN' },
    { id: 2, src: '../images/Joaquin.png', label: 'SHIH TZU' },
    { id: 3, src: '../images/Jigs.png', label: 'CORGI' },
  ];

  let currentIndex = 0;

  // Show avatar in modal
  function updateModalAvatar() {
    const avatar = avatars[currentIndex];
    currentAvatarImg.src = avatar.src;
    avatarLabel.textContent = avatar.label;
  }

  // Carousel arrows
  prevBtn.addEventListener('click', () => {
    currentIndex = (currentIndex - 1 + avatars.length) % avatars.length;
    updateModalAvatar();
  });
  nextBtn.addEventListener('click', () => {
    currentIndex = (currentIndex + 1) % avatars.length;
    updateModalAvatar();
  });

  // Close modal on overlay click
  accountModalOverlay.addEventListener('click', () => {
    accountModal.classList.remove('show');
  });

  // === Apply Changes (Save to DB) ===
  applyBtn.addEventListener('click', async () => {
    const avatar = avatars[currentIndex];
    const firstName = firstNameInput.value.trim();
    const lastName = lastNameInput.value.trim();

    const payload = {};
    if (firstName) payload.first_name = firstName;
    if (lastName) payload.last_name = lastName;
    payload.avatar_id = avatar.id; // <-- Send integer ID, not path

    try {
      await axios.post('http://127.0.0.1:5000/update-user', payload, { withCredentials: true });

      console.log('✅ User updated successfully');

      // Reflect in UI immediately — keep old name if no new one provided
      const currentName = navbarUserName.textContent;
      const newName = `${firstName || ''} ${lastName || ''}`.trim();
      navbarUserAvatar.src = avatar.src;
      if (loggedInUserName) loggedInUserName = newName || currentName || 'User';

      // Save locally for instant reload
      localStorage.setItem('userAvatar', avatar.src);
      localStorage.setItem('userAvatarID', avatar.id);
      if (firstName) localStorage.setItem('userFirstName', firstName);
      if (lastName) localStorage.setItem('userLastName', lastName);

      accountModal.classList.remove('show');
    } catch (err) {
      console.error('❌ Failed to update user in DB:', err);
      alert('Failed to save changes. Please try again.');
    }
  });

  // === Load on Page Start ===
  window.addEventListener('DOMContentLoaded', async () => {
    try {
      // 1️⃣ Get user info from backend
      const res = await axios.get('http://127.0.0.1:5000/status', { withCredentials: true });
      const user = res.data;

      if (user.logged_in) {
        const savedAvatarID = user.avatar_id ?? 0;
        currentIndex = savedAvatarID < avatars.length ? savedAvatarID : 0;

        // Update navbar and modal
        const avatar = avatars[currentIndex];
        navbarUserAvatar.src = avatar.src;
        if (loggedInUserName) loggedInUserName = user.name || 'User';
      }

      updateModalAvatar();
    } catch (err) {
      console.error('⚠️ Could not fetch user status:', err);
      updateModalAvatar(); // fallback
    }
  });

  // Check if session is initiated and connect automatically to gallery server
  initUserSession();

  // Start with home page
  showPage(homePage);

    //CHECK IF UI HAS FULLY LOADED
    document.addEventListener("DOMContentLoaded", () => {
        console.log("%c📄 DOM fully loaded.", "color: green;");  
        setupTabs();
        setupClearHistoryButton();
        loadAnalysisHistory();  
    });

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
            
            if (analysisResults) {
                analysisResults.style.display = 'block'; 
                resultDiagnosis.textContent = 'Pending...'; 
                resultConfidence.textContent = '--'; 
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
        if (resultDiagnosis) {
            resultDiagnosis.textContent = '-';
        }
        if (resultConfidence) {
            resultConfidence.textContent = '-';
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
    
  // ============================================
  // CUSTOM DROPDOWN MENU FOR ANALYSIS PAGE LOGIC
  // ============================================
  const dropdownButton = document.getElementById('dropdownButton');
  const dropdownMenu = document.getElementById('dropdownMenu');

  if (dropdownButton && dropdownMenu) {
    // Toggle dropdown on button click
    dropdownButton.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdownMenu.classList.toggle('show');
      console.log('Dropdown toggled');
    });

    // Handle dropdown item selection
    const dropdownItems = dropdownMenu.querySelectorAll('div');
    dropdownItems.forEach(item => {
      item.addEventListener('click', (e) => {
        const selectedValue = e.target.textContent.trim();
        
        // Update button text (keep the arrow)
        dropdownButton.innerHTML = `${selectedValue} <span>▼</span>`;
        
        // Close dropdown
        dropdownMenu.classList.remove('show');
        
        // Store selected model
        window.selectedModel = selectedValue;
        
        console.log('Selected model:', selectedValue);
      });
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!dropdownButton.contains(e.target) && !dropdownMenu.contains(e.target)) {
        dropdownMenu.classList.remove('show');
      }
    });
    
    console.log('%c✅ Simple dropdown initialized', 'color: limegreen;');
  }

    // Analysis button functionality
    function setupAnalysisButton() {
        const analyzeBtn = document.getElementById('analyzeBtn');
        const analysisResults = document.getElementById('analysisResults');
        const resultDiagnosis = document.getElementById('resultDiagnosis');
        const resultConfidence = document.getElementById('resultConfidence');
        
        analyzeBtn.addEventListener('click', async () => {

          if (!window.selectedModel) {
            alert('Please select a model first (YoloV8n or YoloV11n)');
            return;
            }

            const previewImage = document.getElementById('previewImage');
            if (!previewImage.src) return;
            
            // Show loading state
            analyzeBtn.disabled = true;
            analyzeBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Analyzing...';
            
            try {

                // Call real YOLO analysis API
                const analysisResult = await performRealAnalysis(previewImage.src, window.selectedModel);
                
                // Show results
                analysisResults.style.display = 'block';
                resultDiagnosis.textContent = analysisResult.disease;
                resultConfidence.textContent = `${analysisResult.confidence}%`;
                
                // Save analyzed image to gallery
                const savedFilename = await saveAnalyzedImageToGallery(
                  previewImage.src, 
                  analysisResult.disease, 
                  analysisResult.confidence
                ); 
                
                // Add to history with filename
                await addToAnalysisHistory(
                  previewImage.src, 
                  analysisResult.disease, 
                  `${analysisResult.confidence}%`, 
                  savedFilename
                );
                
                // Show initial LLM recommendation in chat
                showInitialRecommendation(analysisResult.recommendation);
                
                // Store current analysis data for chat context
                window.currentAnalysis = {
                    diagnosis: analysisResult.disease,
                    confidence: analysisResult.confidence,
                    model: window.selectedModel
                };
                
                // Debug: Log the stored analysis data
                console.log('DEBUG: Stored analysis data:', window.currentAnalysis);
                
                // Ensure chat input is clickable and focused after analysis
                setTimeout(() => {
                    restoreChatInputClickability();
                }, 100);
                
            } catch (error) {
                console.error('Analysis failed:', error);
                alert('Analysis failed. Please try again.');
            } finally {
                // Reset button
                analyzeBtn.disabled = false;
                analyzeBtn.innerHTML = 'Analyze';
            }
        });
        
        async function performRealAnalysis(imageSrc, modelName) {
            try {
                const response = await fetch('http://localhost:5000/analyze', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        frame: imageSrc,
                        model: modelName
                    })
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const result = await response.json();
                return result;
            } catch (error) {
                console.error('Error calling analysis API:', error);
                throw error;
            }
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
            
            // Show typing indicator
            const typingIndicator = addTypingIndicator();
            
            // Call LLM API for response
            callLLMAPI(message)
                .then(response => {
                    // Remove typing indicator
                    removeTypingIndicator(typingIndicator);
                    
                    // Add bot response
                    addChatMessage(response.response, 'bot');
                })
                .catch(error => {
                    console.error('Error getting LLM response:', error);
                    // Remove typing indicator
                    removeTypingIndicator(typingIndicator);
                    
                    // Add error message
                    addChatMessage("I apologize, but I'm having trouble processing your request right now. Please try again or consult a veterinarian for immediate assistance.", 'bot');
                });
        }
        
        async function callLLMAPI(message) {
            // LLM works with or without analysis - if analysis exists, it enhances the response
            const currentAnalysis = window.currentAnalysis || { diagnosis: '', confidence: 0 };
            
            // Debug: Log the data being sent to the API
            console.log('DEBUG: Sending to chat API:', {
                message: message,
                diagnosis: currentAnalysis.diagnosis || 'None',
                confidence: currentAnalysis.confidence || 0
            });
            
            const response = await fetch('http://localhost:5000/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',  // Include session cookie
                body: JSON.stringify({
                    message: message,
                    diagnosis: currentAnalysis.diagnosis || '',
                    confidence: currentAnalysis.confidence || 0
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        }
        
        function addTypingIndicator() {
            const typingDiv = document.createElement('div');
            typingDiv.className = 'chat-message bot-message typing-indicator';
            typingDiv.innerHTML = `
                <div class="message-content">
                    <span class="typing-dots">
                        <span>.</span><span>.</span><span>.</span>
                    </span>
                </div>
            `;
            chatMessages.appendChild(typingDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
            return typingDiv;
        }
        
        function removeTypingIndicator(typingDiv) {
            if (typingDiv && typingDiv.parentNode) {
                typingDiv.parentNode.removeChild(typingDiv);
            }
        }
        
        function showInitialRecommendation(recommendation) {
            // Clear existing messages except the welcome message
            const welcomeMessage = chatMessages.querySelector('.bot-message');
            chatMessages.innerHTML = '';
            if (welcomeMessage) {
                chatMessages.appendChild(welcomeMessage);
            }
            
            // Add the initial recommendation
            addChatMessage(recommendation, 'bot');
        }
        
        sendMessageBtn.addEventListener('click', sendMessage);
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
        
        // Ensure chat input is always focusable
        chatInput.addEventListener('click', () => {
            chatInput.focus();
            if (window.require && window.require('electron')) {
                const { ipcRenderer } = window.require('electron');
                if (ipcRenderer) {
                    ipcRenderer.send('focus-window');
                }
            }
        });
        
        // Auto-focus chat input when analysis page is shown
        const analysisPage = document.getElementById('analysisPage');
        if (analysisPage) {
            const observer = new MutationObserver(() => {
                if (analysisPage.style.display !== 'none') {
                    // Small delay to ensure page is fully rendered
                    setTimeout(() => {
                        chatInput.focus();
                    }, 100);
                }
            });
            observer.observe(analysisPage, { attributes: true, attributeFilter: ['style'] });
        }
        
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
    
    // Function to restore chat input clickability
    function restoreChatInputClickability() {
        const chatInput = document.getElementById('chatInput');
        const chatInputArea = document.querySelector('.chat-input-area');
        const recommendationsBox = document.querySelector('.recommendations-box');
        
        if (chatInput) {
            // Remove any disabled state
            chatInput.disabled = false;
            chatInput.style.pointerEvents = 'auto';
            chatInput.style.zIndex = '20';
            // Focus the input to ensure it's interactive
            chatInput.focus();
        }
        
        if (chatInputArea) {
            chatInputArea.style.pointerEvents = 'auto';
            chatInputArea.style.zIndex = '20';
        }
        
        if (recommendationsBox) {
            recommendationsBox.style.zIndex = '2';
            recommendationsBox.style.pointerEvents = 'auto';
        }
        
        // Remove any lingering popup overlays
        const blockingOverlays = document.querySelectorAll('.popup-overlay:not(.analysis-details-popup .popup-overlay), .analysis-details-popup');
        blockingOverlays.forEach(overlay => {
            // Only remove if it's not part of an active popup
            const popup = overlay.closest('.analysis-details-popup');
            if (!popup || !document.body.contains(popup)) {
                if (overlay.parentNode) {
                    overlay.parentNode.removeChild(overlay);
                }
            }
        });
        
        console.log('DEBUG: Chat input clickability restored');
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
    
    function addToAnalysisHistory(imageSrc, diagnosis, confidence, filename) {
    // Get existing history from localStorage
    const history = JSON.parse(localStorage.getItem('analysisHistory') || '[]');
    
    // Create new history item
    const newItem = {
        imageSrc,
        diagnosis,
        confidence,
        filename: filename || 'Analysis Result',
        timestamp: new Date().toISOString()
    };
    
    // Add to beginning of array
    history.unshift(newItem);
    
    // Keep only last 10 items
    if (history.length > 10) {
        history.pop();
    }
    
    // Save back to localStorage
    localStorage.setItem('analysisHistory', JSON.stringify(history));
    
    // Update the display using your existing function
    addHistoryItem(imageSrc, diagnosis, confidence, newItem.timestamp);
    
    console.log('Added to history:', newItem);
    }
    
    function addHistoryItem(imageSrc, diagnosis, confidence, timestamp = null) {
    const historyList = document.getElementById('historyList');
    
    // Remove empty state if it exists
    const emptyState = historyList.querySelector('.empty-state');
    if (emptyState) {
        emptyState.remove();
    }
    
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
    
    // Add to top of list
    historyList.insertBefore(historyItem, historyList.firstChild);
}

// Load all history items from localStorage
function loadAnalysisHistory() {
    const historyList = document.getElementById('historyList');
    const history = JSON.parse(localStorage.getItem('analysisHistory') || '[]');
    
    // Clear current display
    historyList.innerHTML = '';
    
    if (history.length === 0) {
        // Show empty state
        historyList.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-inbox"></i>
                <p>No analysis history yet</p>
            </div>
        `;
    } else {
        // Display all history items
        history.forEach(item => {
            addHistoryItem(item.imageSrc, item.diagnosis, item.confidence, item.timestamp);
        });
    }
    
    console.log(`Loaded ${history.length} history items`);
}

// Clear History Functionality (integrated with your backend)
function setupClearHistoryButton() {
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');
    if (!clearHistoryBtn) return;
    
    clearHistoryBtn.addEventListener('click', async () => {
        // Confirm before clearing
        const confirmed = confirm(
            'Are you sure you want to clear all analysis history? This will delete:\n\n' +
            '- All analysis history in the app\n' +
            '- All diagnosis records in the CSV file\n\n' +
            'This action cannot be undone.'
        );
        
        if (confirmed) {
            try {
                // Clear localStorage
                localStorage.removeItem('analysisHistory');
                
                // Clear from CSV via API
                const response = await fetch('http://localhost:5000/clear-analysis-history', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'include'
                });
                
                if (response.ok) {
                    const result = await response.json();
                    console.log('History cleared:', result);
                    
                    // Reload history display (will show empty state)
                    loadAnalysisHistory();
                    
                    // Show success message
                    alert('Analysis history has been cleared successfully.');
                } else {
                    throw new Error('Failed to clear history from server');
                }
            } catch (error) {
                console.error('Error clearing history:', error);
                alert('Error clearing history. Please try again.');
            }
        }
    });
}
    
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

    // ================================
    // PAGE SWITCHING WITH FADE
    // ================================
    function showPage(pageToShow) {
      // Prevent re-showing the page if it’s already visible
      if (pageToShow.style.display !== "none") return;

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

        if (pageToShow !== galleryPage && analyzeModeActive) {
          exitAnalyzeMode();
        }

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
      openAnalysisPage(() => {
        console.log('%c🔬 Analysis page ready', 'color: cyan;');
      });
    });

    showPage(homePage);

  }; // end DOMContentLoaded

// Tab Switching Functionality
function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const recommendationsTab = document.getElementById('recommendationsTab');
    const historyTab = document.getElementById('historyTab');
    
    tabButtons.forEach((button, index) => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');
            
            // Remove active class from all buttons and tabs
            tabButtons.forEach(btn => btn.classList.remove('active'));
            
            // Add active class to clicked button
            button.classList.add('active');
            
            // Show/hide appropriate tab content
            if (tabName === 'recommendations') {
                recommendationsTab.classList.add('active');
                historyTab.classList.remove('active');
            } else if (tabName === 'history') {
                historyTab.classList.add('active');
                recommendationsTab.classList.remove('active');
            }
        });
    });
}

// Clear history functionality
    function setupClearHistoryButton() {
        const clearHistoryBtn = document.getElementById('clearHistoryBtn');
        if (!clearHistoryBtn) return;
        
        clearHistoryBtn.addEventListener('click', async () => {
            // Confirm before clearing
            const confirmed = confirm('Are you sure you want to clear all analysis history? This will delete:\n\n- All analysis history in the app\n- All diagnosis records in the CSV file\n\nThis action cannot be undone.');
            
            if (confirmed) {
                try {
                    // Clear localStorage
                    localStorage.removeItem('analysisHistory');
                    
                    // Clear from CSV via API
                    const response = await fetch('http://localhost:5000/clear-analysis-history', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        credentials: 'include'
                    });
                    
                    if (response.ok) {
                        const result = await response.json();
                        console.log('History cleared:', result);
                        
                        // Reload history display (will be empty)
                        loadAnalysisHistory();
                        
                        // Show success message
                        alert('Analysis history has been cleared successfully.');
                    } else {
                        throw new Error('Failed to clear history from server');
                    }
                } catch (error) {
                    console.error('Error clearing history:', error);
                    alert('Error clearing history. Please try again.');
                }
            }
        });
    }
