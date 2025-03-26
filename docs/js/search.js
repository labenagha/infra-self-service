// search.js - Search and Pagination Functionality for Resource Cards

// Configuration
const ITEMS_PER_PAGE = 4; // 2x2 grid layout

// State variables
let allResourceCards = []; // Will hold all resource card elements
let filteredResourceCards = []; // Will hold filtered resource cards based on search
let currentPage = 1;

// Initialize search and pagination functionality
document.addEventListener('DOMContentLoaded', function() {
    // Set up search bar and pagination container
    setupUI();
    
    // Collect all existing resource cards on the page
    collectExistingResourceCards();
    
    // Set up search functionality
    const searchInput = document.getElementById('resource-search');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            searchResourceCards(this.value);
        });
    }
    
    // Clear search button
    const clearSearchBtn = document.getElementById('clear-search');
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', function() {
            document.getElementById('resource-search').value = '';
            searchResourceCards('');
        });
    }
    
    // Set up pagination event listeners
    document.getElementById('pagination-prev').addEventListener('click', function() {
        if (currentPage > 1) {
            currentPage--;
            renderResourceCards();
            updatePaginationUI();
        }
    });
    
    document.getElementById('pagination-next').addEventListener('click', function() {
        const totalPages = Math.ceil(filteredResourceCards.length / ITEMS_PER_PAGE);
        if (currentPage < totalPages) {
            currentPage++;
            renderResourceCards();
            updatePaginationUI();
        }
    });
    
    // Initial render
    renderResourceCards();
    updatePaginationUI();
});

// Set up the UI components for search and pagination
function setupUI() {
    // Find the container for resource cards
    const resourceContainer = document.querySelector('.resource-cards') || 
                             document.querySelector('.resource-list') ||
                             document.querySelector('.content');
    
    if (!resourceContainer) return;
    
    // Create a container for our UI if it doesn't exist
    if (!document.getElementById('resource-cards-container')) {
        // Create a container for the search bar
        const searchContainer = document.createElement('div');
        searchContainer.className = 'search-container';
        searchContainer.innerHTML = `
            <div class="search-input-wrapper">
                <svg class="search-icon" viewBox="0 0 24 24" width="18" height="18">
                    <path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                </svg>
                <input type="text" id="resource-search" placeholder="Search resources by name..." />
                <button id="clear-search" class="clear-search-button">
                    <svg viewBox="0 0 24 24" width="18" height="18">
                        <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                </button>
            </div>
            <div id="results-count" class="results-count">Showing all resources</div>
        `;
        
        // Create a container for the resource cards
        const cardsContainer = document.createElement('div');
        cardsContainer.id = 'resource-cards-container';
        cardsContainer.className = 'resource-cards-container';
        
        // Create pagination container
        const paginationContainer = document.createElement('div');
        paginationContainer.className = 'pagination-container';
        paginationContainer.innerHTML = `
            <button id="pagination-prev" class="pagination-button" disabled>
                <svg viewBox="0 0 24 24" width="16" height="16">
                    <path fill="currentColor" d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
                </svg>
                Previous
            </button>
            <span id="pagination-info" class="pagination-info">Page 1 of 1</span>
            <button id="pagination-next" class="pagination-button">
                Next
                <svg viewBox="0 0 24 24" width="16" height="16">
                    <path fill="currentColor" d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
                </svg>
            </button>
        `;
        
        // Insert the UI elements
        resourceContainer.prepend(searchContainer);
        
        // Replace the existing resource cards with our container
        const existingResourceCards = resourceContainer.querySelectorAll('.resource-card, .card');
        if (existingResourceCards.length > 0) {
            existingResourceCards[0].parentElement.replaceWith(cardsContainer);
        } else {
            resourceContainer.appendChild(cardsContainer);
        }
        
        resourceContainer.appendChild(paginationContainer);
    }
}

// Collect all existing resource cards from the page
function collectExistingResourceCards() {
    // Find all resource cards on the page
    const cardElements = document.querySelectorAll('.resource-card, .card');
    
    // Store original cards
    allResourceCards = Array.from(cardElements).map(card => {
        // Clone the card to preserve it
        return card.cloneNode(true);
    });
    
    // Initialize filtered cards with all cards
    filteredResourceCards = [...allResourceCards];
}

// Search resource cards by name
function searchResourceCards(query) {
    if (!query || query.trim() === '') {
        filteredResourceCards = [...allResourceCards];
    } else {
        query = query.toLowerCase().trim();
        filteredResourceCards = allResourceCards.filter(card => {
            // Get card title/name (could be in h3, h4, or specific element with a class)
            const title = card.querySelector('h3, h4, .card-title, .resource-name');
            if (!title) return false;
            
            return title.textContent.toLowerCase().includes(query);
        });
    }
    
    // Reset to first page when search changes
    currentPage = 1;
    
    // Update display
    renderResourceCards();
    updatePaginationUI();
}

// Render resource cards for current page
function renderResourceCards() {
    const resourceContainer = document.getElementById('resource-cards-container');
    if (!resourceContainer) return;
    
    // Clear current cards
    resourceContainer.innerHTML = '';
    
    // Calculate slice indexes for current page
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const currentPageCards = filteredResourceCards.slice(startIndex, endIndex);
    
    // Check if we have results
    if (currentPageCards.length === 0) {
        resourceContainer.innerHTML = '<div class="no-results">No resources found. Try a different search term.</div>';
        return;
    }
    
    // Create a row for every 2 cards (for 2x2 layout)
    for (let i = 0; i < currentPageCards.length; i += 2) {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'resource-row';
        
        // Add the first card in the row
        rowDiv.appendChild(currentPageCards[i].cloneNode(true));
        
        // Add the second card if it exists
        if (i + 1 < currentPageCards.length) {
            rowDiv.appendChild(currentPageCards[i + 1].cloneNode(true));
        }
        
        resourceContainer.appendChild(rowDiv);
    }
}

// Update pagination UI elements
function updatePaginationUI() {
    const totalPages = Math.ceil(filteredResourceCards.length / ITEMS_PER_PAGE);
    
    // Update page count text
    document.getElementById('pagination-info').textContent = 
        `Page ${currentPage} of ${totalPages || 1}`;
    
    // Update button states
    document.getElementById('pagination-prev').disabled = (currentPage <= 1);
    document.getElementById('pagination-next').disabled = (currentPage >= totalPages);
    
    // Update results count
    const totalResults = filteredResourceCards.length;
    const startItem = totalResults ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0;
    const endItem = Math.min(startItem + ITEMS_PER_PAGE - 1, totalResults);
    
    document.getElementById('results-count').textContent = 
        totalResults ? `Showing ${startItem}-${endItem} of ${totalResults} resources` : 'No resources found';
}

