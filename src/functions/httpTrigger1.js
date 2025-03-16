const { app } = require('@azure/functions');

app.http('httpTrigger1', {
    methods: ['GET', 'POST', 'OPTIONS'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log('Token exchange function processed a request.');

        // Enable CORS
        const headers = {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": request.headers.origin || "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
        };

        // Handle preflight OPTIONS request
        if (request.method === "OPTIONS") {
            return { status: 200, headers, body: JSON.stringify({}) };
        }

        try {
            // 1) Quick connectivity test to confirm outbound calls work
            try {
                context.log('Testing outbound call to Google...');
                const googleRes = await fetch('https://www.google.com');
                context.log('Google response status:', googleRes.status);
            } catch (err) {
                context.log.error('Error calling Google:', err);
                // If this fails, the function can't reach the public internet
            }

            // 2) Parse request body
            let body;
            try {
                body = await request.json();
                context.log("Received request body:", body);
            } catch (error) {
                context.log.error("Error parsing request body:", error);
                return {
                    status: 400,
                    headers,
                    body: JSON.stringify({ error: "Invalid request body" })
                };
            }
            
            if (!body || !body.code) {
                return {
                    status: 400,
                    headers,
                    body: JSON.stringify({ error: "Please provide a code in the request body" })
                };
            }

            const code = body.code;
            context.log('Received code, exchanging for token...');
            
            // Verify environment variables
            if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
                context.log.error('Missing GitHub credentials in environment variables');
                return {
                    status: 500,
                    headers,
                    body: JSON.stringify({ 
                        error: "Server configuration error", 
                        details: "OAuth credentials not properly configured"
                    })
                };
            }
            
            // 3) Exchange code with GitHub
            context.log('Sending to GitHub with client ID:', process.env.GITHUB_CLIENT_ID);
            const requestBody = {
                client_id: process.env.GITHUB_CLIENT_ID,
                client_secret: process.env.GITHUB_CLIENT_SECRET,
                code: code,
                redirect_uri: 'https://labenagha.github.io/infra-self-service/auth/github/callback'
            };
            
            context.log('Request body for GitHub:', JSON.stringify(requestBody));
            
            const response = await fetch('https://github.com/login/oauth/access_token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            const responseText = await response.text();
            context.log('GitHub response text:', responseText);
            
            let data;
            try {
                data = JSON.parse(responseText);
                // Redact sensitive info before logging
                const logData = {...data};
                if (logData.access_token) logData.access_token = '***REDACTED***';
                context.log('GitHub response data:', logData);
            } catch (error) {
                context.log.error('Error parsing GitHub response:', error);
                return {
                    status: 500,
                    headers,
                    body: JSON.stringify({ error: "Failed to parse GitHub response" })
                };
            }
            
            if (data.error) {
                context.log.error('GitHub error:', data.error);
                return {
                    status: 400,
                    headers,
                    body: JSON.stringify({ error: data.error_description || data.error })
                };
            }
            
            // 4) Return the token to the client
            const responseBody = JSON.stringify({
                access_token: data.access_token,
                token_type: data.token_type
            });
            
            // Log success but redact token
            context.log('Token exchange successful');
            
            return {
                status: 200,
                headers,
                body: responseBody
            };
        } catch (error) {
            context.log.error('Error exchanging token:', error);
            return {
                status: 500,
                headers,
                body: JSON.stringify({ error: "Failed to exchange token: " + error.message })
            };
        }
    }
});