# Infrastructure Self-Service Platform

## Architecture Overview

This solution provides a form-based interface for infrastructure requests while maintaining full auditability and permission controls without requiring new tools. It leverages GitHub Pages, GitHub Actions, and existing reusable workflows.

```
┌─────────────────────┐      ┌──────────────────┐      ┌───────────────────┐      ┌──────────────────┐
│                     │      │                  │      │                   │      │                  │
│  Self-Service UI    │──────▶  GitHub API      │──────▶ Approval Process │──────▶ Infra Creation  │
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

A static web application hosted on GitHub Pages that provides a user-friendly interface for infrastructure requests. The UI dynamically renders forms based on resource type and user permissions.

Key files:
- `docs/index.html`: Main entry point for the web application
- `docs/js/auth.js`: Handles GitHub OAuth authentication flow and user permissions
- `docs/js/api.js`: Manages communication with GitHub API and form submissions
- `docs/js/service-bus-form.js` & `docs/js/storage-account-form.js`: Generate dynamic forms based on resource schemas

Example of dynamic form generation:
```javascript
// Simplified form generation logic
function loadResourceForm(resourceType, permissions) {
    // Fetch resource schema
    fetch(`config/resource-templates/${resourceType.toLowerCase()}/schema.json`)
        .then(response => response.json())
        .then(schema => {
            // Create form fields based on schema
            Object.entries(schema.properties).forEach(([fieldName, fieldConfig]) => {
                // Create appropriate form field based on type
                const input = createFormField(fieldName, fieldConfig);
                
                // Apply user permission limitations if necessary
                applyPermissionLimitations(input, fieldName, resourceType, permissions);
                
                // Add field to form
                formContainer.appendChild(input);
            });
        });
}

### 2. Authentication & Authorization

Uses GitHub OAuth to authenticate users and determine their permissions based on team membership. A serverless Azure Function handles the token exchange process securely.

Key files:
- `exchange-token/index.js`: Core Azure Function implementation
- `src/functions/httpTrigger1.js`: HTTP trigger function that handles CORS and OAuth code exchange
- `docs/config/permissions.yml`: Defines team-based access permissions and resource limitations

Example of the OAuth token exchange:
```javascript
// Azure Function to exchange OAuth code for token
app.http('httpTrigger1', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        // Handle CORS preflight
        if (request.method === "OPTIONS") {
            return { status: 200, headers: corsHeaders };
        }
        
        try {
            // Get code from request
            const body = await request.json();
            const code = body.code;
            
            // Exchange with GitHub
            const response = await fetch('https://github.com/login/oauth/access_token', {
                method: 'POST',
                headers: { 'Accept': 'application/json' },
                body: JSON.stringify({
                    client_id: process.env.GITHUB_CLIENT_ID,
                    client_secret: process.env.GITHUB_CLIENT_SECRET,
                    code: code
                })
            });
            
            // Return token to client
            const data = await response.json();
            return {
                status: 200,
                body: JSON.stringify({
                    access_token: data.access_token,
                    token_type: data.token_type
                })
            };
        } catch (error) {
            context.log.error('Error:', error);
            return { status: 500, body: JSON.stringify({ error: error.message }) };
        }
    }
});
```

Example of permission configuration:
```yaml
# Simplified permissions.yml
teams:
  cie-team:
    role: admin
    environments: [dev, test]
    resources: [ServiceBusTopic, StorageAccount]
    approval_required: false
    
  epo-team:
    role: contributor
    environments: [dev, test]
    resources: [ServiceBusTopic]
    approval_required:
      dev: true
      test: false
    limitations:
      ServiceBusTopic:
        maxSizeInMegabytes: 1024
```

### 3. Request Processing

Converts user form input into standardized infrastructure request files, creates pull requests, and manages the approval workflow based on user permissions.

Key files:
- `docs/js/servicebus-api.js` & `docs/js/storage-account-api.js`: Resource-specific API handlers for transforming form data into infrastructure code
- `docs/config/resource-templates/*/schema.json`: JSON schemas that define the structure and validation rules for each resource type

Example of schema definition for a Service Bus Topic:
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

Example of creating a GitHub Pull Request from form data:
```javascript
async function submitResourceRequest(formData, resourceType) {
    // Create request data from form
    const requestData = {
        kind: resourceType,
        metadata: {
            name: formData.get('name'),
            environment: formData.get('environment'),
            requestedBy: username
        },
        spec: {
            // Add all form fields to spec
            messageRetention: formData.get('messageRetention'),
            maxSizeInMegabytes: formData.get('maxSizeInMegabytes'),
            requiresDuplicateDetection: formData.get('requiresDuplicateDetection')
        }
    };
    
    // Create branch, file, and pull request in GitHub
    const branchName = `request/${resourceType.toLowerCase()}-${Date.now()}`;
    await createBranch(branchName);
    await createFile(`requests/${resourceType.toLowerCase()}/${formData.get('name')}.yml`, requestData, branchName);
    const pr = await createPullRequest(branchName, `Request: ${resourceType} - ${formData.get('name')}`);
    
    return pr;
}
```

### 4. Infrastructure Provisioning

Terraform modules for creating and managing the requested infrastructure resources in a standardized way.

Key files:
- `modules/service-bus/`: Terraform module for Service Bus provisioning
- `modules/storage-account/`: Terraform module for Storage Account provisioning
- `modules/dev/` & `modules/test/`: Environment-specific Terraform configurations

Example of Service Bus Terraform module:
```terraform
// Simplified Service Bus Terraform module
resource "azurerm_servicebus_namespace" "this" {
  name                = "${var.resource_name}-namespace"
  location            = var.location
  resource_group_name = var.resource_group_name
  sku                 = "Standard"
  tags                = var.tags
}

resource "azurerm_servicebus_topic" "this" {
  name                         = var.resource_name
  namespace_id                 = azurerm_servicebus_namespace.this.id
  default_message_ttl          = "P${var.message_retention}D"
  max_size_in_megabytes        = var.max_size_mb
  requires_duplicate_detection = var.requires_duplicate_detection
}
```

Example of environment-specific configuration:
```terraform
// Simplified environment configuration
locals {
  environment = "dev"
  location    = "eastus"
  common_tags = {
    Environment = local.environment
    ManagedBy   = "terraform"
  }
}

resource "azurerm_resource_group" "servicebus" {
  name     = "servicebus-${local.environment}"
  location = local.location
  tags     = local.common_tags
}

module "service_bus" {
  source = "../service-bus"

  resource_name                = var.resource_name
  message_retention            = var.message_retention
  max_size_mb                  = var.max_size_mb
  requires_duplicate_detection = var.requires_duplicate_detection

  resource_group_name = azurerm_resource_group.servicebus.name
  location            = local.location
  tags                = local.common_tags
}
```

### 5. Permission Model

Fine-grained control based on GitHub team membership with specific roles, environment access, and resource limitations.

Permission system features:
- Role-based access (admin for CIE team, contributor for DEV team)
- Environment-specific permissions (dev, test, prod)
- Resource type restrictions based on team membership
- Approval requirements that vary by environment
- Resource-specific limitations (e.g., max sizes, allowed SKUs)

Example of permission validation in the UI:
```javascript
function initializeApp() {
    // Fetch user info and teams from GitHub
    Promise.all([
        fetch('https://api.github.com/user', { headers: { Authorization: `token ${token}` } }),
        fetch('https://api.github.com/user/teams', { headers: { Authorization: `token ${token}` } })
    ])
    .then(([userResponse, teamsResponse]) => Promise.all([userResponse.json(), teamsResponse.json()]))
    .then(([user, teams]) => {
        // Determine user's permission level
        const teamNames = teams.map(team => team.name.toLowerCase());
        
        if (teamNames.includes('cie-team')) {
            userPermissions = 'admin';
        } else if (teamNames.includes('epo-team')) {
            userPermissions = 'contributor';
        } else {
            userPermissions = 'viewer';
        }
        
        // Load available resources based on permissions
        return fetch('config/permissions.yml');
    })
    .then(response => response.text())
    .then(yamlText => {
        const permissions = parseYaml(yamlText);
        
        // Filter resources based on user permissions
        const availableResources = 
            userPermissions === 'admin' 
                ? permissions.teams['cie-team'].resources
                : permissions.teams['epo-team'].resources;
                
        // Show only allowed resources in the UI
        displayResourceOptions(availableResources);
    });
}
```

Example of GitHub Action for validation and approval:
```yaml
# Simplified infrastructure-request.yml
name: Process Infrastructure Request

on:
  pull_request:
    paths: ['requests/**/*.yml']

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Validate request permissions
        run: |
          # Get requester's team membership
          TEAMS=$(gh api user/teams | jq -r '.[].name')
          
          # Check if user is in admin team (auto-approve)
          if echo "$TEAMS" | grep -q "cie-team"; then
            echo "User is admin, approving request"
            echo "IS_ADMIN=true" >> $GITHUB_ENV
            exit 0
          fi
          
          # For contributor, check if approval required for environment
          ENVIRONMENT=$(yq -r '.metadata.environment' $REQUEST_FILE)
          APPROVAL_REQUIRED=$(yq -r '.teams.epo-team.approval_required.'$ENVIRONMENT ./config/permissions.yml)
          
          if [ "$APPROVAL_REQUIRED" = "true" ]; then
            echo "REQUIRES_APPROVAL=true" >> $GITHUB_ENV
          else
            echo "REQUIRES_APPROVAL=false" >> $GITHUB_ENV
          fi
          
      - name: Auto-approve if allowed
        if: env.IS_ADMIN == 'true' || env.REQUIRES_APPROVAL == 'false'
        uses: hmarr/auto-approve-action@v3
          
      - name: Request review if needed
        if: env.REQUIRES_APPROVAL == 'true'
        run: gh pr edit "${{ github.event.pull_request.number }}" --add-reviewer "cie-team"
```

## User Journeys

### DEV Team Member Request Flow

1. Developer navigates to the self-service portal
2. Authenticates with GitHub credentials
3. UI shows only the resource types they can create (ServiceBusTopic, AppService)
4. They select a resource type and fill out a form with appropriate validation
5. System validates input against their permission limits
6. Form submission creates a PR with appropriate infrastructure code
7. For dev environment: auto-approved and processed
8. For test environment: requires CIE team approval

### CIE Team Member Request Flow

1. CIE team member authenticates
2. UI shows all available resource types
3. They can create resources in any environment
4. Requests are automatically approved
5. They can also review and approve DEV team requests

## Project Structure

This repository is organized into several key directories:
- `/docs`: Contains the static web UI hosted on GitHub Pages
- `/modules`: Terraform modules for infrastructure provisioning
- `/exchange-token` & `/src`: Azure Function for OAuth token exchange
- Configuration files for permissions, environments, and resource templates

The project leverages GitHub's built-in capabilities for hosting, authentication, and workflow automation to create a complete infrastructure self-service solution without requiring additional tools.
