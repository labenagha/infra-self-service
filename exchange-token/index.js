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
            return { status: 200, headers, body: JSON.stringify({}) };
        }

        try {
            // Get the code from the request body
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

            const responseText = await response.text();
            context.log('GitHub response text:', responseText);
            
            let data;
            try {
                data = JSON.parse(responseText);
                context.log('GitHub response data:', data);
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
            
            // Return the token to the client
            const responseBody = JSON.stringify({
                access_token: data.access_token,
                token_type: data.token_type
            });
            
            context.log('Sending response:', responseBody);
            
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