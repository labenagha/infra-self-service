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