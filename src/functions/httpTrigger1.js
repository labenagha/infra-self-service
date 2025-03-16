const { app } = require('@azure/functions');

app.http('httpTrigger1', {
    methods: ['GET', 'POST', 'OPTIONS'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log('Token exchange function processed a request.');

        // Enable CORS
        const headers = {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "https://labenagha.github.io",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
        };

        // Handle preflight OPTIONS request
        if (request.method === "OPTIONS") {
            return { status: 200, headers, body: {} };
        }

        try {
            // Get the code from the request body
            const body = await request.json();
            
            if (!body || !body.code) {
                return {
                    status: 400,
                    headers,
                    body: { error: "Please provide a code in the request body" }
                };
            }

            const code = body.code;
            context.log('Received code from client, exchanging for token...');
            
            // Make request to GitHub to exchange code for token
            const response = await fetch('https://github.com/login/oauth/access_token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    client_id: process.env.GITHUB_CLIENT_ID,
                    client_secret: process.env.GITHUB_CLIENT_SECRET,
                    code: code
                })
            });

            const data = await response.json();
            context.log('Token exchange response received from GitHub');
            
            if (data.error) {
                context.log.error('GitHub error:', data.error);
                return {
                    status: 400,
                    headers,
                    body: { error: data.error_description || data.error }
                };
            }
            
            // Return the token to the client
            return {
                status: 200,
                headers,
                body: {
                    access_token: data.access_token,
                    token_type: data.token_type
                }
            };
        } catch (error) {
            context.log.error('Error exchanging token:', error);
            
            return {
                status: 500,
                headers,
                body: { error: "Failed to exchange token: " + error.message }
            };
        }
    }
});