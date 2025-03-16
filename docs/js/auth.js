// auth.js - Handles GitHub authentication with Azure Function for token exchange

// GitHub OAuth App credentials
const clientId = 'Iv23liYjrKuCgJRPT42k';
// The callback URL should match exactly what you configured in GitHub
const redirectUri = 'https://labenagha.github.io/infra-self-service/auth/github/callback';
// URL to your Azure Function - replace with your actual deployed function URL
const tokenExchangeUrl = 'https://exchange-token.azurewebsites.net/api/httpTrigger1';

// Check for existing token in session storage
let token = sessionStorage.getItem('github_token');
let userPermissions = null;

// DOM elements
const loginButton = document.getElementById('login-button');
const logoutButton = document.getElementById('logout-button');
const usernameElement = document.getElementById('username');
const loadingElement = document.getElementById('loading');
const resourceSelector = document.getElementById('resource-selector');
const resultMessage = document.getElementById('result-message');

// Initialize the application
function init() {
    // Check if we're on the callback URL with a fresh code
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    if (code) {
        console.log("OAuth code detected, processing login...");
        // Clean URL without affecting history state
        const url = new URL(window.location.href);
        url.search = '';
        window.history.replaceState({}, document.title, url.toString());
        
        // Exchange the code for a token immediately
        exchangeCodeForToken(code);
    } else if (token) {
        // We already have a token
        showLoggedInState();
        fetchUserData();
    } else {
        // Not logged in
        showLoggedOutState();
    }

    // Set up event listeners
    loginButton.addEventListener('click', initiateLogin);
    logoutButton.addEventListener('click', logout);
}

// Start the login process
function initiateLogin() {
    // Generate a state parameter for security
    const state = Math.random().toString(36).substring(2, 15);
    sessionStorage.setItem('github_oauth_state', state);
    
    // Redirect to GitHub authorization page
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo,read:org&state=${state}`;
    window.location.href = authUrl;
}

// Exchange the code for a token using our Azure Function
async function exchangeCodeForToken(code) {
    showLoading('Completing login...');
    
    try {
        console.log("Sending code to exchange function:", code);
        const response = await fetch(tokenExchangeUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ code })
        });
        
        console.log("Response status:", response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        // Try to get the raw text first
        const rawText = await response.text();
        console.log("Raw response:", rawText);
        
        // Then parse it as JSON if possible
        if (rawText) {
            try {
                const data = JSON.parse(rawText);
                
                if (data.error) {
                    throw new Error(data.error_description || data.error);
                }
                
                token = data.access_token;
                
                if (!token) {
                    console.error("No access token in response:", data);
                    throw new Error("No access token received");
                }
                
                // Store the token in session storage
                sessionStorage.setItem('github_token', token);
                
                // Update UI and fetch user data
                showLoggedInState();
                fetchUserData();
                
                // Show resource selector
                hideLoading();
                
            } catch (jsonError) {
                console.error("JSON parsing error:", jsonError);
                throw new Error(`Invalid JSON response: ${rawText}`);
            }
        } else {
            throw new Error("Empty response from server");
        }
    } catch (error) {
        console.error('Error exchanging token:', error);
        showError('Login failed: ' + error.message);
        hideLoading();
    }
}

// Fetch user info and team membership from GitHub API
async function fetchUserData() {
    showLoading('Loading your information...');
    
    try {
        // Fetch user information
        const userResponse = await fetch('https://api.github.com/user', {
            headers: { Authorization: `token ${token}` }
        });
        
        if (!userResponse.ok) {
            throw new Error('Failed to fetch user data');
        }
        
        const user = await userResponse.json();
        usernameElement.textContent = user.login;
        
        // Fetch user's teams
        const teamsResponse = await fetch('https://api.github.com/user/teams', {
            headers: { Authorization: `token ${token}` }
        });
        
        if (!teamsResponse.ok) {
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
        }
        
        showError('Failed to load user data. Please try again.');
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
    fetch('https://labenagha.github.io/infra-self-service/config/permissions.yml')
        .then(response => {
            if (!response.ok) {
                throw new Error(`Unable to fetch permissions file: ${response.status} ${response.statusText}`);
            }
            return response.text();
        })
        .then(yamlText => {
            const permissions = jsyaml.load(yamlText);
            // Call the resource option loader from forms.js with the permissions object
            loadResourceOptions(permissions);
        })
        .catch(error => {
            console.error('Error loading permissions file:', error);
        });
}

// Log the user out
function logout() {
    sessionStorage.removeItem('github_token');
    token = null;
    userPermissions = null;
    
    // Reset UI state
    showLoggedOutState();
    document.getElementById('resource-selector').style.display = 'none';
    document.getElementById('resource-form-container').style.display = 'none';
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
        showLoggedOutState();
    });
}

// Initialize the application
init();