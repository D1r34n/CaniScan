// ========================================
// analysis_page.js - Analysis Page Functionality
// ========================================

// ================================
// TAB SWITCHING FUNCTIONALITY
// ================================
function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const recommendationsTab = document.getElementById('recommendationsTab');
    const historyTab = document.getElementById('historyTab');
    
    
    tabButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');
                        
            // Remove active class from all buttons
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
                // Reload history when switching to history tab
                loadAnalysisHistory();
            }
        });
    });
    
}

// ================================
// ANALYSIS HISTORY FUNCTIONALITY
// ================================
function loadAnalysisHistory() {
    const historyList = document.getElementById('historyList');
    
    // Get history from localStorage
    const history = JSON.parse(localStorage.getItem('analysisHistory') || '[]');
        
    // Clear existing items
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
    
}

function addHistoryItem(imageSrc, diagnosis, confidence, timestamp = null) {
    const historyList = document.getElementById('historyList');
    if (!historyList) return;
    
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

// ================================
// ADD TO HISTORY
// ================================
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
    
    // Update the display
    addHistoryItem(imageSrc, diagnosis, confidence, newItem.timestamp);
    
}

// ================================
// CLEAR HISTORY FUNCTIONALITY
// ================================
function setupClearHistoryButton() {
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');

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

//setup analysis page functions
setupTabs();
setupClearHistoryButton();
loadAnalysisHistory();

// ================================
// UTILITY FUNCTIONS
// ================================
export function restoreChatInputClickability() {
    const chatInput = document.getElementById('chatInput');
    const sendMessageBtn = document.getElementById('sendMessageBtn');
    const chatInputArea = document.querySelector('.chat-input-area');
    const inputGroup = document.querySelector('.input-group');
    const recommendationsBox = document.querySelector('.recommendations-box');
    const chatContainer = document.querySelector('.chat-container');
    
    if (chatInput) {
        chatInput.disabled = false;
        chatInput.style.pointerEvents = 'auto';
        chatInput.style.zIndex = '20';
        chatInput.style.opacity = '1';
        chatInput.removeAttribute('readonly');
        chatInput.focus();
    }
    
    if (sendMessageBtn) {
        sendMessageBtn.disabled = false;
        sendMessageBtn.style.pointerEvents = 'auto';
        sendMessageBtn.style.zIndex = '30';
        sendMessageBtn.style.opacity = '1';
        sendMessageBtn.style.cursor = 'pointer';
    }
    
    if (chatInputArea) {
        chatInputArea.style.pointerEvents = 'auto';
        chatInputArea.style.zIndex = '20';
        chatInputArea.style.opacity = '1';
    }
    
    if (inputGroup) {
        inputGroup.style.pointerEvents = 'auto';
        inputGroup.style.zIndex = '20';
    }
    
    if (chatContainer) {
        chatContainer.style.pointerEvents = 'auto';
        chatContainer.style.zIndex = '10';
    }
    
    if (recommendationsBox) {
        recommendationsBox.style.zIndex = '2';
        recommendationsBox.style.pointerEvents = 'auto';
    }
    
    // Remove any lingering popup overlays that might be blocking
    const blockingOverlays = document.querySelectorAll('.popup-overlay');
    blockingOverlays.forEach(overlay => {
        const popup = overlay.closest('.analysis-details-popup');
        // Only remove if it's not part of an active popup
        if (!popup || !document.body.contains(popup)) {
            if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        }
    });
    
    // Remove any invisible blocking elements
    const allElements = document.querySelectorAll('*');
    allElements.forEach(el => {
        const style = window.getComputedStyle(el);
        // Check if element is positioned and might be blocking
        if (style.position === 'fixed' || style.position === 'absolute') {
            const zIndex = parseInt(style.zIndex) || 0;
            // If it's a high z-index element that's not visible but might block
            if (zIndex > 10 && zIndex < 9999 && (style.opacity === '0' || style.display === 'none')) {
                // Don't remove it, but ensure it's not blocking
                if (el.classList.contains('popup-overlay') || el.classList.contains('analysis-details-popup')) {
                    // Already handled above
                }
            }
        }
    });
    
    // Force a reflow to ensure styles are applied
    if (chatInput) {
        void chatInput.offsetHeight;
    }
    if (sendMessageBtn) {
        void sendMessageBtn.offsetHeight;
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
            const resultInferenceTime = document.getElementById('resultInferenceTime');
            if (resultInferenceTime && analysisResult.inference_time !== undefined) {
                resultInferenceTime.textContent = `${analysisResult.inference_time}s`;
            }
            
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
            if (window.showInitialRecommendation) {
                window.showInitialRecommendation(analysisResult.recommendation);
            } else {
                // Fallback: setupChatInterface might not be called yet
                setTimeout(() => {
                    if (window.showInitialRecommendation) {
                        window.showInitialRecommendation(analysisResult.recommendation);
                    }
                }, 100);
            }
            
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
                // Also ensure send button is properly initialized
                const sendMessageBtn = document.getElementById('sendMessageBtn');
                if (sendMessageBtn && !sendMessageBtn.hasAttribute('data-listener-attached')) {
                    // Re-attach listener if needed (shouldn't be necessary but just in case)
                    sendMessageBtn.setAttribute('data-listener-attached', 'true');
                }
            }, 200);
            
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
    
    if (!chatInput || !sendMessageBtn || !chatMessages) {
        console.warn('Chat interface elements not found');
        return;
    }
    
    // Check if already initialized to prevent duplicate listeners
    if (chatInput.hasAttribute('data-chat-initialized')) {
        // Already initialized, just ensure it's clickable
        restoreChatInputClickability();
        return;
    }
    
    function sendMessage() {
        // Get current chat input from DOM (in case it was replaced)
        const currentChatInput = document.getElementById('chatInput');
        if (!currentChatInput) return;
        
        const message = currentChatInput.value.trim();
        if (!message) return;
        
        // Add user message
        addChatMessage(message, 'user');
        currentChatInput.value = '';
        
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
    
    // Attach event listeners
    sendMessageBtn.addEventListener('click', sendMessage);
    sendMessageBtn.setAttribute('data-listener-attached', 'true');
    
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
    
    // Mark as initialized
    chatInput.setAttribute('data-chat-initialized', 'true');
    
    // Auto-focus chat input when analysis page is shown
    const analysisPage = document.getElementById('analysisPage');
    if (analysisPage) {
        const observer = new MutationObserver(() => {
            if (analysisPage.style.display !== 'none') {
                // Small delay to ensure page is fully rendered
                setTimeout(() => {
                    const currentChatInput = document.getElementById('chatInput');
                    if (currentChatInput) {
                        currentChatInput.focus();
                        restoreChatInputClickability();
                    }
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
    
    // Store showInitialRecommendation for use outside
    window.showInitialRecommendation = showInitialRecommendation;
}

//setup image upload functionality
setupImageUpload();

// Initialize chat interface and analysis button
// Use DOMContentLoaded to ensure elements exist, or call immediately if already loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setupChatInterface();
        setupAnalysisButton();
    });
} else {
    // DOM already loaded
    setupChatInterface();
    setupAnalysisButton();
}

// ================================
// EXPORT FUNCTIONS FOR USE IN OTHER FILES
// ================================
// Make functions available globally
window.analysisPageFunctions = {
    loadAnalysisHistory,
    addToAnalysisHistory,
    setupTabs,
    setupClearHistoryButton,
    restoreChatInputClickability,
    handleImageFile,
    setupImageUpload,
    setupAnalysisButton,
    setupChatInterface
};
