## Getting Started

### Prerequisites

- GitHub repository with GitHub Pages enabled
- Service principal with required permissions in Azure
- GitHub Personal Access Token with `repo` and `read:org` scopes

### Setup

1. Configure your GitHub repository:
   - Enable GitHub Pages for the `docs/` directory
   - Add the necessary Terraform configurations in the `modules/` directory
   - Configure the GitHub Actions secrets for Azure credentials

2. Update the repository references in the code:
   - Set your repository details in `auth.js`
   - Update API endpoints in `servicebus-api.js` and `storage-account-api.js`

3. Deploy the application:
   - Push the code to your repository
   - Configure GitHub Pages to serve from the `docs/` directory

4. Users will need to:
   - Create a GitHub Personal Access Token with `repo` and `read:org` scopes
   - Enter this token when accessing the self-service portal# Infrastructure Self-Service Platform

## Architecture Overview

This solution provides a form-based interface for infrastructure requests while maintaining full auditability and permission controls without requiring new tools. It leverages GitHub Pages and directly triggers GitHub Actions workflows to provision resources, using GitHub Personal Access Tokens for authentication and authorization.

```
┌─────────────────────┐      ┌──────────────────┐                     ┌──────────────────┐
│                     │      │                  │                     │                  │
│  Self-Service UI    │──────▶  GitHub API      │────────────────────▶ Infra Creation   │
│  (GitHub Pages)     │      │  (Workflow       │                     │  (GitHub Actions │
│                     │      │   Dispatch)      │                     │   Workflow)      │
└─────────────────────┘      └──────────────────┘                     └──────────────────┘
        ▲                             ▲
        │                             │
        │                             │
        │                             │
        │                             │
        └─────────────────────────────┘
             GitHub Personal Access Token
             (For Authentication & API Access)
```

## Components

### 1. Self-Service Web UI (GitHub Pages)

A static web application hosted on GitHub Pages that provides a user-friendly interface for infrastructure requests. The UI dynamically renders forms based on resource type and user permissions.

**Key Code Example:**
```javascript
// Dynamic form generation based on resource schema
function loadResourceForm(resourceType, permissions) {
  const formContainer = document.getElementById("form-fields");
  formContainer.innerHTML = "";

  document.getElementById("form-title").textContent = 
    `Create ${formatResourceName(resourceType)}`;

  // Fetch schema from GitHub Pages
  fetch(`https://labenagha.github.io/infra-self-service/config/resource-templates/${resourceType.toLowerCase()}/schema.json`)
    .then((response) => response.json())
    .then((schema) => {
      // Create form fields based on schema
      Object.entries(schema.properties).forEach(([fieldName, fieldConfig]) => {
        const fieldContainer = document.createElement("div");
        fieldContainer.className = "form-field";

        // Create label
        const label = document.createElement("label");
        label.textContent = fieldConfig.title || formatResourceName(fieldName);
        label.setAttribute("for", fieldName);

        // Create appropriate input based on field type
        let input = createInputElement(fieldName, fieldConfig);
        
        // Apply permissions-based limitations
        applyPermissionLimitations(input, fieldName, resourceType, permissions);
        
        fieldContainer.appendChild(label);
        fieldContainer.appendChild(input);
        formContainer.appendChild(fieldContainer);
      });
    });
}
```

### 2. GitHub PAT Authentication

The platform uses GitHub Personal Access Tokens (PATs) for authentication and API access:

**Key Code Example:**
```javascript
// PAT-based authentication from auth.js
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
        }
    });
}

// Fetch user info and team membership from GitHub API
async function fetchUserData() {
    try {
        // Fetch user information
        const userResponse = await fetch('https://api.github.com/user', {
            headers: { Authorization: `token ${token}` }
        });
        
        const user = await userResponse.json();
        
        // Fetch user's teams
        const teamsResponse = await fetch('https://api.github.com/user/teams', {
            headers: { Authorization: `token ${token}` }
        });
        
        const teams = await teamsResponse.json();
        const teamNames = teams.map(team => team.name);
        
        // Determine user permissions based on team membership
        if (teamNames.includes('cie-team')) {
            userPermissions = 'admin';
        } else if (teamNames.includes('epo-team')) {
            userPermissions = 'contributor';
        } else {
            userPermissions = 'viewer';
        }
    } catch (error) {
        console.error('Error fetching user data:', error);
    }
}
```

### 3. Permission Model

Fine-grained control based on GitHub team membership with specific roles, environment access, and resource limitations.

**Key Code Example:**
```yaml
# permissions.yml - Role-based permissions configuration
teams:
  cie-team:
    role: admin
    environments:
      - dev
      - test
    resources:
      - ServiceBusTopic
      - StorageAccount
    approval_required: false

  epo-team:
    role: contributor
    environments:
      - dev
      - test
    resources:
      - ServiceBusTopic
    approval_required:
      dev: true
      test: false
    limitations:
      ServiceBusTopic:
        maxSizeInMegabytes: 1024
      AppService:
        skuTier: ["Basic", "Standard"]
```

```javascript
// Permission checking in auth.js
async function fetchUserData() {
    try {
        // Fetch user information
        const userResponse = await fetch('https://api.github.com/user', {
            headers: { Authorization: `token ${token}` }
        });
        
        const user = await userResponse.json();
        usernameElement.textContent = user.login;
        
        // Fetch user's teams
        const teamsResponse = await fetch('https://api.github.com/user/teams', {
            headers: { Authorization: `token ${token}` }
        });
        
        const teams = await teamsResponse.json();
        const teamNames = teams.map(team => team.name);
        
        // Determine user permissions based on team membership
        if (teamNames.includes('cie-team')) {
            userPermissions = 'admin';
        } else if (teamNames.includes('epo-team')) {
            userPermissions = 'contributor';
        } else {
            userPermissions = 'viewer';
        }
        
        // Load permissions from your GitHub Pages site
        loadPermissions();
    } catch (error) {
        console.error('Error fetching user data:', error);
    }
}
```

### 4. Direct Workflow Triggering

Takes user form input and directly triggers the appropriate GitHub Actions workflow via the GitHub API, bypassing the pull request process.

**Key Code Example:**
```javascript
// Submit Service Bus request (servicebus-api.js)
async function submitServiceBusRequest() {
    const form = document.getElementById('resource-form');
    const formData = new FormData(form);
    
    try {
        // Prepare the inputs for the GitHub Action
        const workflowInputs = {
            environment: formData.get('environment'),
            resourceName: formData.get('name'),
            messageRetention: formData.get('messageRetention') || '7',
            maxSizeInMegabytes: formData.get('maxSizeInMegabytes') || '1024',
            requiresDuplicateDetection: document.getElementById('requiresDuplicateDetection')?.checked ? 'true' : 'false'
        };
        
        // Trigger GitHub Actions workflow
        const response = await fetch(
            'https://api.github.com/repos/labenagha/infra-self-service/actions/workflows/provision-servicebus.yml/dispatches',
            {
                method: 'POST',
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ref: 'main', // or your default branch
                    inputs: workflowInputs
                })
            }
        );
        
        // Show success message
        if (response.ok) {
            showSuccessMessage(formData);
        }
    } catch (error) {
        showErrorMessage(error);
    }
}
```

### 5. Infrastructure Provisioning

GitHub Actions workflows that execute Terraform code to provision the requested infrastructure.

**Key Code Example:**
```yaml
# provision-servicebus.yml
name: Provision Service Bus Topic

on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment (e.g. dev or test)'
        required: true
      resourceName:
        description: 'Service Bus Topic Name'
        required: true
      messageRetention:
        description: 'Message Retention (Days), default 7'
        required: false
        default: '7'
      maxSizeInMegabytes:
        description: 'Max Size in MB, default 1024'
        required: false
        default: '1024'
      requiresDuplicateDetection:
        description: 'Enable duplicate detection (true/false)'
        required: false
        default: 'false'

jobs:
  provision_servicebus:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v3
      
      - name: Azure Login
        uses: azure/login@v2
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}
          enable-AzPSSession: true
      
      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v2
      
      - name: Terraform Apply
        run: |
          cd $GITHUB_WORKSPACE/modules/${{ github.event.inputs.environment }}
          
          # Create a tfvars file from the user inputs
          echo "resource_name              = \"${{ github.event.inputs.resourceName }}\"" >  request.tfvars
          echo "message_retention          = \"${{ github.event.inputs.messageRetention }}\"" >> request.tfvars
          echo "max_size_megabytes         = \"${{ github.event.inputs.maxSizeInMegabytes }}\"" >> request.tfvars
          echo "requires_duplicate_detection = ${{ github.event.inputs.requiresDuplicateDetection }}" >> request.tfvars
          
          terraform apply -auto-approve -var-file=request.tfvars
```

## Resource Definition

Resources are defined using JSON Schema files that control form rendering and validation.

**Example Service Bus Schema:**
```json
{
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "title": "Topic Name",
      "description": "Name of the Service Bus Topic"
    },
    "messageRetention": {
      "type": "number",
      "title": "Message Retention (Days)",
      "default": 7,
      "minimum": 1,
      "maximum": 14
    },
    "maxSizeInMegabytes": {
      "type": "number",
      "title": "Maximum Size (MB)",
      "default": 1024,
      "enum": [1024, 2048, 3072, 4096, 5120]
    },
    "requiresDuplicateDetection": {
      "type": "boolean",
      "title": "Enable Duplicate Detection",
      "default": false
    }
  },
  "required": ["name"]
}
```

## User Journeys

### DEV Team Member (Contributor)

1. Developer navigates to the self-service portal
2. Authenticates with GitHub credentials
3. UI shows only the resource types they can create (ServiceBusTopic)
4. They select a resource type and fill out a form with appropriate validation
5. System validates input against their permission limits
6. Form submission directly triggers a GitHub Actions workflow with the input parameters
7. The workflow executes based on the environment configuration
   - Environment-specific behavior is configured in the permissions.yml file
   - Some environments may have approval requirements (though currently implemented at the API level, not through PRs)

### CIE Team Member (Admin)

1. CIE team member authenticates
2. UI shows all available resource types (ServiceBusTopic, StorageAccount)
3. They can create resources in any environment without limits
4. Requests are automatically approved and processed
5. They can also review and approve DEV team requests

## How It All Works Together

Here's a step-by-step overview of how the entire system operates:

1. **Authentication Flow**:
   - User accesses the GitHub Pages site and is prompted to enter their GitHub Personal Access Token
   - The system stores this token and uses it to determine the user's GitHub team membership
   - Based on team membership, the user is assigned a role (admin/contributor/viewer)
   - The UI dynamically adjusts to show only resources the user has permission to create

2. **Form Generation**:
   - When a user selects a resource type (e.g., Service Bus Topic or Storage Account)
   - The system fetches the corresponding JSON schema from GitHub Pages
   - Form fields are dynamically generated based on the schema definitions
   - Field limitations are applied based on the user's permissions (e.g., size limitations for EPO team)

3. **Resource Request**:
   - User completes the form with their desired resource configuration
   - On submission, the client-side code prepares a payload with all parameters
   - Using the GitHub PAT, the system directly triggers a GitHub Actions workflow via the GitHub API
   - The specific workflow to trigger depends on the resource type (provision-servicebus.yml or provision-storage-account.yml)

4. **Infrastructure Deployment**:
   - The GitHub Actions workflow runs with the user-provided parameters
   - The workflow accesses Azure using stored credentials (AZURE_CREDENTIALS secret)
   - Terraform is initialized and configured with the appropriate variables
   - Infrastructure is deployed according to the modules in the repository
   - Success or failure status is provided back to the user

5. **Authorization Model**:
   - Access controls are enforced entirely at the client side based on GitHub team membership
   - Admin users (CIE team) have full access to all resources and environments
   - Contributor users (EPO team) have limited access based on permissions.yml configuration
   - Resource limitations and environment restrictions are defined in the permissions.yml file

This approach provides a secure, auditable, and self-service method for provisioning infrastructure without requiring users to have direct access to production environments or Terraform code.

## Adding New Resource Types

1. Create a schema file in `config/resource-templates/your-resource/schema.json`
2. Add form generation code in `js/your-resource-form.js`
3. Add API request handler in `js/your-resource-api.js`
4. Create a GitHub Actions workflow in `.github/workflows/provision-your-resource.yml`
5. Update permissions.yml to include your new resource type
