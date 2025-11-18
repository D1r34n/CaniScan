// ================================
// GALLERY DETAIL MINIMIZE TOGGLE
// ================================

// Get DOM elements for detail pane toggle
const detailPane = document.getElementById("detailPane");
const minimizeDetail = document.getElementById("minimizeDetail");
const leftColumn = document.querySelector(".gallery-left");
const galleryUploadBtn = document.getElementById('galleryUploadBtn');

// Toggle detail pane visibility
if (detailPane && minimizeDetail && leftColumn) {
    minimizeDetail.addEventListener("click", () => {
        const isMinimized = detailPane.classList.contains("minimized");
        if (isMinimized) {
            // Restore pane
            detailPane.classList.remove("minimized");
            // leftColumn.style.flex = "3.5";
            galleryUploadBtn.style.right = "26rem";
        } else {
            // Minimize pane
            detailPane.classList.add("minimized");
            // leftColumn.style.flex = "3.5";
            galleryUploadBtn.style.right = "1rem";
             
        }
    });
}

// ================================
// GALLERY IMAGE LOADING & FILTERS
// ================================

// DOM references for gallery grid and controls
const imageGrid = document.querySelector(".gallery-left .image-grid");
const refreshButton = document.getElementById('refreshButton');
const sortAnalyzed = document.getElementById('sortAnalyzed');
const sortRaw = document.getElementById('sortRaw');
const sortDermatitis = document.getElementById('sortDermatitis');
const sortMange = document.getElementById('sortMange');
const sortHotspot = document.getElementById('sortHotspot');
const sortHealthy = document.getElementById('sortHealthy');

const sortDropdownContainer = document.querySelector('.sort-dropdown-container');
const sortDropdownButton = document.getElementById('sortDropdown');

sortDropdownButton.addEventListener('click', () => {
  sortDropdownContainer.classList.toggle('show');
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  if (!sortDropdownContainer.contains(e.target)) {
    sortDropdownContainer.classList.remove('show');
  }
});

// Aggregate sort checkboxes for convenience
const sortCheckboxes = [
    sortAnalyzed,
    sortRaw,
    sortDermatitis,
    sortMange,
    sortHotspot,
    sortHealthy
].filter(Boolean);

// Attach change event for each sort checkbox to re-render gallery
sortCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', () => {
        renderGalleryImages();
    });
});

// ================================
// STATE VARIABLES
// ================================
export let analyzeModeActive = false; // whether Analyze Mode is active
let allGalleryImages = []; // all images loaded from server
let filteredGalleryImages = []; // images after applying filters
let selectedImageFilenames = new Set(); // currently selected images
let lastSelectedFilename = null; // last clicked/selected image
let lastSelectedIndex = null; // index of last selected image
let lastActiveFilename = null; // currently active image
let analysisPageInitialized = false; // whether analysis page is initialized

window.currentAnalysisSource = null; // currently selected image for analysis

// ================================
// LOAD GALLERY IMAGES FROM SERVER
// ================================
export async function loadGalleryImages() {
    if (!imageGrid) return;

    try {
        const response = await fetch('http://localhost:5001/images');
        const data = await response.json();

        if (data.success) {
            allGalleryImages = Array.isArray(data.images) ? data.images : [];
            renderGalleryImages(); // render after loading
        } else {
            // Handle empty or failed response
            allGalleryImages = [];
            filteredGalleryImages = [];
            clearSelection();
            imageGrid.innerHTML = '<div class="no-images">No images uploaded yet.</div>';
        }
    } catch (error) {
        console.error('Error loading gallery images:', error);
        allGalleryImages = [];
        filteredGalleryImages = [];
        clearSelection();
        imageGrid.innerHTML = '<div class="no-images">Failed to load images from server.</div>';
    }
}

// ================================
// DISPLAY SELECTED IMAGE IN PREVIEW
// ================================
async function displayImageFromGallery(image) {
    if (!image || !image.filename) {
        throw new Error('Invalid image data provided.');
    }

    // DOM elements for analysis preview
    const uploadArea = document.getElementById('imageUploadArea');
    const uploadPlaceholder = uploadArea?.querySelector('.upload-placeholder');
    const imagePreview = document.getElementById('imagePreview');
    const previewImage = document.getElementById('previewImage');
    const analysisResults = document.getElementById('analysisResults');

    if (!uploadArea || !uploadPlaceholder || !imagePreview || !previewImage) {
        throw new Error('Analysis components are not available.');
    }

    // Fetch image as data URL
    const imageUrl = `http://localhost:5001/images/${image.filename}`;
    
    // Use global function if available, otherwise define it locally
    let fetchImageFn = window.fetchImageAsDataURL;
    if (!fetchImageFn) {
        // Fallback: define it locally if not available globally
        fetchImageFn = async function(url) {
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
        };
    }
    
    const dataUrl = await fetchImageFn(imageUrl);

    // Update preview
    previewImage.src = dataUrl;
    previewImage.alt = image.filename;
    previewImage.dataset.sourceFilename = image.filename;
    uploadPlaceholder.style.display = 'none';
    imagePreview.style.display = 'block';
    if (analysisResults) analysisResults.style.display = 'none';

    // Reset analysis results
    const resultDiagnosis = document.getElementById('resultDiagnosis');
    const resultConfidence = document.getElementById('resultConfidence');
    const resultInferenceTime = document.getElementById('resultInferenceTime');
    if (resultDiagnosis) resultDiagnosis.textContent = '-';
    if (resultConfidence) resultConfidence.textContent = '-';
    if (resultInferenceTime) resultInferenceTime.textContent = '-';

    // Track current image for analysis
    window.currentAnalysisSource = {
        type: 'gallery',
        filename: image.filename,
        disease: image.disease || '',
        confidence: image.confidence || '',
        analyzed: Boolean(image.analyzed)
    };
}

// ================================
// AUTO-ANALYZE SELECTED IMAGE
// ================================
function autoAnalyzeSelectedImage() {
    if (window.currentAnalysisSource?.type !== 'gallery') return;

    const analyzeBtn = document.getElementById('analyzeBtn');
    const previewImage = document.getElementById('previewImage');
    if (!analyzeBtn || !previewImage || !previewImage.src) return;

    if (!analyzeBtn.disabled) {
        analyzeBtn.click(); // programmatically click analyze
    }
}

// ================================
// GALLERY FILTER HELPERS
// ================================
function getActiveGalleryFilters() {
    const statuses = [];
    const diseases = [];

    if (sortAnalyzed?.checked) statuses.push('analyzed');
    if (sortRaw?.checked) statuses.push('raw');
    if (sortDermatitis?.checked) diseases.push('dermatitis');
    if (sortMange?.checked) diseases.push('mange');
    if (sortHotspot?.checked) diseases.push('hotspot');
    if (sortHealthy?.checked) diseases.push('healthy');

    return { statuses, diseases };
}

// Apply filters to image array
function applyGalleryFilters(images, filters) {
    if (!filters.statuses.length && !filters.diseases.length) return [...images];

    return images.filter(image => {
        const imageStatus = image.analyzed ? 'analyzed' : 'raw';
        const imageDisease = (image.disease || '').toLowerCase();

        const statusMatches = !filters.statuses.length || filters.statuses.includes(imageStatus);
        const diseaseMatches = !filters.diseases.length || filters.diseases.includes(imageDisease);

        return statusMatches && diseaseMatches;
    });
}

// ================================
// RENDER GALLERY IMAGES
// ================================
function renderGalleryImages() {
    if (!imageGrid) return;

    const filters = getActiveGalleryFilters();
    const filtered = applyGalleryFilters(allGalleryImages, filters);
    filteredGalleryImages = filtered;

    // Remove selections that are no longer visible
    Array.from(selectedImageFilenames).forEach(filename => {
        if (!filtered.some(img => img.filename === filename)) {
            selectedImageFilenames.delete(filename);
        }
    });

    if (lastSelectedFilename && !filtered.some(img => img.filename === lastSelectedFilename)) {
        lastSelectedFilename = null;
        lastSelectedIndex = null;
    }

    if (lastActiveFilename && !filtered.some(img => img.filename === lastActiveFilename)) {
        lastActiveFilename = null;
    }

    imageGrid.innerHTML = '';

    if (!filtered.length) {
        selectedImageFilenames.clear();
        lastSelectedFilename = null;
        lastSelectedIndex = null;
        lastActiveFilename = null;
        imageGrid.innerHTML = '<div class="no-images">No images match the current filters.</div>';
        return;
    }

    filtered.forEach((image, index) => {
        const div = document.createElement('div');
        div.classList.add('image-item');
        div.dataset.filename = image.filename;
        div.dataset.disease = image.disease || '';
        div.dataset.analyzed = image.analyzed ? 'true' : 'false';
        div.dataset.confidence = image.confidence || '';
        div.dataset.uploadedAt = image.uploaded_at || '';
        if (typeof image.size !== 'undefined') div.dataset.size = image.size;

        if (image.analyzed) div.classList.add('analyzed');

        const img = document.createElement('img');
        img.src = `http://localhost:5001/images/${image.filename}`;
        img.alt = image.filename;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        div.appendChild(img);

        if (image.analyzed) {
            const badge = document.createElement('div');
            badge.className = 'analyzed-badge';
            badge.innerHTML = '<i class="bi bi-check-circle-fill"></i>';
            badge.title = `Analyzed: ${image.disease || 'N/A'} (${image.confidence || '0'}%)`;
            div.appendChild(badge);
        }

        // Adds a check if the image was selected
        if (selectedImageFilenames.has(image.filename)) {
            div.classList.add('selected');
        }

        if (image.filename === lastSelectedFilename) {
            div.classList.add('last-selected');
            lastSelectedIndex = index;
        }
        if (image.filename === lastActiveFilename) div.classList.add('active');

        div.addEventListener('click', (event) => handleImageItemClick(event, image));

        imageGrid.appendChild(div);
    });

    applyAnalyzeModeStyles();

    // Show details for active/last-selected image
    if (analyzeModeActive && lastSelectedFilename) {
        const imageData = filtered.find(img => img.filename === lastSelectedFilename);
        if (imageData) showImageDetails(imageData);
    } else if (!analyzeModeActive && lastActiveFilename) {
        const imageData = filtered.find(img => img.filename === lastActiveFilename);
        if (imageData) showImageDetails(imageData);
    }

    syncSelectedState();
}

// ================================
// APPLY ANALYZE MODE STYLES
// ================================
function applyAnalyzeModeStyles() {
    if (!imageGrid) return;
    const items = Array.from(imageGrid.querySelectorAll('.image-item'));
    items.forEach(item => {
        if (analyzeModeActive) item.classList.add('selectable');
        else item.classList.remove('selectable');
    });
}

// ================================
// HANDLE IMAGE ITEM CLICK
// ================================
function handleImageItemClick(event, image) {
    event.stopPropagation();

    if (analyzeModeActive) selectImage(event, image);
    else {
        document.querySelectorAll('.image-item.active').forEach(el => el.classList.remove('active'));
        event.currentTarget.classList.add('active');
        lastActiveFilename = image.filename;
        showImageDetails(image);
    }
}

// ================================
// CLEAR SELECTION
// ================================
function clearSelection() {
    if (!imageGrid) return;
    Array.from(imageGrid.querySelectorAll('.image-item')).forEach(img => {
        img.classList.remove('selected', 'last-selected', 'active');
    });
    selectedImageFilenames = new Set();
    lastSelectedFilename = null;
    lastSelectedIndex = null;
    lastActiveFilename = null;
}

// ================================
// SYNC SELECTED STATE
// ================================
function syncSelectedState() {
    if (!imageGrid) return;
    selectedImageFilenames = new Set(
        Array.from(imageGrid.querySelectorAll('.image-item.selected'))
             .map(el => el.dataset.filename)
    );
}

// ================================
// SHOW IMAGE DETAILS IN PANE
// ================================
function showSelectImagePlaceholder(message = "Select an image") {
    const detailPane = document.getElementById("detailPane");
    if (!detailPane) return;

    detailPane.classList.remove('minimized');

    let detailContent = detailPane.querySelector('.detail-content');
    if (!detailContent) {
        detailContent = document.createElement('div');
        detailContent.className = 'detail-content';
        detailPane.appendChild(detailContent);
    }

    detailContent.innerHTML = `
        <div style="
            height:100%; 
            display:flex; 
            flex-direction:column; 
            align-items:center; 
            justify-content:center; 
            text-align:center; 
            color:#888;
        ">
            <i class="bi bi-image" style="font-size:3rem; margin-bottom:1rem;"></i>
            <div style="font-size:1.2rem; font-weight:500;">${message}</div>
        </div>
    `;
}


function showImageDetails(image) {
    const detailPane = document.getElementById("detailPane");
    if (!detailPane || !image) return;

    lastActiveFilename = image.filename || null;
    detailPane.classList.remove('minimized');

    const uploadedDate = image.uploaded_at ? new Date(image.uploaded_at) : null;
    const dateStr = uploadedDate ? uploadedDate.toLocaleDateString() : 'N/A';
    const timeStr = uploadedDate ? uploadedDate.toLocaleTimeString() : 'N/A';
    const sizeKB = image.size ? Math.round(image.size / 1024) : 0;
    const sizeStr = sizeKB > 0 ? `${sizeKB} KB` : 'Unknown';
    const isAnalyzed = image.analyzed || false;
    const diagnosis = image.disease || 'N/A';
    const confidence = image.confidence || '0';
    const analysisStatus = isAnalyzed
        ? `<span class="status-badge analyzed-status"><i class="bi bi-check-circle-fill"></i> Analyzed</span>`
        : `<span class="status-badge raw-status"><i class="bi bi-circle"></i> Raw (Not Analyzed)</span>`;

    const detailContent = detailPane.querySelector('.detail-content');
    if (detailContent) {
        const displayName = isAnalyzed ? diagnosis : 'Not Analyzed';
        const displayNameClass = isAnalyzed ? 'diagnosis-value' : '';

        detailContent.innerHTML = `
            <h3>Image Details</h3>
            <div class="detail-preview">
                <img src="http://localhost:5001/images/${image.filename}" alt="${image.filename}">
            </div>
            <div class="detail-info">
                <div class="detail-row">
                    <span class="detail-label"><i class="bi bi-heart-pulse"></i> Diagnosis:</span>
                    <span class="detail-value ${displayNameClass}">${displayName}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label"><i class="bi bi-calendar"></i> Date:</span>
                    <span class="detail-value">${dateStr}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label"><i class="bi bi-clock"></i> Time:</span>
                    <span class="detail-value">${timeStr}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label"><i class="bi bi-hdd"></i> Size:</span>
                    <span class="detail-value">${sizeStr}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label"><i class="bi bi-info-circle"></i> Status:</span>
                    <span class="detail-value">${analysisStatus}</span>
                </div>
                ${isAnalyzed ? `
                <div class="detail-row analysis-info">
                    <span class="detail-label"><i class="bi bi-graph-up"></i> Confidence:</span>
                    <span class="detail-value confidence-value">${confidence}%</span>
                </div>` : ''}
            </div>
        `;
    }
}

// ================================
// REFRESH BUTTON HANDLER
// ================================
let lastAnalyzeState = false; // remember previous state
if (refreshButton) {
    refreshButton.addEventListener('click', () => {
        if (analyzeModeActive) {
            console.log("⚠️ Refresh disabled during Analyze Mode.");
            return; // 🚫 stop here, no refresh
        }
        loadGalleryImages();
    });
}

// ================================
// ANALYZE MODE & SELECTION BUTTONS
// ================================
const galleryColumn = document.querySelector('.gallery-columns');

const actionsButton = document.getElementById('actionsDropdownButton');
const actionsDropdown = document.getElementById('actionsDropdown');
const dropdownAnalyzeBtn = document.getElementById('dropdownAnalyzeBtn');
const dropdownDeleteBtn = document.getElementById('dropdownDeleteBtn');

const galleryUploadInput = document.getElementById('galleryUploadInput');

// Action Dropdown Button
actionsButton.addEventListener('click', (e) => {
    e.stopPropagation();
    
    if (analyzeModeActive) {
        // If in analyze mode, exit it and close dropdown
        exitAnalyzeMode();
        actionsDropdown.classList.remove('show');
    } else {
        // If not in analyze mode, enter it and show dropdown
        enterAnalyzeMode();
        actionsDropdown.classList.add('show');
    }
});

// Close dropdown when clicking outside (but keep it open during analyze mode for better UX)
document.addEventListener('click', (e) => {
    // Don't close if clicking on image items during analyze mode
    if (analyzeModeActive && e.target.closest('.image-item')) {
        return; // Keep dropdown open when selecting images
    }
    
    // Close dropdown if clicking outside of it and the button
    if (actionsDropdown && !actionsDropdown.contains(e.target) && !actionsButton.contains(e.target)) {
        // Only close if not in analyze mode, or if clicking on non-interactive areas
        if (!analyzeModeActive) {
            actionsDropdown.classList.remove('show');
        }
    }
});

// Gallery upload button functionality
if (galleryUploadBtn && galleryUploadInput) {
    galleryUploadBtn.addEventListener('click', () => {
        // Trigger the hidden file input
        galleryUploadInput.click();
    });

    galleryUploadInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Please select a valid image file.');
            return;
        }

        // Show loading state
        const originalText = galleryUploadBtn.innerHTML;
        galleryUploadBtn.disabled = true;
        galleryUploadBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Uploading...';

        try {
            // Create FormData for file upload
            const formData = new FormData();
            formData.append('image', file);

            // Upload to server
            const response = await fetch('http://localhost:5001/upload', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                console.log('Image uploaded successfully:', result.filename);
                // Refresh gallery to show new image
                await loadGalleryImages();
            } else {
                alert(`Upload failed: ${result.message || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Error uploading image:', error);
            alert('Failed to upload image. Please try again.');
        } finally {
            // Reset button state
            galleryUploadBtn.disabled = false;
            galleryUploadBtn.innerHTML = originalText;
            // Clear file input
            galleryUploadInput.value = '';
        }
    });
}

// Enter Analyze Mode: show selection and floating buttons
function enterAnalyzeMode() {
    // Clear any previously active image
    document.querySelectorAll('.image-item.active').forEach(el => el.classList.remove('active'));
    lastActiveFilename = null;

    analyzeModeActive = true;
    if (actionsButton) {
        actionsButton.innerHTML = `<i class="bi bi-x-lg"></i> Cancel`;
        actionsButton.classList.add('active');
    }
    // Ensure dropdown is shown when entering analyze mode
    if (actionsDropdown) {
        actionsDropdown.classList.add('show');
    }
    applyAnalyzeModeStyles();
}


// Exit Analyze Mode: hide buttons and optionally clear selection
export function exitAnalyzeMode(options = { clearSelection: true }) {
    analyzeModeActive = false;
    if (actionsButton) {
        actionsButton.innerHTML = '<i class="bi bi-check2-square"></i> Select Images';
        actionsButton.classList.remove('active');
    }
    if (actionsDropdown) {
        actionsDropdown.classList.remove('show');
    }
    if (dropdownDeleteBtn) dropdownDeleteBtn.innerHTML = '<i class="bi bi-trash"></i> Delete';
    applyAnalyzeModeStyles();
    if (options.clearSelection) clearSelection();
}

if (dropdownAnalyzeBtn) {
    dropdownAnalyzeBtn.addEventListener('click', async (event) => {
        event.stopPropagation();
        
        // Close dropdown when action is clicked
        if (actionsDropdown) {
            actionsDropdown.classList.remove('show');
        }

        if (!selectedImageFilenames.size) {
            alert('Please select at least one image to analyze.');
            return;
        }

        const filenames = Array.from(selectedImageFilenames);
        const imagesToAnalyze = filenames
            .map(filename => filteredGalleryImages.find(img => img.filename === filename) || allGalleryImages.find(img => img.filename === filename))
            .filter(Boolean);

        if (!imagesToAnalyze.length) {
            alert('Selected images are no longer available.');
            exitAnalyzeMode();
            return;
        }

        if (imagesToAnalyze.length > 1) {
            console.warn('Multiple images selected; only the first image will be prepared for analysis.');
        }

        const targetImage = imagesToAnalyze[0];

        exitAnalyzeMode();

        // Function to open analysis page and run callback
        function openAnalysisPage(callback) {
            const analysisPage = document.getElementById('analysisPage');
            const analysisBtn = document.getElementById('analysisBtn');
            
            if (!analysisPage) {
                console.error('Analysis page not found');
                if (callback) callback();
                return;
            }
            
            // Use the analysis button click to trigger proper page switching with animations
            if (analysisBtn) {
                // Store callback to be executed after page is shown
                window._analysisPageCallback = callback;
                
                // Trigger the button click which will show the page
                // The callback will be handled in the analysisBtn click handler
                analysisBtn.click();
            } else {
                // Fallback: manually show the page
                const homePage = document.getElementById('homePage');
                const galleryPage = document.getElementById('galleryPage');
                const pages = [homePage, galleryPage, analysisPage];
                pages.forEach(page => {
                    if (page && page !== analysisPage) {
                        page.style.display = 'none';
                    }
                });
                analysisPage.style.display = 'flex';
                analysisPage.style.opacity = '1';
                
                // Run callback after a short delay
                setTimeout(() => {
                    if (callback) {
                        callback();
                    }
                }, 300);
            }
        }
        
        openAnalysisPage(async () => {
            try {
                // Wait a bit longer to ensure analysis page is fully rendered
                await new Promise(resolve => setTimeout(resolve, 200));
                
                // Verify analysis page elements exist before proceeding
                const uploadArea = document.getElementById('imageUploadArea');
                const previewImage = document.getElementById('previewImage');
                
                if (!uploadArea || !previewImage) {
                    throw new Error('Analysis page elements not ready. Please try again.');
                }
                
                await displayImageFromGallery(targetImage);
                
                // Ensure a model is selected before auto-analyzing
                if (!window.selectedModel) {
                    // Set default model to YoloV8n if none selected
                    window.selectedModel = 'YoloV8n';
                    const dropdownButton = document.getElementById('dropdownButton');
                    if (dropdownButton) {
                        dropdownButton.innerHTML = `YoloV8n <span>▼</span>`;
                    }
                    console.log('No model selected, defaulting to YoloV8n');
                }
                
                // Wait for image to load before auto-analyzing
                await new Promise((resolve) => {
                    const img = document.getElementById('previewImage');
                    if (img.complete) {
                        resolve();
                    } else {
                        img.onload = resolve;
                        img.onerror = () => {
                            console.error('Image failed to load');
                            resolve(); // Continue anyway
                        };
                        // Timeout after 5 seconds
                        setTimeout(resolve, 5000);
                    }
                });
                
                // Small delay to ensure everything is ready
                setTimeout(() => {
                    autoAnalyzeSelectedImage();
                }, 300);
            } catch (error) {
                console.error('Failed to prepare selected image for analysis:', error);
                alert(`Unable to load the selected image for analysis: ${error.message || 'Unknown error'}. Please try again.`);
            }
        });
    });
}

if (dropdownDeleteBtn) {
    dropdownDeleteBtn.addEventListener('click', async (event) => {
        event.stopPropagation();
        
        // Close dropdown when action is clicked
        if (actionsDropdown) {
            actionsDropdown.classList.remove('show');
        }

        let imagesToDelete = [];

        if (analyzeModeActive) {
            // In analyze mode: delete selected images
            if (!selectedImageFilenames.size) {
                alert('Please select at least one image to delete.');
                return;
            }

            const filenames = Array.from(selectedImageFilenames);
            imagesToDelete = filenames
                .map(filename => filteredGalleryImages.find(img => img.filename === filename) || allGalleryImages.find(img => img.filename === filename))
                .filter(Boolean);

            if (!imagesToDelete.length) {
                alert('Selected images are no longer available.');
                return;
            }
        } else {
            // In normal mode: delete the currently active image
            if (!lastActiveFilename) {
                alert('Please select an image to delete.');
                return;
            }

            const activeImage = filteredGalleryImages.find(img => img.filename === lastActiveFilename) || 
                               allGalleryImages.find(img => img.filename === lastActiveFilename);
            
            if (!activeImage) {
                alert('Selected image is no longer available.');
                return;
            }

            imagesToDelete = [activeImage];
        }

        const imageCount = imagesToDelete.length;
        const confirmMessage = imageCount === 1 
            ? `Are you sure you want to delete this image? This action cannot be undone.`
            : `Are you sure you want to delete ${imageCount} images? This action cannot be undone.`;

        if (!confirm(confirmMessage)) {
            return;
        }

        // Disable button during deletion
        dropdownDeleteBtn.disabled = true;
        const originalText = dropdownDeleteBtn.innerHTML;
        dropdownDeleteBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Deleting...';

        try {
            // Delete all selected images
            const deletePromises = imagesToDelete.map(async (image) => {
                try {
                    const response = await fetch(`http://localhost:5001/images/${image.filename}`, {
                        method: 'DELETE'
                    });
                    const result = await response.json();
                    if (!result.success) {
                        console.error(`Failed to delete ${image.filename}:`, result.message);
                        return { success: false, filename: image.filename, error: result.message };
                    }
                    return { success: true, filename: image.filename };
                } catch (error) {
                    console.error(`Error deleting ${image.filename}:`, error);
                    return { success: false, filename: image.filename, error: error.message };
                }
            });

            const results = await Promise.all(deletePromises);
            const successful = results.filter(r => r.success);
            const failed = results.filter(r => !r.success);

            if (failed.length > 0) {
                console.warn('Some images failed to delete:', failed);
                if (successful.length === 0) {
                    alert('Failed to delete images. Please try again.');
                } else {
                    alert(`Deleted ${successful.length} image(s). ${failed.length} image(s) could not be deleted.`);
                }
            } else {
                console.log(`Successfully deleted ${successful.length} image(s)`);
            }

            // Refresh gallery
            if (analyzeModeActive) {
                exitAnalyzeMode();
            }
            await loadGalleryImages();
        } catch (error) {
            console.error('Error during deletion:', error);
            alert('An error occurred while deleting images. Please try again.');
        } finally {
            // Re-enable button
            dropdownDeleteBtn.disabled = false;
            dropdownDeleteBtn.innerHTML = originalText;
        }
    });
}

// Function to handle click selection with Shift/Ctrl
function selectImage(e, imageDataOverride = null) {
    if (!imageGrid) return;
    e.stopPropagation();

    const images = Array.from(imageGrid.querySelectorAll('.image-item'));
    const currentIndex = images.indexOf(e.currentTarget);

    if (currentIndex === -1) return;

    if (e.ctrlKey || e.metaKey) {
        e.currentTarget.classList.toggle('selected');
        if (e.currentTarget.classList.contains('selected')) {
            images.forEach(img => img.classList.remove('last-selected'));
            e.currentTarget.classList.add('last-selected');
            lastSelectedIndex = currentIndex;
            lastSelectedFilename = e.currentTarget.dataset.filename || null;
        } else {
            e.currentTarget.classList.remove('last-selected');
            if ((e.currentTarget.dataset.filename || null) === lastSelectedFilename) {
                lastSelectedIndex = null;
                lastSelectedFilename = null;
            }
        }
    } else if (e.shiftKey && lastSelectedIndex !== null) {
        const [start, end] = currentIndex > lastSelectedIndex ? [lastSelectedIndex, currentIndex] : [currentIndex, lastSelectedIndex];
        images.forEach(img => img.classList.remove('last-selected'));
        for (let i = start; i <= end; i++) {
            images[i].classList.add('selected');
        }
        const lastElement = images[currentIndex];
        lastElement.classList.add('last-selected');
        lastSelectedIndex = currentIndex;
        lastSelectedFilename = lastElement.dataset.filename || null;
    } else {
        images.forEach(img => img.classList.remove('selected', 'last-selected'));
        e.currentTarget.classList.add('selected', 'last-selected');
        lastSelectedIndex = currentIndex;
        lastSelectedFilename = e.currentTarget.dataset.filename || null;
    }

    syncSelectedState();

    const selectedElements = Array.from(imageGrid.querySelectorAll('.image-item.selected'));
    if (selectedElements.length === 1) {
        const lastSelectedElement = selectedElements[0];
        lastSelectedElement.classList.add('active');
        lastActiveFilename = lastSelectedElement.dataset.filename || null;
        const filename = lastSelectedElement.dataset.filename;
        const imageData = imageDataOverride || filteredGalleryImages.find(img => img.filename === filename) || allGalleryImages.find(img => img.filename === filename);
        if (imageData) {
            showImageDetails(imageData);
        }
    } else if (analyzeModeActive && selectedElements.length > 1) {
        lastActiveFilename = null;
        showSelectImagePlaceholder(`${selectedElements.length} images selected`);
    } else {
        lastActiveFilename = null;
        showSelectImagePlaceholder("Select an image");
    }
}

// Permanent listener for empty-space clicks
if (galleryColumn) {
    galleryColumn.addEventListener('click', (e) => {
        // Only clear if we didn't click on an image item
        if (!e.target.closest('.image-item')) {
            clearSelection(); // removes 'active' and selection
            const isMinimized = detailPane.classList.contains("minimized");
            if (!isMinimized) {
            // Minimize pane
            detailPane.classList.add("minimized");
            // leftColumn.style.flex = "3.5";
            galleryUploadBtn.style.right = "1rem";
             
        }
        }
    });
}