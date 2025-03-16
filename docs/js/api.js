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
        // Prepare the inputs for the GitHub Action
        const workflowInputs = {
            environment: formData.get('environment'),
            resourceName: formData.get('name'),
            messageRetention: formData.get('messageRetention') || '7',
            maxSizeInMegabytes: formData.get('maxSizeInMegabytes') || '1024',
            requiresDuplicateDetection: document.getElementById('requiresDuplicateDetection')?.checked ? 'true' : 'false'
        };
        
        console.log('Workflow inputs:', workflowInputs);
        
        // Only trigger workflow if this is a ServiceBusTopic request
        if (resourceType === 'ServiceBusTopic') {
            // Trigger GitHub Actions workflow
            const response = await fetch('https://api.github.com/repos/labenagha/infra-self-service/actions/workflows/provision-servicebus.yml/dispatches', {
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
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`GitHub API error (${response.status}): ${errorText}`);
            }
            
            // GitHub Actions workflow dispatch doesn't return workflow details in response
            // So we'll show a generic success message
            document.getElementById('result-message').innerHTML = `
                <div class="success-message">
                    <h3>Request Submitted Successfully!</h3>
                    <p>Your Service Bus Topic request has been submitted to GitHub Actions for provisioning.</p>
                    <p>Name: ${formData.get('name')}</p>
                    <p>Environment: ${formData.get('environment')}</p>
                    <p>You can check the progress in GitHub Actions.</p>
                    <button id="new-request-button">Create Another Request</button>
                </div>
            `;
        } else {
            // For other resource types, continue with your existing PR approach
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
        }
        
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
    const response = await fetch('https://api.github.com/repos/labenagha/infra-self-service/git/ref/heads/main', {
        headers: { Authorization: `token ${token}` }
    });
    const data = await response.json();
    return data.object.sha;
}

async function createBranch(branchName, sha) {
    const response = await fetch('https://api.github.com/repos/labenagha/infra-self-service/git/refs', {
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
    const response = await fetch(`https://api.github.com/repos/labenagha/infra-self-service/contents/${path}`, {
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
    const response = await fetch('https://api.github.com/repos/labenagha/infra-self-service/pulls', {
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