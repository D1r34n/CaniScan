// ========================================
// analysis_page.js - Analysis Page Functionality
// ========================================

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
    // Initialize all analysis page features
    initializeAnalysisPage();
});

function initializeAnalysisPage() {
    setupTabs();
    setupClearHistoryButton();
    loadAnalysisHistory();
}

// ================================
// TAB SWITCHING FUNCTIONALITY
// ================================
function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const recommendationsTab = document.getElementById('recommendationsTab');
    const historyTab = document.getElementById('historyTab');
    
    if (!tabButtons.length || !recommendationsTab || !historyTab) {
        console.warn('Tab elements not found');
        return;
    }
    
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
                alert('Error clearing history. Please try again.');
            }
        }
    });
    
}

// ================================
// UTILITY FUNCTIONS
// ================================
function restoreChatInputClickability() {
    const chatInput = document.getElementById('chatInput');
    const chatInputArea = document.querySelector('.chat-input-area');
    const recommendationsBox = document.querySelector('.recommendations-box');
    
    if (chatInput) {
        chatInput.disabled = false;
        chatInput.style.pointerEvents = 'auto';
        chatInput.style.zIndex = '20';
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
        const popup = overlay.closest('.analysis-details-popup');
        if (!popup || !document.body.contains(popup)) {
            if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        }
    });
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
    restoreChatInputClickability
};
