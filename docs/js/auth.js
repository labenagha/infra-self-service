// auth.js - Handles GitHub authentication with Azure Function for token exchange
// Make sure to include js-yaml in your HTML:
// <script src="https://cdnjs.cloudflare.com/ajax/libs/js-yaml/4.1.0/js-yaml.min.js"></script>

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
    // Check if we're on the callback URL or have a stored auth code
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code') || sessionStorage.getItem('github_auth_code');
    
    if (code) {
        // Clear the stored auth code if it exists
        sessionStorage.removeItem('github_auth_code');
        
        // We have a code from GitHub OAuth redirect
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
    // Redirect to GitHub authorization page
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo,read:org`;
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
        
        // Try to get the raw text first
        const rawText = await response.text();
        console.log("Raw response:", rawText);
        
        // Then parse it as JSON if possible
        if (rawText) {
            try {
                const data = JSON.parse(rawText);
                token = data.access_token;
                
                if (!token) {
                    console.error("No access token in response:", data);
                    throw new Error("No access token received");
                }
                
                // Store the token in session storage
                sessionStorage.setItem('github_token', token);
                
                // Redirect to the main page
                window.location.href = '/infra-self-service/';
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
        // Wait 3 seconds then redirect to main page
        setTimeout(() => {
            window.location.href = '/infra-self-service/';
        }, 3000);
    } finally {
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
        const teamNames = teams.map(team => team.name);
        
        // Determine user permissions based on team membership
        if (teamNames.includes('CIE-Team')) {
            userPermissions = 'admin';
            console.log('User has admin permissions');
        } else if (teamNames.includes('DEV-Team')) {
            userPermissions = 'contributor';
            console.log('User has contributor permissions');
        } else {
            userPermissions = 'viewer';
            console.log('User has viewer permissions');
        }
        
        // Instead of directly calling loadResourceOptions(), load permissions from the YAML file
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

// New function to load and parse the permissions YAML file, then call loadResourceOptions with it
function loadPermissions() {
    fetch('permissions.yml')
        .then(response => response.text())
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
        </div>
    `;
}

// Initialize the application
init();
