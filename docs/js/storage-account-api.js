// storage-account-api.js
async function submitStorageAccountRequest() {
    const form = document.getElementById('resource-form');
    const formData = new FormData(form);
    
    // Show loading state
    document.getElementById('result-message').textContent = 'Submitting request...';
    document.getElementById('resource-form-container').style.display = 'none';
    document.getElementById('loading').style.display = 'block';
    
    try {
        // Prepare the inputs for the GitHub Action - Group parameters into JSON objects
        
        // Account configuration
        const accountConfig = {
            kind: formData.get('accountKind') || 'StorageV2',
            tier: formData.get('accountTier') || 'Standard',
            replication: formData.get('accountReplicationType') || 'LRS',
            accessTier: formData.get('accessTier') || 'Hot'
        };
        
        // Security configuration
        const securityConfig = {
            httpsOnly: document.getElementById('httpsTrafficOnlyEnabled')?.checked ? true : false,
            minTls: formData.get('minimumTlsVersion') || 'TLS1_2',
            publicAccess: document.getElementById('publicNetworkAccessEnabled')?.checked ? true : false,
            sharedKeys: document.getElementById('sharedAccessKeyEnabled')?.checked ? true : false
        };
        
        // Network configuration
        const networkConfig = {
            defaultAction: formData.get('defaultAction') || 'Deny',
            bypass: formData.get('bypass') || 'AzureServices'
        };
        
        // Data protection configuration
        const dataProtectionConfig = {
            softDelete: document.getElementById('softDeleteEnabled')?.checked ? true : false,
            retentionDays: parseInt(formData.get('softDeleteRetentionDays') || '7')
        };
        
        // Final workflow inputs object
        const workflowInputs = {
            environment: formData.get('environment'),
            resourceName: formData.get('name'),
            accountConfig: JSON.stringify(accountConfig),
            securityConfig: JSON.stringify(securityConfig),
            networkConfig: JSON.stringify(networkConfig),
            dataProtectionConfig: JSON.stringify(dataProtectionConfig)
        };
        
        console.log('Storage Account workflow inputs:', workflowInputs);
        
        // Trigger GitHub Actions workflow
        const response = await fetch(
            'https://api.github.com/repos/labenagha/infra-self-service/actions/workflows/provision-storage-account.yml/dispatches',
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
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`GitHub API error (${response.status}): ${errorText}`);
        }
        
        // Show success message with link to GitHub Actions
        document.getElementById('result-message').innerHTML = `
            <div class="success-message">
                <h3>Storage Account Request Submitted Successfully!</h3>
                <p>Your Storage Account request has been submitted to GitHub Actions for provisioning.</p>
                <p><strong>Name:</strong> ${formData.get('name')}</p>
                <p><strong>Environment:</strong> ${formData.get('environment')}</p>
                <p>
                  You can check the progress in GitHub Actions here: 
                  <a
                    href="https://github.com/labenagha/infra-self-service/actions?query=workflow%3A%22Provision+Storage+Account%22+branch%3Amain"
                    target="_blank"
                    >View Provision Storage Account workflow</a>
                </p>
                <button id="new-request-button">Create Another Request</button>
            </div>
        `;
        
        document.getElementById('new-request-button').addEventListener('click', () => {
            document.getElementById('result-message').textContent = '';
            document.getElementById('resource-selector').style.display = 'block';
        });
        
    } catch (error) {
        console.error('Error submitting Storage Account request:', error);
        document.getElementById('result-message').innerHTML = `
            <div class="error-message">
                <h3>Error Submitting Storage Account Request</h3>
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