# Infrastructure Self-Service Platform

## Architecture Overview

This solution provides a form-based interface for infrastructure requests while maintaining full auditability and permission controls without requiring new tools. It leverages GitHub Pages, GitHub Actions, and existing reusable workflows.

```
┌─────────────────────┐      ┌──────────────────┐      ┌───────────────────┐      ┌──────────────────┐
│                     │      │                  │      │                   │      │                  │
│  Self-Service UI    │──────▶  GitHub API      │──────▶  Approval Process │──────▶  Infra Creation  │
│  (GitHub Pages)     │      │  (Create PR)     │      │  (Pull Request)   │      │  (Your Workflow) │
│                     │      │                  │      │                   │      │                  │
└─────────────────────┘      └──────────────────┘      └───────────────────┘      └──────────────────┘
        ▲                                                       ▲
        │                                                       │
        │                    ┌──────────────────┐               │
        │                    │                  │               │
        └────────────────────│  Auth Service    │───────────────┘
                             │  (GitHub OAuth)  │
                             │                  │
                             └──────────────────┘
```

## Components

### 1. Self-Service Web UI (GitHub Pages)

A static web application hosted on GitHub Pages with a custom domain (e.g., `infra.yourcompany.com`).

### 2. Authentication & Authorization

Uses GitHub OAuth to authenticate users and determine their permissions based on team membership.

### 3. Request Processing

GitHub Actions workflow that validates requests, transforms them into infrastructure code, and executes your existing workflows.

### 4. Permission Model

Fine-grained control based on GitHub team membership, with specific roles for CIE and DEV teams.

## Implementation Details

### GitHub Repository Structure

```
/
infra-self-service/
|-- .github/
|   `-- workflows/
|       |-- infrastructure-request.yml
|       |-- permission-validation.yml
|       `-- your-existing-workflows.yml
|-- CNAME
|-- config/
|   |-- environments.yml
|   |-- permissions.yml
|   `-- resource-templates/
|       `-- service-bus/
|           `-- schema.json
|-- docs/
|   |-- css/
|   |   `-- styles.css
|   |-- index.html
|   `-- js/
|       |-- api.js
|       |-- auth.js
|       `-- forms.js
|-- scripts/
|   `-- generate-service-bus.sh
`-- infrastructure-self-service.md
```

### Permission Configuration

```yaml
# permissions.yml
teams:
  CIE-Team:
    role: admin
    environments: 
      - dev
      - test
      - prod
    resources:
      - ServiceBusTopic
      - SqlDatabase
      - AppService
      - StorageAccount
      - KeyVault
    approval_required: false
    
  DEV-Team:
    role: contributor
    environments:
      - dev
      - test
    resources:
      - ServiceBusTopic
      - AppService
    approval_required:
      dev: false
      test: true
      prod: true
    limitations:
      ServiceBusTopic:
        maxSizeInMegabytes: 1024
      AppService:
        skuTier: ["Basic", "Standard"]
```

## User Journeys

### DEV Team Member Request Flow

1. Developer navigates to `infra.yourcompany.com`
2. Authenticates with GitHub credentials
3. UI shows only the resource types they can create (ServiceBusTopic, AppService)
4. They select "ServiceBusTopic" and fill out a form
5. System validates input against their permission limits
6. Form submission creates a PR with appropriate YAML template
7. For dev environment: auto-approved and processed
8. For test environment: requires CIE team approval

### CIE Team Member Request Flow

1. CIE team member authenticates
2. UI shows all available resource types
3. They can create resources in any environment
4. Requests are automatically approved
5. They can also review and approve DEV team requests

## Technical Implementation

### 1. GitHub Pages UI Implementation

```html
<!-- index.html (simplified version) -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Infrastructure Self-Service Portal</title>
    <link rel="stylesheet" href="css/styles.css">
</head>
<body>
    <header>
        <h1>Infrastructure Self-Service Portal</h1>
        <div id="user-info">
            <span id="username">Not logged in</span>
            <button id="login-button">Login with GitHub</button>
            <button id="logout-button" style="display:none">Logout</button>
        </div>
    </header>
    
    <main>
        <div id="loading" style="display:none">Loading...</div>
        
        <div id="resource-selector" style="display:none">
            <h2>Select Resource Type</h2>
            <div id="resource-buttons"></div>
        </div>
        
        <div id="resource-form-container" style="display:none">
            <h2 id="form-title">Create Resource</h2>
            <form id="resource-form">
                <div id="form-fields"></div>
                <div id="environment-selector"></div>
                <button type="submit">Submit Request</button>
            </form>
        </div>
        
        <div id="result-message"></div>
    </main>
    
    <script src="js/auth.js"></script>
    <script src="js/forms.js"></script>
    <script src="js/api.js"></script>
</body>
</html>
```

### 2. Authentication Implementation

```javascript
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
```

### 3. GitHub Action for Processing Requests

```yaml
# .github/workflows/infrastructure-request.yml
name: Process Infrastructure Request

on:
  pull_request:
    paths:
      - 'requests/**/*.yml'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Get changed files
        id: changed-files
        uses: tj-actions/changed-files@v35
        with:
          files: requests/**/*.yml
          
      - name: Validate request permissions
        id: validate
        run: |
          REQUEST_FILE="${{ steps.changed-files.outputs.all_changed_files }}"
          REQUESTER="${{ github.event.pull_request.user.login }}"
          
          # Get team membership
          TEAMS=$(curl -s -H "Authorization: token ${{ secrets.GITHUB_TOKEN }}" \
            "https://api.github.com/users/$REQUESTER/teams" | jq -r '.[].name')
          
          # Check if user is in admin team
          if echo "$TEAMS" | grep -q "CIE-Team"; then
            echo "User is admin, approving request"
            echo "IS_ADMIN=true" >> $GITHUB_ENV
            exit 0
          fi
          
          # Parse request YAML
          RESOURCE_TYPE=$(yq -r '.kind' $REQUEST_FILE)
          ENVIRONMENT=$(yq -r '.metadata.environment' $REQUEST_FILE)
          
          # Check if DEV team can access this resource and environment
          if echo "$TEAMS" | grep -q "DEV-Team"; then
            # Check resource type permission
            ALLOWED_RESOURCES=$(yq -r '.teams."DEV-Team".resources[]' ./config/permissions.yml)
            if ! echo "$ALLOWED_RESOURCES" | grep -q "$RESOURCE_TYPE"; then
              echo "::error::User not allowed to create $RESOURCE_TYPE resources"
              exit 1
            fi
            
            # Check environment permission
            ALLOWED_ENVS=$(yq -r '.teams."DEV-Team".environments[]' ./config/permissions.yml)
            if ! echo "$ALLOWED_ENVS" | grep -q "$ENVIRONMENT"; then
              echo "::error::User not allowed to deploy to $ENVIRONMENT"
              exit 1
            fi
            
            # Check if approval required
            APPROVAL_REQUIRED=$(yq -r '.teams."DEV-Team".approval_required.'$ENVIRONMENT ./config/permissions.yml)
            if [ "$APPROVAL_REQUIRED" = "true" ]; then
              echo "REQUIRES_APPROVAL=true" >> $GITHUB_ENV
            else
              echo "REQUIRES_APPROVAL=false" >> $GITHUB_ENV
            fi
            
            echo "IS_ADMIN=false" >> $GITHUB_ENV
            exit 0
          fi
          
          echo "::error::User not in any authorized team"
          exit 1
          
      - name: Auto-approve if allowed
        if: env.IS_ADMIN == 'true' || env.REQUIRES_APPROVAL == 'false'
        uses: hmarr/auto-approve-action@v3
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          
      - name: Request review if needed
        if: env.REQUIRES_APPROVAL == 'true'
        run: |
          gh pr edit "${{ github.event.pull_request.number }}" --add-reviewer "CIE-Team"
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  deploy:
    needs: validate
    if: github.event.pull_request.merged == true
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Get changed files
        id: changed-files
        uses: tj-actions/changed-files@v35
        with:
          files: requests/**/*.yml
          
      - name: Generate infrastructure code
        run: |
          REQUEST_FILE="${{ steps.changed-files.outputs.all_changed_files }}"
          RESOURCE_TYPE=$(yq -r '.kind' $REQUEST_FILE)
          
          # Use resource type to select template
          case "$RESOURCE_TYPE" in
            "ServiceBusTopic")
              # Generate ARM/Terraform/etc. from request YAML
              ./scripts/generate-service-bus.sh "$REQUEST_FILE"
              ;;
            "AppService")
              ./scripts/generate-app-service.sh "$REQUEST_FILE"
              ;;
            *)
              echo "Unknown resource type: $RESOURCE_TYPE"
              exit 1
              ;;
          esac
      
      - name: Call your existing deployment workflow
        uses: benc-uk/workflow-dispatch@v1
        with:
          workflow: your-existing-workflow.yml
          inputs: '{"resourceType": "${{ env.RESOURCE_TYPE }}", "configPath": "${{ env.CONFIG_PATH }}"}'
```

### 4. Dynamic Form Generator

```javascript
// forms.js
function loadResourceOptions(permissions) {
    const resourceContainer = document.getElementById('resource-buttons');
    resourceContainer.innerHTML = '';
    
    // Determine available resources based on user permission
    let availableResources = [];
    if (userPermissions === 'admin') {
        availableResources = permissions.teams['CIE-Team'].resources;
    } else if (userPermissions === 'contributor') {
        availableResources = permissions.teams['DEV-Team'].resources;
    }
    
    // Create buttons for each resource type
    availableResources.forEach(resource => {
        const button = document.createElement('button');
        button.textContent = formatResourceName(resource);
        button.className = 'resource-button';
        button.addEventListener('click', () => loadResourceForm(resource, permissions));
        resourceContainer.appendChild(button);
    });
    
    document.getElementById('resource-selector').style.display = 'block';
}

function formatResourceName(camelCase) {
    return camelCase.replace(/([A-Z])/g, ' $1').trim();
}

function loadResourceForm(resourceType, permissions) {
    const formContainer = document.getElementById('form-fields');
    formContainer.innerHTML = '';
    
    document.getElementById('form-title').textContent = `Create ${formatResourceName(resourceType)}`;
    
    // Load resource-specific form fields
    fetch(`https://raw.githubusercontent.com/your-org/your-repo/main/config/resource-templates/${resourceType.toLowerCase()}/schema.json`)
        .then(response => response.json())
        .then(schema => {
            // Create form fields based on schema
            Object.entries(schema.properties).forEach(([fieldName, fieldConfig]) => {
                const fieldContainer = document.createElement('div');
                fieldContainer.className = 'form-field';
                
                const label = document.createElement('label');
                label.textContent = fieldConfig.title || formatResourceName(fieldName);
                label.setAttribute('for', fieldName);
                
                let input;
                if (fieldConfig.enum) {
                    input = document.createElement('select');
                    fieldConfig.enum.forEach(option => {
                        const optionElement = document.createElement('option');
                        optionElement.value = option;
                        optionElement.textContent = option;
                        input.appendChild(optionElement);
                    });
                } else if (fieldConfig.type === 'boolean') {
                    input = document.createElement('input');
                    input.type = 'checkbox';
                } else {
                    input = document.createElement('input');
                    input.type = fieldConfig.type === 'number' ? 'number' : 'text';
                    if (fieldConfig.default) {
                        input.value = fieldConfig.default;
                    }
                }
                
                input.id = fieldName;
                input.name = fieldName;
                
                // Apply limitations for contributor users
                if (userPermissions === 'contributor' && 
                    permissions.teams['DEV-Team'].limitations &&
                    permissions.teams['DEV-Team'].limitations[resourceType] &&
                    permissions.teams['DEV-Team'].limitations[resourceType][fieldName]) {
                    
                    const limitation = permissions.teams['DEV-Team'].limitations[resourceType][fieldName];
                    if (Array.isArray(limitation)) {
                        // For enum types, filter options
                        if (input.tagName === 'SELECT') {
                            Array.from(input.options).forEach(option => {
                                if (!limitation.includes(option.value)) {
                                    option.remove();
                                }
                            });
                        }
                    } else {
                        // For numeric limitations
                        input.max = limitation;
                    }
                }
                
                fieldContainer.appendChild(label);
                fieldContainer.appendChild(input);
                formContainer.appendChild(fieldContainer);
            });
            
            // Load environment selector
            loadEnvironmentSelector(resourceType, permissions);
            
            document.getElementById('resource-selector').style.display = 'none';
            document.getElementById('resource-form-container').style.display = 'block';
        })
        .catch(error => {
            console.error('Error loading form:', error);
            document.getElementById('result-message').textContent = `Error loading form for ${resourceType}`;
        });
}

function loadEnvironmentSelector(resourceType, permissions) {
    const envSelector = document.getElementById('environment-selector');
    envSelector.innerHTML = '<label>Target Environment:</label>';
    
    const select = document.createElement('select');
    select.id = 'environment';
    select.name = 'environment';
    
    // Get available environments based on permissions
    let environments = [];
    if (userPermissions === 'admin') {
        environments = permissions.teams['CIE-Team'].environments;
    } else if (userPermissions === 'contributor') {
        environments = permissions.teams['DEV-Team'].environments;
    }
    
    environments.forEach(env => {
        const option = document.createElement('option');
        option.value = env;
        option.textContent = env;
        select.appendChild(option);
    });
    
    envSelector.appendChild(select);
    
    // Add approval indication
    const approvalInfo = document.createElement('div');
    approvalInfo.className = 'approval-info';
    approvalInfo.innerHTML = '&nbsp;';
    
    select.addEventListener('change', () => {
        const selectedEnv = select.value;
        if (userPermissions === 'contributor' && 
            permissions.teams['DEV-Team'].approval_required &&
            permissions.teams['DEV-Team'].approval_required[selectedEnv]) {
            approvalInfo.textContent = '* Requires approval from CIE team';
        } else {
            approvalInfo.innerHTML = '&nbsp;';
        }
    });
    
    // Trigger initial display
    const event = new Event('change');
    select.dispatchEvent(event);
    
    envSelector.appendChild(approvalInfo);
}

// Set up form submission
document.getElementById('resource-form').addEventListener('submit', function(event) {
    event.preventDefault();
    submitResourceRequest();
});
```

### 5. GitHub API Integration

```javascript
// api.js
async function submitResourceRequest() {
    const form = document.getElementById('resource-form');
    const formData = new FormData(form);
    const resourceType = document.getElementById('form-title').textContent.replace('Create ', '').trim().replace(/\s+/g, '');
    
    // Show loading state
    document.getElementById('result-message').textContent = 'Submitting request...';
    document.getElementById('resource-form-container').style.display = 'none';
    document.getElementById('loading').style.display = 'block';
    
    try {
        // Convert form data to YAML
        const requestData = {
            kind: resourceType,
            metadata: {
                name: formData.get('name'),
                environment: formData.get('environment'),
                requestedBy: document.getElementById('username').textContent
            },
            spec: {}
        };
        
        // Add all other form fields to spec
        for (const [key, value] of formData.entries()) {
            if (key !== 'name' && key !== 'environment') {
                requestData.spec[key] = value;
            }
        }
        
        // Generate YAML (in production use proper YAML library)
        const yaml = convertToYaml(requestData);
        
        // Create a new branch
        const timestamp = new Date().getTime();
        const branchName = `request/${resourceType.toLowerCase()}-${timestamp}`;
        const mainRef = await getMainRef();
        
        await createBranch(branchName, mainRef);
        
        // Create file in the new branch
        const filePath = `requests/${resourceType.toLowerCase()}/${formData.get('name')}-${formData.get('environment')}.yml`;
        await createFile(filePath, yaml, branchName);
        
        // Create pull request
        const prTitle = `Request: ${resourceType} - ${formData.get('name')} (${formData.get('environment')})`;
        const prBody = `Infrastructure request by ${document.getElementById('username').textContent}\n\n` +
                      `Resource: ${resourceType}\n` +
                      `Name: ${formData.get('name')}\n` +
                      `Environment: ${formData.get('environment')}`;
        
        const prResponse = await createPullRequest(branchName, prTitle, prBody);
        
        // Show success message with PR link
        document.getElementById('result-message').innerHTML = `
            <div class="success-message">
                <h3>Request Submitted Successfully!</h3>
                <p>Your infrastructure request has been submitted as a pull request.</p>
                <p><a href="${prResponse.html_url}" target="_blank">View Pull Request #${prResponse.number}</a></p>
                <button id="new-request-button">Create Another Request</button>
            </div>
        `;
        
        document.getElementById('new-request-button').addEventListener('click', () => {
            document.getElementById('result-message').textContent = '';
            document.getElementById('resource-selector').style.display = 'block';
        });
        
    } catch (error) {
        console.error('Error submitting request:', error);
        document.getElementById('result-message').innerHTML = `
            <div class="error-message">
                <h3>Error Submitting Request</h3>
                <p>${error.message}</p>
                <button id="try-again-button">Try Again</button>
            </div>
        `;
        
        document.getElementById('try-again-button').addEventListener('click', () => {
            document.getElementById('result-message').textContent = '';
            document.getElementById('resource-form-container').style.display = 'block';
        });
    } finally {
        document.getElementById('loading').style.display = 'none';
    }
}

// GitHub API helper functions
async function getMainRef() {
    const response = await fetch('https://api.github.com/repos/your-org/your-repo/git/ref/heads/main', {
        headers: { Authorization: `token ${token}` }
    });
    const data = await response.json();
    return data.object.sha;
}

async function createBranch(branchName, sha) {
    const response = await fetch('https://api.github.com/repos/your-org/your-repo/git/refs', {
        method: 'POST',
        headers: { 
            Authorization: `token ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            ref: `refs/heads/${branchName}`,
            sha: sha
        })
    });
    
    return await response.json();
}

async function createFile(path, content, branch) {
    const response = await fetch(`https://api.github.com/repos/your-org/your-repo/contents/${path}`, {
        method: 'PUT',
        headers: { 
            Authorization: `token ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message: `Add infrastructure request for ${path}`,
            content: btoa(content),
            branch: branch
        })
    });
    
    return await response.json();
}

async function createPullRequest(branch, title, body) {
    const response = await fetch('https://api.github.com/repos/your-org/your-repo/pulls', {
        method: 'POST',
        headers: { 
            Authorization: `token ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            title: title,
            body: body,
            head: branch,
            base: 'main'
        })
    });
    
    return await response.json();
}

// Helper function to convert object to YAML (simplified)
function convertToYaml(obj) {
    // In production, use a proper YAML library
    let yaml = '';
    
    function addLine(key, value, indent = 0) {
        const indentation = ' '.repeat(indent);
        if (typeof value === 'object' && value !== null) {
            yaml += `${indentation}${key}:\n`;
            for (const [k, v] of Object.entries(value)) {
                addLine(k, v, indent + 2);
            }
        } else {
            yaml += `${indentation}${key}: ${value}\n`;
        }
    }
    
    for (const [key, value] of Object.entries(obj)) {
        addLine(key, value);
    }
    
    return yaml;
}
```
