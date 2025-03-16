// Improved auth using GitHub Personal Access Token with storage fallbacks
// Save this as /infra-self-service/js/auth.js

// Storage utility functions with fallbacks
const storage = {
    token: null, // In-memory fallback
    
    getItem: function(key) {
        try {
            // Try session storage first
            return sessionStorage.getItem(key);
        } catch (e) {
            console.warn('Session storage access failed, using in-memory fallback:', e);
            // Fallback to in-memory
            return this.token;
        }
    },
    
    setItem: function(key, value) {
        try {
            // Try session storage first
            sessionStorage.setItem(key, value);
        } catch (e) {
            console.warn('Session storage access failed, using in-memory fallback:', e);
        }
        // Always set in-memory as well
        this.token = value;
    },
    
    removeItem: function(key) {
        try {
            // Try session storage first
            sessionStorage.removeItem(key);
        } catch (e) {
            console.warn('Session storage access failed:', e);
        }
        // Always clear in-memory
        this.token = null;
    }
};

// Get token from storage
let token = storage.getItem('github_token');
let userPermissions = null;

// DOM elements
let loginButton, logoutButton, usernameElement, loadingElement, resourceSelector, resultMessage;

// Initialize the application
function init() {
    console.log("Initializing improved PAT auth");
    
    // Get DOM elements safely
    try {
        loginButton = document.getElementById('login-button');
        logoutButton = document.getElementById('logout-button');
        usernameElement = document.getElementById('username');
        loadingElement = document.getElementById('loading');
        resourceSelector = document.getElementById('resource-selector');
        resultMessage = document.getElementById('result-message');
        
        // Check for missing elements
        if (!loginButton || !logoutButton || !usernameElement || !loadingElement || !resourceSelector || !resultMessage) {
            console.error("Required DOM elements not found. Make sure your HTML includes all needed elements.");
            return;
        }
    } catch (e) {
        console.error("Error accessing DOM elements:", e);
        return;
    }
    
    // Handle callback script that might have saved a code
    const savedCode = storage.getItem('github_auth_code');
    if (savedCode) {
        // Clear it immediately since we won't be using it
        storage.removeItem('github_auth_code');
        // Inform the user we're switching to PAT-based authentication
        showMessage('We\'ve updated our authentication method. Please use a GitHub Personal Access Token instead.', 'info');
    }
    
    // Clear any OAuth code from URL if present (from previous attempts)
    if (window.location.search.includes('code=')) {
        const url = new URL(window.location.href);
        url.search = '';
        window.history.replaceState({}, document.title, url.toString());
    }
    
    if (token) {
        // We already have a token
        console.log("Found existing token");
        showLoggedInState();
        fetchUserData();
    } else {
        // Not logged in
        console.log("No token found, showing logged out state");
        showLoggedOutState();
        // Don't immediately show the form - wait for the user to click login
    }

    // Set up event listeners
    loginButton.addEventListener('click', () => showTokenInputForm());
    logoutButton.addEventListener('click', logout);
}

// Show the token input form
function showTokenInputForm() {
    resultMessage.innerHTML = `
        <div class="token-form">
            <h3>Enter GitHub Personal Access Token</h3>
            <p>To use this application, you need a GitHub Personal Access Token with the following scopes:</p>
            <ul>
                <li><code>repo</code> - To access your repositories</li>
                <li><code>read:org</code> - To read your organization and team membership</li>
            </ul>
            
            <ol>
                <li>Go to <a href="https://github.com/settings/tokens/new" target="_blank">GitHub Personal Access Tokens</a></li>
                <li>Enter a note like "Infrastructure Self-Service Tool"</li>
                <li>Select the <code>repo</code> and <code>read:org</code> scopes</li>
                <li>Click "Generate token"</li>
                <li>Copy the generated token and paste it below</li>
            </ol>
            
            <div class="token-input">
                <input type="text" id="pat-input" placeholder="Paste your GitHub Personal Access Token here">
                <button id="submit-pat-button" class="btn">Login</button>
            </div>
        </div>
    `;
    
    document.getElementById('submit-pat-button').addEventListener('click', () => {
        const patInput = document.getElementById('pat-input');
        const inputToken = patInput.value.trim();
        
        if (inputToken) {
            // Store the token and proceed
            storage.setItem('github_token', inputToken);
            token = inputToken;
            resultMessage.innerHTML = '';
            showLoggedInState();
            fetchUserData();
        } else {
            patInput.classList.add('error');
        }
    });
}

// Fetch user info and team membership from GitHub API
async function fetchUserData() {
    showLoading('Loading your information...');
    
    try {
        // Fetch user information
        console.log("Fetching user data from GitHub API");
        const userResponse = await fetch('https://api.github.com/user', {
            headers: { Authorization: `token ${token}` }
        });
        
        if (!userResponse.ok) {
            console.error("GitHub API returned error:", userResponse.status);
            throw new Error('Failed to fetch user data');
        }
        
        const user = await userResponse.json();
        usernameElement.textContent = user.login;
        console.log("Authenticated as:", user.login);
        
        // Fetch user's teams
        console.log("Fetching teams data from GitHub API");
        const teamsResponse = await fetch('https://api.github.com/user/teams', {
            headers: { Authorization: `token ${token}` }
        });
        
        if (!teamsResponse.ok) {
            console.error("GitHub Teams API returned error:", teamsResponse.status);
            throw new Error('Failed to fetch teams data');
        }
        
        const teams = await teamsResponse.json();
        console.log('Teams from GitHub:', teams);
        const teamNames = teams.map(team => team.name);
        console.log('Team Names:', teamNames);
        
        // Determine user permissions based on team membership
        if (teamNames.includes('cie-team')) {
            userPermissions = 'admin';
            console.log('User has admin permissions');
        } else if (teamNames.includes('epo-team')) {
            userPermissions = 'contributor';
            console.log('User has contributor permissions');
        } else {
            userPermissions = 'viewer';
            console.log('User has viewer permissions');
        }
        
        // Load permissions from your GitHub Pages site
        loadPermissions();
    } catch (error) {
        console.error('Error fetching user data:', error);
        
        // If the token is invalid, log out
        if (error.message.includes('401') || error.message.includes('Failed to fetch')) {
            console.log('Invalid token, logging out');
            logout();
            showError('Invalid token. Please ensure your Personal Access Token has the required scopes (repo, read:org).');
        } else {
            showError('Failed to load user data. Please try again.');
        }
    } finally {
        hideLoading();
    }
}

// Load and parse the permissions YAML file, ensuring js-yaml is available
function loadPermissions() {
    // Check if js-yaml is loaded; if not, load it dynamically
    if (typeof jsyaml === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/js-yaml/4.1.0/js-yaml.min.js';
        script.onload = loadPermissions; // once loaded, re-run loadPermissions
        script.onerror = function() {
            console.error('Failed to load js-yaml library.');
        };
        document.head.appendChild(script);
        return;
    }
    
    // Fetch from your GH Pages site
    console.log("Loading permissions from YAML file");
    fetch('/infra-self-service/config/permissions.yml')
        .then(response => {
            if (!response.ok) {
                throw new Error(`Unable to fetch permissions file: ${response.status} ${response.statusText}`);
            }
            return response.text();
        })
        .then(yamlText => {
            const permissions = jsyaml.load(yamlText);
            console.log("Permissions loaded:", permissions);
            // Call the resource option loader from forms.js with the permissions object
            if (typeof loadResourceOptions === 'function') {
                loadResourceOptions(permissions);
            } else {
                console.error('loadResourceOptions function not found, make sure forms.js is loaded');
            }
        })
        .catch(error => {
            console.error('Error loading permissions file:', error);
            showError('Failed to load permissions configuration. Please try again later.');
        });
}

// Log the user out
function logout() {
    storage.removeItem('github_token');
    token = null;
    userPermissions = null;
    
    // Reset UI state
    showLoggedOutState();
    if (document.getElementById('resource-selector')) {
        document.getElementById('resource-selector').style.display = 'none';
    }
    if (document.getElementById('resource-form-container')) {
        document.getElementById('resource-form-container').style.display = 'none';
    }
    resultMessage.textContent = '';
}

// UI state management functions
function showLoggedInState() {
    loginButton.style.display = 'none';
    logoutButton.style.display = 'inline-block';
}

function showLoggedOutState() {
    loginButton.style.display = 'inline-block';
    logoutButton.style.display = 'none';
    usernameElement.textContent = 'Not logged in';
}

function showLoading(message = 'Loading...') {
    loadingElement.innerHTML = `
        <svg width="38" height="38" viewBox="0 0 38 38" xmlns="http://www.w3.org/2000/svg" stroke="#0e639c">
            <g fill="none" fill-rule="evenodd">
                <g transform="translate(1 1)" stroke-width="2">
                    <circle stroke-opacity=".5" cx="18" cy="18" r="18"/>
                    <path d="M36 18c0-9.94-8.06-18-18-18">
                        <animateTransform attributeName="transform" type="rotate" from="0 18 18" to="360 18 18" dur="1s" repeatCount="indefinite"/>
                    </path>
                </g>
            </g>
        </svg>
        <div style="margin-top: 10px;">${message}</div>
    `;
    loadingElement.style.display = 'flex';
}

function hideLoading() {
    loadingElement.style.display = 'none';
}

function showError(message) {
    resultMessage.innerHTML = `
        <div class="error-message">
            <h3>Error</h3>
            <p>${message}</p>
            <button id="try-again-button" class="btn">Try Again</button>
        </div>
    `;
    
    document.getElementById('try-again-button')?.addEventListener('click', () => {
        resultMessage.innerHTML = '';
        showTokenInputForm();
    });
}

function showMessage(message, type = 'info') {
    resultMessage.innerHTML = `
        <div class="message ${type}-message">
            <p>${message}</p>
            <button id="close-message-button" class="btn">OK</button>
        </div>
    `;
    
    document.getElementById('close-message-button')?.addEventListener('click', () => {
        resultMessage.innerHTML = '';
    });
}

// Initialize the application when the document is ready
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(init, 100); // Short delay to ensure DOM is fully available
} else {
    document.addEventListener('DOMContentLoaded', init);
}