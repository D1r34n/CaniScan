// ================================
// GALLERY DETAIL MINIMIZE TOGGLE
// ================================
const detailPane = document.getElementById("detailPane");
const minimizeDetail = document.getElementById("minimizeDetail");
const leftColumn = document.querySelector(".gallery-left");

if (detailPane && minimizeDetail && leftColumn) {
    minimizeDetail.addEventListener("click", () => {
    const isMinimized = detailPane.classList.contains("minimized");
    if (isMinimized) {
        detailPane.classList.remove("minimized");
        // leftColumn.style.flex = "3.5";
        minimizeDetail.innerHTML = "<i class='bi bi-layout-text-sidebar-reverse'></i> Hide Details";
    } else {
        detailPane.classList.add("minimized");
        // leftColumn.style.flex = "3.5";
        minimizeDetail.innerHTML = "<i class='bi bi-layout-text-sidebar-reverse'></i> Show Details";
    }
    });
}

// ================================
// GALLERY IMAGE LOADING
// ================================
const imageGrid = document.querySelector(".gallery-left .image-grid");
const refreshButton = document.getElementById('refreshButton');
const sortAnalyzed = document.getElementById('sortAnalyzed');
const sortRaw = document.getElementById('sortRaw');
const sortDermatitis = document.getElementById('sortDermatitis');
const sortMange = document.getElementById('sortMange');
const sortHotspot = document.getElementById('sortHotspot');
const sortHealthy = document.getElementById('sortHealthy');
const sortCheckboxes = [
    sortAnalyzed,
    sortRaw,
    sortDermatitis,
    sortMange,
    sortHotspot,
    sortHealthy
].filter(Boolean);

sortCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', () => {
    renderGalleryImages();
    });
});

let refreshInterval = 60000; // 60 seconds
let countdown = refreshInterval / 1000; // in seconds
let countdownTimer;

export let analyzeModeActive = false;
let allGalleryImages = [];
let filteredGalleryImages = [];
let selectedImageFilenames = new Set();
let lastSelectedFilename = null;
let lastSelectedIndex = null;
let lastActiveFilename = null;
let analysisPageInitialized = false;

window.currentAnalysisSource = null;

// Load gallery images from server
export async function loadGalleryImages() {
    if (!imageGrid) return;

    try {
    const response = await fetch('http://localhost:5001/images');
    const data = await response.json();

    if (data.success) {
        allGalleryImages = Array.isArray(data.images) ? data.images : [];
        renderGalleryImages();
    } else {
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

function applyGalleryFilters(images, filters) {
    if (!filters.statuses.length && !filters.diseases.length) {
    return [...images];
    }

    return images.filter(image => {
    const imageStatus = image.analyzed ? 'analyzed' : 'raw';
    const imageDisease = (image.disease || '').toLowerCase();

    const statusMatches = !filters.statuses.length || filters.statuses.includes(imageStatus);
    const diseaseMatches = !filters.diseases.length || filters.diseases.includes(imageDisease);

    return statusMatches && diseaseMatches;
    });
}

function renderGalleryImages() {
    if (!imageGrid) return;

    const filters = getActiveGalleryFilters();
    const filtered = applyGalleryFilters(allGalleryImages, filters);
    filteredGalleryImages = filtered;

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
    if (typeof image.size !== 'undefined') {
        div.dataset.size = image.size;
    }

        if (image.analyzed) {
            div.classList.add('analyzed');
        }

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

    if (selectedImageFilenames.has(image.filename)) {
        div.classList.add('selected');
    }

    if (image.filename === lastSelectedFilename) {
        div.classList.add('last-selected');
        lastSelectedIndex = index;
    }

    if (image.filename === lastActiveFilename) {
            div.classList.add('active');
    }

    div.addEventListener('click', (event) => handleImageItemClick(event, image));

    imageGrid.appendChild(div);
    });

    applyAnalyzeModeStyles();

    if (analyzeModeActive && lastSelectedFilename) {
    const imageData = filtered.find(img => img.filename === lastSelectedFilename);
    if (imageData) {
        showImageDetails(imageData);
    }
    } else if (!analyzeModeActive && lastActiveFilename) {
    const imageData = filtered.find(img => img.filename === lastActiveFilename);
    if (imageData) {
        showImageDetails(imageData);
    }
    }

    syncSelectedState();
}

function applyAnalyzeModeStyles() {
    if (!imageGrid) return;
    const items = Array.from(imageGrid.querySelectorAll('.image-item'));
    items.forEach(item => {
    if (analyzeModeActive) {
        item.classList.add('selectable');
    } else {
        item.classList.remove('selectable');
    }
    });
}

function handleImageItemClick(event, image) {
    event.stopPropagation();

    if (analyzeModeActive) {
    selectImage(event, image);
    } else {
    document.querySelectorAll('.image-item.active').forEach(el => el.classList.remove('active'));
    event.currentTarget.classList.add('active');
    lastActiveFilename = image.filename;
    showImageDetails(image);
    }
}

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

function syncSelectedState() {
    if (!imageGrid) return;
    selectedImageFilenames = new Set(
    Array.from(imageGrid.querySelectorAll('.image-item.selected')).map(el => el.dataset.filename)
    );
}

function showImageDetails(image) {
    const detailPane = document.getElementById("detailPane");
    if (!detailPane || !image) return;

    lastActiveFilename = image.filename || null;
    
    // Remove minimized class to show details
    detailPane.classList.remove('minimized');

    // Parse date and time from uploaded_at
    const uploadedDate = image.uploaded_at ? new Date(image.uploaded_at) : null;
    const dateStr = uploadedDate ? uploadedDate.toLocaleDateString() : 'N/A';
    const timeStr = uploadedDate ? uploadedDate.toLocaleTimeString() : 'N/A';
    
    // Format file size
    const sizeKB = image.size ? Math.round(image.size / 1024) : 0;
    const sizeStr = sizeKB > 0 ? `${sizeKB} KB` : 'Unknown';
    
    // Check if analyzed
    const isAnalyzed = image.analyzed || false;
    const diagnosis = image.disease || 'N/A';
    const confidence = image.confidence || '0';
    
    // Create analysis status badge
    const analysisStatus = isAnalyzed 
    ? `<span class="status-badge analyzed-status"><i class="bi bi-check-circle-fill"></i> Analyzed</span>`
    : `<span class="status-badge raw-status"><i class="bi bi-circle"></i> Raw (Not Analyzed)</span>`;

    const detailContent = detailPane.querySelector('.detail-content');
    if (detailContent) {
    // Use diagnosis name if analyzed, otherwise show "Not Analyzed"
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
        </div>
        ` : ''}
        </div>
    `;
    }
}


let lastAnalyzeState = false; // remember previous state

// Manual refresh
if (refreshButton) {
    refreshButton.addEventListener('click', () => {
    if (analyzeModeActive) {
        console.log("⚠️ Refresh disabled during Analyze Mode.");
        return; // 🚫 stop here, no refresh
    }
    loadGalleryImages();
    });
}

const analyzeModeButton = document.getElementById('analyzeModeButton');
const analyzeSelected = document.getElementById('analyzeFloatingButton');
const deleteSelected = document.getElementById('deleteFloatingButton');
const galleryColumn = document.querySelector('.gallery-columns');

function enterAnalyzeMode() {
    analyzeModeActive = true;
    if (analyzeModeButton) {
        analyzeModeButton.innerHTML = `<i class="bi bi-x-lg"></i> Cancel`;
        analyzeModeButton.classList.add('active');
    }
    if (analyzeSelected) {
        analyzeSelected.style.display = "block";
    }
    if (deleteSelected) {
        deleteSelected.style.display = "block";
    }
    applyAnalyzeModeStyles();
    if (galleryColumn) {
        galleryColumn.addEventListener('click', clearSelectionOnEmpty);
    }
}

export function exitAnalyzeMode(options = { clearSelection: true }) {
    analyzeModeActive = false;
    if (analyzeModeButton) {
        analyzeModeButton.innerHTML = '<i class="bi bi-box-arrow-in-down"></i> Analyze Images';
        analyzeModeButton.classList.remove('active');
    }
    if (analyzeSelected) {
        analyzeSelected.style.display = "none";
    }
    if (deleteSelected) {
        deleteSelected.style.display = "none";
    }
    applyAnalyzeModeStyles();
    if (galleryColumn) {
        galleryColumn.removeEventListener('click', clearSelectionOnEmpty);
    }
    if (options.clearSelection) {
        clearSelection();
    }
}

if (analyzeModeButton) {
    analyzeModeButton.addEventListener('click', () => {
        if (analyzeModeActive) {
            exitAnalyzeMode();
        } else {
            enterAnalyzeMode();
        }
    });
}

if (analyzeSelected) {
    analyzeSelected.addEventListener('click', async (event) => {
        event.stopPropagation();

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

        openAnalysisPage(async () => {
            try {
                await displayImageFromGallery(targetImage);
                setTimeout(() => {
                    autoAnalyzeSelectedImage();
                }, 200);
            } catch (error) {
                console.error('Failed to prepare selected image for analysis:', error);
                alert('Unable to load the selected image for analysis. Please try again.');
            }
        });
    });
}

if (deleteSelected) {
    deleteSelected.addEventListener('click', async (event) => {
        event.stopPropagation();

        if (!selectedImageFilenames.size) {
            alert('Please select at least one image to delete.');
            return;
        }

        const filenames = Array.from(selectedImageFilenames);
        const imageCount = filenames.length;
        const confirmMessage = imageCount === 1 
            ? `Are you sure you want to delete this image? This action cannot be undone.`
            : `Are you sure you want to delete ${imageCount} images? This action cannot be undone.`;

        if (!confirm(confirmMessage)) {
            return;
        }

        const imagesToDelete = filenames
            .map(filename => filteredGalleryImages.find(img => img.filename === filename) || allGalleryImages.find(img => img.filename === filename))
            .filter(Boolean);

        if (!imagesToDelete.length) {
            alert('Selected images are no longer available.');
            exitAnalyzeMode();
            return;
        }

        // Disable button during deletion
        deleteSelected.disabled = true;
        deleteSelected.innerHTML = '<i class="bi bi-hourglass-split"></i> Deleting...';

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

            // Refresh gallery and exit analyze mode
            exitAnalyzeMode();
            await loadGalleryImages();
        } catch (error) {
            console.error('Error during deletion:', error);
            alert('An error occurred while deleting images. Please try again.');
        } finally {
            // Re-enable button
            deleteSelected.disabled = false;
            deleteSelected.innerHTML = '<i class="bi bi-trash"></i> Delete Selected';
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

    document.querySelectorAll('.image-item.active').forEach(el => el.classList.remove('active'));
    const lastSelectedElement = imageGrid.querySelector('.image-item.last-selected');
    if (lastSelectedElement) {
        lastSelectedElement.classList.add('active');
        lastActiveFilename = lastSelectedElement.dataset.filename || null;
        const filename = lastSelectedElement.dataset.filename;
        const imageData = imageDataOverride || filteredGalleryImages.find(img => img.filename === filename) || allGalleryImages.find(img => img.filename === filename);
        if (imageData) {
            showImageDetails(imageData);
        }
    } else {
        lastActiveFilename = null;
    }
}

// Clear selection when clicking empty space
function clearSelectionOnEmpty(e) {
    if (!e.target.closest('.image-item')) {
        clearSelection();
    }
}

// Gallery upload button functionality
const galleryUploadBtn = document.getElementById('galleryUploadBtn');
const galleryUploadInput = document.getElementById('galleryUploadInput');

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