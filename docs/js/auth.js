// Direct GitHub authentication without Azure Function intermediate
// Save this as auth-direct.js

// GitHub OAuth App credentials
const clientId = 'Ov23liiDQOjHrrvxTrVl';
const redirectUri = 'https://labenagha.github.io/infra-self-service/auth/github/callback';

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
    console.log("Initializing auth-direct.js");
    
    // Check if we're on the callback URL with a fresh code
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const savedState = sessionStorage.getItem('github_oauth_state');
    
    console.log("Current URL:", window.location.href);
    console.log("Have code in URL:", !!code);
    console.log("Have state in URL:", !!state);
    console.log("Have saved state:", !!savedState);
    console.log("Have token in session:", !!token);
    
    if (code) {
        console.log("OAuth code detected:", code.substring(0, 5) + "...");
        
        // Validate state if provided
        if (state && savedState && state !== savedState) {
            console.error("State mismatch, possible CSRF attack");
            showError("Security error: State parameter mismatch");
            return;
        }
        
        // Clean URL without affecting history state
        const url = new URL(window.location.href);
        url.search = '';
        window.history.replaceState({}, document.title, url.toString());
        
        // Clear saved state
        sessionStorage.removeItem('github_oauth_state');
        
        // IMPORTANT: We can't directly exchange the code for a token from the frontend
        // Instead, instruct the user what to do next with the code
        showCodeExchangeGuide(code);
    } else if (token) {
        // We already have a token
        console.log("Found existing token in session storage");
        showLoggedInState();
        fetchUserData();
    } else {
        // Not logged in
        console.log("No token found, showing logged out state");
        showLoggedOutState();
    }

    // Set up event listeners
    loginButton.addEventListener('click', initiateLogin);
    logoutButton.addEventListener('click', logout);
    
    // Add a token input form in the UI
    createTokenInputForm();
}

// Start the login process
function initiateLogin() {
    console.log("Initiating login process");
    
    // Generate a state parameter for security
    const state = Math.random().toString(36).substring(2, 15);
    sessionStorage.setItem('github_oauth_state', state);
    console.log("Generated state:", state);
    
    // Build authorization URL with all required parameters
    const authUrl = `https://github.com/login/oauth/authorize?` +
        `client_id=${encodeURIComponent(clientId)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=${encodeURIComponent('repo read:org')}` +
        `&state=${encodeURIComponent(state)}`;
    
    console.log("Redirecting to GitHub:", authUrl);
    window.location.href = authUrl;
}

// Show guide for manual code exchange
function showCodeExchangeGuide(code) {
    console.log("Showing code exchange guide");
    showLoading(false);
    
    resultMessage.innerHTML = `
        <div class="code-exchange-guide">
            <h3>Authentication Code Received</h3>
            <p>We received an authentication code from GitHub, but we need your help to complete the process:</p>
            
            <div class="code-display">
                <code>${code}</code>
                <button id="copy-code-button" class="btn">Copy Code</button>
            </div>
            
            <p>Please follow these steps:</p>
            <ol>
                <li>Go to <a href="https://github.com/settings/developers" target="_blank">GitHub Developer Settings</a></li>
                <li>Open your OAuth App (custom-self-service-tool)</li>
                <li>Use the code above with your client secret to get an access token</li>
                <li>Come back and enter the access token below</li>
            </ol>
            
            <div class="token-input">
                <label for="access-token">Access Token:</label>
                <input type="text" id="access-token" placeholder="Paste your access token here">
                <button id="submit-token-button" class="btn">Submit Token</button>
            </div>
        </div>
    `;
    
    // Set up event listeners
    document.getElementById('copy-code-button').addEventListener('click', () => {
        navigator.clipboard.writeText(code);
        document.getElementById('copy-code-button').textContent = 'Copied!';
    });
    
    document.getElementById('submit-token-button').addEventListener('click', () => {
        const tokenInput = document.getElementById('access-token');
        const inputToken = tokenInput.value.trim();
        
        if (inputToken) {
            // Store the token and proceed
            sessionStorage.setItem('github_token', inputToken);
            token = inputToken;
            showLoggedInState();
            fetchUserData();
        } else {
            tokenInput.classList.add('error');
        }
    });
}

// Create a simple form for directly inputting an access token
function createTokenInputForm() {
    const tokenForm = document.createElement('div');
    tokenForm.id = 'token-input-form';
    tokenForm.style.display = 'none';
    tokenForm.innerHTML = `
        <h3>Enter GitHub Access Token</h3>
        <p>If you already have a GitHub personal access token, you can enter it directly:</p>
        <div class="token-input">
            <input type="text" id="direct-access-token" placeholder="Paste your GitHub access token">
            <button id="direct-submit-token" class="btn">Use Token</button>
        </div>
    `;
    
    document.body.appendChild(tokenForm);
    
    // Add a link to show the form
    const tokenLink = document.createElement('a');
    tokenLink.href = '#';
    tokenLink.textContent = 'Use existing token';
    tokenLink.style.marginLeft = '10px';
    tokenLink.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('token-input-form').style.display = 'block';
    });
    
    loginButton.parentNode.appendChild(tokenLink);
    
    // Set up the submission handler
    document.getElementById('direct-submit-token').addEventListener('click', () => {
        const tokenInput = document.getElementById('direct-access-token');
        const inputToken = tokenInput.value.trim();
        
        if (inputToken) {
            // Store the token and proceed
            sessionStorage.setItem('github_token', inputToken);
            token = inputToken;
            document.getElementById('token-input-form').style.display = 'none';
            showLoggedInState();
            fetchUserData();
        } else {
            tokenInput.classList.add('error');
        }
    });
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
    if (message === false) {
        loadingElement.style.display = 'none';
        return;
    }
    
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