// auth.js
const clientId = 'your-github-oauth-app-id';
const redirectUri = 'https://infra.yourcompany.com/callback';
let token = sessionStorage.getItem('github_token');
let userPermissions = null;

// Check if we're returning from auth
const code = new URLSearchParams(window.location.search).get('code');
if (code) {
    // Exchange code for token via serverless function
    // (GitHub OAuth requires a server component for the token exchange)
    fetch('https://your-exchange-function.azurewebsites.net/api/exchange-token', {
        method: 'POST',
        body: JSON.stringify({ code })
    })
    .then(response => response.json())
    .then(data => {
        token = data.access_token;
        sessionStorage.setItem('github_token', token);
        window.history.replaceState({}, document.title, '/');
        initializeApp();
    });
} else if (token) {
    initializeApp();
} else {
    document.getElementById('login-button').addEventListener('click', () => {
        window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=repo,read:org`;
    });
}

function initializeApp() {
    document.getElementById('login-button').style.display = 'none';
    document.getElementById('logout-button').style.display = 'block';
    document.getElementById('loading').style.display = 'block';
    
    // Fetch user info and teams
    Promise.all([
        fetch('https://api.github.com/user', { headers: { Authorization: `token ${token}` } }).then(r => r.json()),
        fetch('https://api.github.com/user/teams', { headers: { Authorization: `token ${token}` } }).then(r => r.json())
    ])
    .then(([user, teams]) => {
        document.getElementById('username').textContent = user.login;
        
        // Check if user is in CIE or DEV team
        const teamNames = teams.map(team => team.name);
        if (teamNames.includes('CIE-Team')) {
            userPermissions = 'admin';
        } else if (teamNames.includes('DEV-Team')) {
            userPermissions = 'contributor';
        } else {
            userPermissions = 'viewer';
        }
        
        // Fetch permission configuration
        return fetch('https://raw.githubusercontent.com/your-org/your-repo/main/config/permissions.yml');
    })
    .then(response => response.text())
    .then(yamlText => {
        // In production, use proper YAML parser
        // This is simplified for example
        const permissions = parseYaml(yamlText);
        loadResourceOptions(permissions);
    })
    .catch(error => {
        console.error('Error initializing app:', error);
        document.getElementById('result-message').textContent = 'Error initializing application. Please try again.';
    })
    .finally(() => {
        document.getElementById('loading').style.display = 'none';
    });
}

document.getElementById('logout-button').addEventListener('click', () => {
    sessionStorage.removeItem('github_token');
    window.location.reload();
});

// Helper function to parse YAML (simplified for example)
function parseYaml(yaml) {
    // In production, use js-yaml or another proper parser
    // This is just for illustration
    return {
        teams: {
            'CIE-Team': {
                role: 'admin',
                environments: ['dev', 'test', 'prod'],
                resources: ['ServiceBusTopic', 'SqlDatabase', 'AppService', 'StorageAccount', 'KeyVault'],
                approval_required: false
            },
            'DEV-Team': {
                role: 'contributor',
                environments: ['dev', 'test'],
                resources: ['ServiceBusTopic', 'AppService'],
                approval_required: {
                    dev: false,
                    test: true,
                    prod: true
                },
                limitations: {
                    ServiceBusTopic: {
                        maxSizeInMegabytes: 1024
                    },
                    AppService: {
                        skuTier: ['Basic', 'Standard']
                    }
                }
            }
        }
    };
}