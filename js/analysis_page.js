// ========================================
// analysis_page.js - Analysis Page Functionality
// ========================================

import { 
    loadGalleryImages, 
    analyzeModeActive, 
    enterAnalyzeMode
} from './gallery_page.js';

// ================================
// TAB SWITCHING FUNCTIONALITY
// ================================
function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all buttons
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Hide all tab contents
            tabContents.forEach(tc => tc.classList.remove('active'));

            // Show the clicked tab's content
            const targetId = btn.dataset.tab + "Tab" || btn.dataset.tab;
            const targetContent = document.getElementById(targetId) || document.getElementById(btn.dataset.tab);
            if (targetContent) targetContent.classList.add('active');
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

let isHistoryView = false; 

function addHistoryItem(imageSrc, diagnosis, confidence, timestamp = null) {
    const historyList = document.getElementById('historyList');
    if (!historyList) return;

    const emptyState = historyList.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

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

    historyItem.addEventListener('click', () => {
        console.log("previewing history");
        // ✅ GET historyEntry from localStorage
        const history = JSON.parse(localStorage.getItem('analysisHistory') || '[]');
        const historyEntry = history.find(item => 
            item.timestamp === timestamp && item.diagnosis === diagnosis
        );

        // Display previous analysis
        const uploadPlaceholder = document.getElementById('imageUploadArea')?.querySelector('.upload-placeholder');
        const imagePreview = document.getElementById('imagePreview');
        const previewImage = document.getElementById('previewImage');
        const overlayCanvas = document.getElementById('overlayCanvas');
        const analysisForm = document.getElementById('analysisForm');
        const analysisResultsDisplay = document.getElementById('analysisResultsDisplay');
        const analysisResults = document.getElementById('analysisResults');
        const selectImageMessage = document.getElementById('selectImageMessage');

        // Set preview image
        if (previewImage) previewImage.src = imageSrc;
        if (uploadPlaceholder) uploadPlaceholder.style.display = 'none';
        if (imagePreview) imagePreview.style.display = 'block';
        
        // Show results, hide form
        if (analysisForm) analysisForm.style.display = 'none';
        if (analysisResultsDisplay) analysisResultsDisplay.style.display = 'flex';
        if (analysisResults) analysisResults.style.display = 'block';
        if (selectImageMessage) selectImageMessage.style.display = 'none';

        // Clear canvas first
        if (overlayCanvas) {
            const ctx = overlayCanvas.getContext('2d');
            ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        }

        // Draw bounding boxes if available
        const detections = historyEntry?.detections || [];
        if (detections.length > 0 && overlayCanvas && previewImage) {
            // Wait for image to load
            if (previewImage.complete) {
                drawBoundingBoxes(previewImage, overlayCanvas, detections);
            } else {
                previewImage.onload = () => {
                    drawBoundingBoxes(previewImage, overlayCanvas, detections);
                };
            }

            // Display results
            displayAnalysisResults(
                detections.map(det => ({
                    disease: det.disease,
                    confidence: det.confidence.toFixed ? det.confidence.toFixed(1) : det.confidence
                })),
                historyEntry.inferenceTime || 'N/A'
            );
        } else {
            // Fallback for old history items without detections
            displayAnalysisResults([
                { disease: diagnosis, confidence: parseFloat(confidence) || confidence }
            ], 'N/A');
        }

        // Update current analysis
        window.currentAnalysis = {
            diagnosis: historyEntry?.diagnosis || diagnosis,
            confidence: parseFloat(confidence) || confidence,
            dogName: historyEntry?.dogName || '',
            dogBreed: historyEntry?.dogBreed || '',
            detections: detections
        };

        // Clear gallery source to prevent auto-analysis
        window.currentAnalysisSource = null;

        // Update analyze button
        console.log("hiding button");
        const analyzeBtn = document.getElementById('analyzeBtn');
        if (analyzeBtn) analyzeBtn.style.display = 'none';

    });

    historyList.insertBefore(historyItem, historyList.firstChild);
}

// ================================
// DISPLAY ANALYSIS RESULTS (NEW)
// ================================
function displayAnalysisResults(results, inferenceTime) {
    const resultsContainer = document.getElementById('analysisResultsDisplay');
    resultsContainer.innerHTML = ''; // clear previous cards

    results.forEach(item => {
        const card = document.createElement('div');
        card.className = 'result-card';

        card.innerHTML = `
            <div class="result-info">
                <span class="result-label">Disease</span>
                <span class="result-value">${item.disease}</span>
            </div>
            <div class="result-info">
                <span class="result-label">Confidence</span>
                <span class="result-value result-confidence">${item.confidence}%</span>
            </div>
        `;

        resultsContainer.appendChild(card);
    });

    const inferenceEl = document.getElementById('resultInferenceTime');
    if (inferenceEl) {
        inferenceEl.textContent = `Inference Time: ${inferenceTime}`;
    }

    resultsContainer.style.display = 'flex';
}


// ================================
// ADD TO HISTORY
// ================================
function addToAnalysisHistory(imageSrc, diagnosis, confidence, filename, inferenceTime = 'N/A') {
    const history = JSON.parse(localStorage.getItem('analysisHistory') || '[]');

    const newItem = {
        imageSrc,
        diagnosis,
        confidence,
        dogName: window.currentAnalysis?.dogName || '',
        dogBreed: window.currentAnalysis?.dogBreed || '',
        detections: window.currentAnalysis?.detections || [],
        filename: filename || 'Analysis Result',
        inferenceTime,  // ✅ Save inference time
        timestamp: new Date().toISOString()
    };

    history.unshift(newItem);
    if (history.length > 10) history.pop();
    localStorage.setItem('analysisHistory', JSON.stringify(history));
    addHistoryItem(imageSrc, diagnosis, confidence, newItem.timestamp);
}

function setupClearHistoryButton() {
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');

    clearHistoryBtn.addEventListener('click', async () => {
        const confirmed = confirm(
            'Are you sure you want to clear all analysis history? This will delete:\n\n' +
            '- All analysis history in the app\n' +
            '- All diagnosis records in the CSV file\n\n' +
            'This action cannot be undone.'
        );

        if (!confirmed) return;

        try {
            // 1️⃣ Clear localStorage
            localStorage.removeItem('analysisHistory');

            // 2️⃣ Clear server-side CSV
            const response = await fetch('http://localhost:5000/clear-analysis-history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });

            if (!response.ok) throw new Error('Failed to clear history from server');
            await response.json();

            // 3️⃣ Reload history display
            loadAnalysisHistory();

            // 4️⃣ Reset image upload & analysis UI
            const uploadPlaceholder = document.querySelector('#imageUploadArea .upload-placeholder');
            const previewImage = document.getElementById('previewImage');
            const imagePreviewContainer = document.getElementById('imagePreview');
            const overlayCanvas = document.getElementById('overlayCanvas');
            const analysisForm = document.getElementById('analysisForm');
            const analysisResultsDisplay = document.getElementById('analysisResultsDisplay');
            const analysisResults = document.getElementById('analysisResults');
            const selectImageMessage = document.getElementById('selectImageMessage');
            const analyzeBtn = document.getElementById('analyzeBtn');
            const changeImageBtn = document.getElementById('changeImageBtn');

            // Show placeholder, hide preview
            if (uploadPlaceholder) uploadPlaceholder.style.display = 'flex';
            if (imagePreviewContainer) imagePreviewContainer.style.display = 'none';
            if (previewImage) previewImage.src = '';
            
            // Clear canvas
            if (overlayCanvas) {
                const ctx = overlayCanvas.getContext('2d');
                ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
            }

            // Show analysis form, hide results
            if (analysisForm) analysisForm.style.display = 'block';
            if (analysisResultsDisplay) analysisResultsDisplay.style.display = 'none';
            if (analysisResults) analysisResults.style.display = 'none';
            if (selectImageMessage) selectImageMessage.style.display = 'flex';

            // Reset buttons
            if (analyzeBtn) {
                analyzeBtn.style.display = 'inline-block';
                analyzeBtn.disabled = false;
                analyzeBtn.innerHTML = 'Analyze';
            }

            if (changeImageBtn) {
                changeImageBtn.textContent = 'Change Image';
                changeImageBtn.classList.remove('analyze-new-btn');
                changeImageBtn.style.backgroundColor = '';
                changeImageBtn.style.color = '';
            }

            // Reset current analysis state
            window.currentAnalysis = null;
            window.currentAnalysisSource = null;

            alert('Analysis history cleared and upload area reset.');
        } catch (error) {
            console.error('Error clearing history:', error);
            alert('Error clearing history. Please try again.');
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

function resetAnalysisForm() {
    const analysisForm = document.getElementById('analysisForm');
    const analysisResultsDisplay = document.getElementById('analysisResultsDisplay');
    const selectImageMessage = document.getElementById('selectImageMessage');
    const previewImage = document.getElementById('previewImage');
    const imagePreviewContainer = document.getElementById('imagePreview');
    const overlayCanvas = document.getElementById('overlayCanvas');

    // Reset form visibility
    if (analysisForm) analysisForm.style.display = 'block';
    if (analysisResultsDisplay) analysisResultsDisplay.style.display = 'none';
    if (selectImageMessage) selectImageMessage.style.display = 'flex';

    // Clear form inputs
    const dogName = document.getElementById('dogName');
    const dogBreed = document.getElementById('dogBreed-box');
    const modelSelect = document.getElementById('modelSelect');

    if (dogName) dogName.value = '';
    if (dogBreed) dogBreed.value = '';
    if (modelSelect) modelSelect.selectedIndex = 0;

    // Clear preview image & hide container
    if (previewImage) previewImage.src = '';
    if (imagePreviewContainer) imagePreviewContainer.style.display = 'none';

    // Clear canvas
    if (overlayCanvas) {
        const ctx = overlayCanvas.getContext('2d');
        ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    }

    // Reset state
    window.currentAnalysis = null;
    isHistoryView = false;

    // Reset analyze button
    const analyzeBtn = document.getElementById('analyzeBtn');
    if (analyzeBtn) analyzeBtn.innerHTML = 'Analyze';
}

export function setupImageUpload(preloadedImage = null) {
    const uploadArea = document.getElementById('imageUploadArea');
    const uploadPlaceholder = uploadArea?.querySelector('.upload-placeholder');
    const previewImage = document.getElementById('previewImage');
    const imagePreviewContainer = document.getElementById('imagePreview');
    const analysisForm = document.getElementById('analysisForm');
    const analysisResultsDisplay = document.getElementById('analysisResultsDisplay');
    const selectImageMessage = document.getElementById('selectImageMessage');
    const analysisResults = document.getElementById('analysisResults');  // ✅ Container
    const overlayCanvas = document.getElementById('overlayCanvas');

    if (!uploadArea || !uploadPlaceholder || !previewImage || !imagePreviewContainer) {
        console.error('Image upload components are missing');
        return;
    }

    const clearCanvas = () => {
        if (overlayCanvas) {
            const ctx = overlayCanvas.getContext('2d');
            ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        }
        const container = document.getElementById('imagePreview');
        const existingBoxes = container?.querySelectorAll('.hover-box');
        existingBoxes?.forEach(box => box.remove());
    };

    const displayPreview = (imageObj) => {
        clearCanvas();

        previewImage.src = imageObj.src || imageObj.dataUrl;
        previewImage.alt = imageObj.filename || '';
        uploadPlaceholder.style.display = 'none';
        imagePreviewContainer.style.display = 'block';

        // ✅ SHOW the analysis container, SHOW form, HIDE results
        if (analysisResults) analysisResults.style.display = 'block';
        if (analysisForm) analysisForm.style.display = 'block';
        if (analysisResultsDisplay) analysisResultsDisplay.style.display = 'none';
        if (selectImageMessage) selectImageMessage.style.display = 'none';

        // Reset form inputs
        const dogName = document.getElementById('dogName');
        const dogBreed = document.getElementById('dogBreed-box');
        const modelSelect = document.getElementById('modelSelect');
        const inferenceTime = document.getElementById('resultInferenceTime');
        const changeImageBtn = document.getElementById('changeImageBtn');
        if (changeImageBtn) {
            changeImageBtn.textContent = "Change Image";

            // Remove 'analyze-new-btn' only if it exists
            if (changeImageBtn.classList.contains('analyze-new-btn')) {
                changeImageBtn.classList.remove('analyze-new-btn');
            }

            // Reset inline styles
            changeImageBtn.style.backgroundColor = ""; // resets to default
            changeImageBtn.style.color = "";           // resets to default
        }

        if (dogName) dogName.value = '';
        if (dogBreed) dogBreed.selectedIndex = 0;
        if (modelSelect) modelSelect.selectedIndex = 0;
        if(inferenceTime) inferenceTime.textContent = '';
        if (analyzeBtn) analyzeBtn.style.display = '';
        window.currentAnalysis = null;
        window.currentAnalysisSource = {
            type: 'gallery',
            filename: imageObj.filename,
            analyzed: false
        };
    };

    if (preloadedImage) {
        displayPreview(preloadedImage);
        return;
    }

    // Drag & drop
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

    uploadArea.addEventListener('drop', async (e) => {
        e.preventDefault();
        uploadPlaceholder.style.borderColor = '#d9b99b';
        uploadPlaceholder.style.background = 'rgba(217, 185, 155, 0.05)';

        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            const dataUrl = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
            displayPreview({ dataUrl, filename: file.name });
        }
    });
}

function selectFromGallery({ event = null, autoLoad = true } = {}) {
    const galleryPage = document.getElementById("galleryPage");
    console.log('Selecting from gallery...');

    // Handle event ONLY if provided
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    // Switch pages
    window.showPage(galleryPage);

    // Load images automatically unless disabled
    if (autoLoad) {
        loadGalleryImages();
    }

    // Enable analyze mode if not already active
    if (!analyzeModeActive) {
        enterAnalyzeMode();
    }

    const actionsDropdown = document.getElementById('actionsDropdown');

    // Show the 
    if (actionsDropdown) {
    actionsDropdown.classList.add('show');
    }
}

// Gallery selection functionality
function setupGallerySelection() {
    const selectFromGalleryBtn = document.getElementById('selectFromGalleryBtn');
    const changeImageBtn = document.getElementById('changeImageBtn');

[selectFromGalleryBtn, changeImageBtn].forEach(btn => {
    if (btn) {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            selectFromGallery(); // This handles showing the gallery and enabling analyze mode
        });
        }
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

// Make fetchImageAsDataURL available globally
window.fetchImageAsDataURL = fetchImageAsDataURL;

// Save analyzed image to gallery with metadata
async function saveAnalyzedImageToGallery(imageSrc, dogBreed, disease, confidence) {
    try {
        const response = await fetch(imageSrc);
        const blob = await response.blob();
        
        const formData = new FormData();
        formData.append('image', blob, 'analyzed_image.jpg');
        formData.append('analyzed', 'true');
        formData.append('breed', dogBreed || 'unknown');
        formData.append('disease', disease || 'unknown');
        formData.append('confidence', String(confidence || 0));

        if (window.currentAnalysisSource?.type === 'gallery' && window.currentAnalysisSource.filename) {
            formData.append('source_filename', window.currentAnalysisSource.filename);
        }

        const uploadResponse = await fetch('http://localhost:5001/upload', {
            method: 'POST',
            body: formData
        });
        
        if (!uploadResponse.ok) {
            throw new Error('Failed to upload image');
        }
        
        const result = await uploadResponse.json();
        console.log('Image saved to gallery:', result);

        const galleryPage = document.getElementById('galleryPage');
        if (galleryPage && galleryPage.style.display !== 'none') {
            setTimeout(() => loadGalleryImages(), 500);
        }
        
        return result.filename;
    } catch (error) {
        console.error('Error saving image to gallery:', error);
        throw error;
    }
}

function drawBoundingBoxes(previewImage, overlayCanvas, detections) {
    if (!previewImage || !overlayCanvas || !detections) return;

    const container = document.getElementById('imagePreview');
    if (!container) return;

    // Clear existing hover boxes
    const existingBoxes = container.querySelectorAll('.hover-box');
    existingBoxes.forEach(box => box.remove());

    const rect = previewImage.getBoundingClientRect();
    overlayCanvas.width = rect.width;
    overlayCanvas.height = rect.height;

    const imgAspect = previewImage.naturalWidth / previewImage.naturalHeight;
    let displayWidth, displayHeight, offsetX, offsetY;

    if (rect.width / rect.height > imgAspect) {
        displayHeight = rect.height;
        displayWidth = displayHeight * imgAspect;
        offsetX = (rect.width - displayWidth) / 2;
        offsetY = 0;
    } else {
        displayWidth = rect.width;
        displayHeight = displayWidth / imgAspect;
        offsetX = 0;
        offsetY = (rect.height - displayHeight) / 2;
    }

    const scaleX = displayWidth / previewImage.naturalWidth;
    const scaleY = displayHeight / previewImage.naturalHeight;

    const ctx = overlayCanvas.getContext('2d');
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    // Define a color map for diseases
    const diseaseColors = {
        'hotspot': 'lime',
        'allergic dermatitis': 'orange',
        'fungal infection': 'cyan',
        'mange': 'magenta'
        // add more diseases/colors here as needed
    };

    detections.forEach(det => {
        const color = diseaseColors[det.disease.toLowerCase()] || 'yellow'; // fallback color

        const [x1, y1, x2, y2] = det.bbox;
        const scaledX1 = x1 * scaleX + offsetX;
        const scaledY1 = y1 * scaleY + offsetY;
        const scaledX2 = x2 * scaleX + offsetX;
        const scaledY2 = y2 * scaleY + offsetY;

        // Draw bounding box on canvas
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(scaledX1, scaledY1, scaledX2 - scaledX1, scaledY2 - scaledY1);

        // Draw label on canvas
        const text = `${det.disease} ${det.confidence.toFixed(1)}%`;
        ctx.font = '16px Arial';
        const textWidth = ctx.measureText(text).width;
        const textHeight = 16;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(scaledX1, scaledY1 - textHeight, textWidth + 6, textHeight);
        ctx.fillStyle = color;
        ctx.fillText(text, scaledX1 + 3, scaledY1 - 2);

        // Create hoverable div
        const hoverDiv = document.createElement('div');
        hoverDiv.className = 'hover-box';
        hoverDiv.style.position = 'absolute';
        hoverDiv.style.left = `${scaledX1}px`;
        hoverDiv.style.top = `${scaledY1}px`;
        hoverDiv.style.width = `${scaledX2 - scaledX1}px`;
        hoverDiv.style.height = `${scaledY2 - scaledY1}px`;
        hoverDiv.style.border = `2px solid ${color}`;
        hoverDiv.style.pointerEvents = 'auto';
        hoverDiv.style.cursor = 'pointer';
        hoverDiv.style.background = 'rgba(0,0,0,0)'; // transparent

        container.appendChild(hoverDiv);
    });
}

let boundingBoxObserver;

function setupBoundingBoxObserver(previewImage, overlayCanvas) {
    if (!previewImage || !overlayCanvas) return;

    // Disconnect previous observer if exists
    if (boundingBoxObserver) boundingBoxObserver.disconnect();

    boundingBoxObserver = new ResizeObserver(() => {
        if (window.currentAnalysis?.detections?.length) {
            drawBoundingBoxes(previewImage, overlayCanvas, window.currentAnalysis.detections);
        } else {
            // Clear canvas if no detections
            const ctx = overlayCanvas.getContext('2d');
            ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        }
    });

    boundingBoxObserver.observe(previewImage);
}

async function getImageWithBoundingBoxes(previewImage, detections) {
    if (!previewImage || !detections) return null;

    const canvas = document.createElement('canvas');
    canvas.width = previewImage.naturalWidth;
    canvas.height = previewImage.naturalHeight;
    const ctx = canvas.getContext('2d');

    // Draw the original image
    ctx.drawImage(previewImage, 0, 0, canvas.width, canvas.height);

    // Define disease colors
    const diseaseColors = {
        'hotspot': 'lime',
        'allergic dermatitis': 'orange',
        'fungal infection': 'cyan',
        'mange': 'magenta'
    };

    // Draw bounding boxes
    detections.forEach(det => {
        const color = diseaseColors[det.disease.toLowerCase()] || 'yellow';
        const [x1, y1, x2, y2] = det.bbox;

        // Box
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

        // Label background
        const text = `${det.disease} ${det.confidence.toFixed(1)}%`;
        ctx.font = '20px Arial';
        const textWidth = ctx.measureText(text).width;
        const textHeight = 22;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(x1, y1 - textHeight, textWidth + 6, textHeight);

        // Label text
        ctx.fillStyle = color;
        ctx.fillText(text, x1 + 3, y1 - 4);
    });

    return canvas.toDataURL('image/jpeg');
}


export function setupAnalysisButton() {
    const analyzeBtn = document.getElementById('analyzeBtn');
    const changeImageBtn = document.getElementById('changeImageBtn');
    const previewImage = document.getElementById('previewImage');
    const overlayCanvas = document.getElementById('overlayCanvas');

    if (!analyzeBtn || !previewImage || !overlayCanvas) return;

    setupBoundingBoxObserver(previewImage, overlayCanvas);

    // Clone analyze button to remove old listeners
    const newAnalyzeBtn = analyzeBtn.cloneNode(true);
    analyzeBtn.parentNode.replaceChild(newAnalyzeBtn, analyzeBtn);

    // Clone change image button once and keep reference
    let newChangeBtn;
    if (changeImageBtn && changeImageBtn.parentNode) {
        newChangeBtn = changeImageBtn.cloneNode(true);
        changeImageBtn.parentNode.replaceChild(newChangeBtn, changeImageBtn);

        newChangeBtn.addEventListener('click', () => {
            selectFromGallery();
        });
    }

    newAnalyzeBtn.addEventListener('click', async () => {
        const dogNameInput = document.getElementById('dogName');
        const dogBreedSelect = document.getElementById('dogBreed-box');
        const modelSelect = document.getElementById('modelSelect');

        if (!modelSelect?.value) {
            alert('Please select a model first');
            return;
        }

        const selectedBreed = dogBreedSelect.value.trim();
        const selectedModel = modelSelect.value;

        newAnalyzeBtn.disabled = true;
        newAnalyzeBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Analyzing...';

        try {
            const analysisResult = await performRealAnalysis(previewImage.src, selectedModel);

            // Update UI - show results
            const analysisForm = document.getElementById('analysisForm');
            const analysisResultsDisplay = document.getElementById('analysisResultsDisplay');
            const selectImageMessage = document.getElementById('selectImageMessage');

            if (analysisForm) analysisForm.style.display = 'none';
            if (analysisResultsDisplay) analysisResultsDisplay.style.display = 'flex';
            if (selectImageMessage) selectImageMessage.style.display = 'none';

            // Draw bounding boxes
            if (analysisResult.detections?.length) {
                drawBoundingBoxes(previewImage, overlayCanvas, analysisResult.detections);
                displayAnalysisResults(
                    analysisResult.detections.map(det => ({
                        disease: det.disease,
                        confidence: det.confidence.toFixed(1)
                    })),
                    analysisResult.inference_time
                );
            }

            // Store analysis
            window.currentAnalysis = {
                diagnosis: analysisResult.diagnosis,
                confidence: analysisResult.confidence,
                model: selectedModel,
                dogName: dogNameInput?.value || '',
                dogBreed: selectedBreed,
                detections: analysisResult.detections || []
            };

            // Save to gallery
            const imageWithBoxes = await getImageWithBoundingBoxes(previewImage, analysisResult.detections);
            const savedFilename = await saveAnalyzedImageToGallery(
                imageWithBoxes,
                selectedBreed,
                analysisResult.disease,
                analysisResult.confidence
            );

            // Add to history
            window.analysisPageFunctions.addToAnalysisHistory(
                previewImage.src,
                analysisResult.disease,
                `${analysisResult.confidence}%`,
                savedFilename,
                analysisResult.inference_time
            );

            // Show LLM recommendation
            if (window.showInitialRecommendation && analysisResult.summary) {
                window.showInitialRecommendation(analysisResult.summary);
            }

            // Hide the Analyze button
            newAnalyzeBtn.style.display = 'none';

            // Update Change Image button
            if (newChangeBtn) {
                newChangeBtn.textContent = "Analyze New Image";
                newChangeBtn.classList.add('analyze-new-btn');
                newChangeBtn.style.backgroundColor = "#198754"; // green
                newChangeBtn.style.color = "white";
                newChangeBtn.style.display = "inline-block"; // ensure it’s visible
            }

            setTimeout(() => restoreChatInputClickability(), 200);

        } catch (error) {
            console.error('Analysis failed:', error);
            alert('Analysis failed. Please try again.');
        } finally {
            newAnalyzeBtn.disabled = false;
            newAnalyzeBtn.innerHTML = 'Analyze';
        }
    });
}


async function performRealAnalysis(imageSrc, modelName) {
    const response = await fetch('http://localhost:5000/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frame: imageSrc, model: modelName })
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
}

// Chat interface functionality
function setupChatInterface() {
    window.showInitialRecommendation = showInitialRecommendation;
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
        const currentAnalysis = window.currentAnalysis;
        const hasAnalysis = currentAnalysis && currentAnalysis.detections && currentAnalysis.detections.length > 0;
        
        // Get breed from current analysis or from the input field
        let breed = '';
        if (currentAnalysis && currentAnalysis.dogBreed) {
            breed = currentAnalysis.dogBreed;
        } else {
            // Try to get breed from the input field
            const breedInput = document.getElementById('dogBreed-box');
            if (breedInput && breedInput.value.trim()) {
                breed = breedInput.value.trim();
            }
        }
        
        // Debug: Log the data being sent to the API
        console.log('DEBUG: Sending to chat API:', {
            message: message,
            hasAnalysis: hasAnalysis,
            standalone: !hasAnalysis,
            breed: breed || 'None'
        });
        
        const response = await fetch('http://localhost:5000/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',  // Include session cookie
            body: JSON.stringify({
                message: message,
                standalone: !hasAnalysis,  // Use standalone mode if no analysis available
                breed: breed  // Include breed as context
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
}

// Global breeds array for autocomplete
let allBreeds = [];
let formattedBreeds = [];

// Load and populate breeds from CSV
async function loadBreeds() {
    try {
        const response = await fetch('../csv/fci-breeds.csv');
        const csvText = await response.text();
        
        const lines = csvText.split('\n');
        allBreeds = [];
        formattedBreeds = [];
        
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line) {
                const columns = line.split(',');
                const breedName = columns[1];
                if (breedName) {
                    allBreeds.push(breedName);
                    // Format breed name for display
                    const formattedBreed = breedName.toLowerCase()
                        .split(' ')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ');
                    formattedBreeds.push(formattedBreed);
                }
            }
        }
        
        // Setup autocomplete for breed input
        setupBreedAutocomplete();
        
    } catch (error) {
        console.error('Error loading breeds:', error);
    }
}

// Setup autocomplete functionality for breed input
function setupBreedAutocomplete() {
    const breedInput = document.getElementById('dogBreed-box');
    const dropdown = document.getElementById('breedAutocompleteDropdown');
    
    if (!breedInput || !dropdown) return;
    
    let selectedIndex = -1;
    
    // Filter and display breeds based on input
    function filterBreeds(searchTerm) {
        if (!searchTerm.trim()) {
            dropdown.classList.remove('show');
            return;
        }
        
        const searchLower = searchTerm.toLowerCase();
        const matches = [];
        
        for (let i = 0; i < allBreeds.length; i++) {
            const breed = allBreeds[i];
            const formatted = formattedBreeds[i];
            
            if (breed.toLowerCase().includes(searchLower) || 
                formatted.toLowerCase().includes(searchLower)) {
                matches.push({ original: breed, formatted: formatted, index: i });
            }
        }
        
        // Limit to 10 results for performance
        const displayMatches = matches.slice(0, 10);
        
        if (displayMatches.length > 0) {
            dropdown.innerHTML = '';
            displayMatches.forEach((match, idx) => {
                const item = document.createElement('div');
                item.className = 'breed-autocomplete-item';
                item.textContent = match.formatted;
                item.dataset.breed = match.original;
                item.dataset.index = idx;
                
                item.addEventListener('click', () => {
                    breedInput.value = match.formatted;
                    dropdown.classList.remove('show');
                    selectedIndex = -1;
                });
                
                dropdown.appendChild(item);
            });
            dropdown.classList.add('show');
        } else {
            dropdown.classList.remove('show');
        }
    }
    
    // Handle input events
    breedInput.addEventListener('input', (e) => {
        filterBreeds(e.target.value);
        selectedIndex = -1;
    });
    
    // Handle keyboard navigation
    breedInput.addEventListener('keydown', (e) => {
        const items = dropdown.querySelectorAll('.breed-autocomplete-item');
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
            updateSelection(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = Math.max(selectedIndex - 1, -1);
            updateSelection(items);
        } else if (e.key === 'Enter' && selectedIndex >= 0 && items[selectedIndex]) {
            e.preventDefault();
            items[selectedIndex].click();
        } else if (e.key === 'Escape') {
            dropdown.classList.remove('show');
            selectedIndex = -1;
        }
    });
    
    function updateSelection(items) {
        items.forEach((item, idx) => {
            if (idx === selectedIndex) {
                item.classList.add('selected');
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('selected');
            }
        });
    }
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!breedInput.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('show');
            selectedIndex = -1;
        }
    });
}

// Call when page loads
document.addEventListener('DOMContentLoaded', loadBreeds);

//setup image upload functionality
loadBreeds();
setupImageUpload();
window.setupImageUpload = setupImageUpload;
setupGallerySelection();


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

window.addEventListener("load", () => {
    const previewImage = document.getElementById('previewImage');
    const selectImageMessage = document.getElementById('selectImageMessage');
    const analysisResults = document.getElementById('analysisResults');

    // If no valid base64 image → hide analysis box
    if (!previewImage.src || !previewImage.src.includes("base64")) {
        if (analysisResults) analysisResults.style.display = 'none';
        if (selectImageMessage) selectImageMessage.style.display = 'flex';
    } else {
        if (analysisResults) analysisResults.style.display = 'block';
        if (selectImageMessage) selectImageMessage.style.display = 'none';
    }
});

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
    setupImageUpload,
    setupAnalysisButton,
    setupChatInterface
};
