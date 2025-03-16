// exchange-token/index.js
module.exports = async function (context, req) {
    context.log('Token exchange function processed a request.');

    // Enable CORS
    context.res = {
        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
        }
    };

    // Handle preflight OPTIONS request
    if (req.method === "OPTIONS") {
        context.res.status = 200;
        context.res.body = {};
        return;
    }

    if (req.body && req.body.code) {
        const code = req.body.code;
        
        try {
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
            
            // Return the token to the client
            context.res.status = 200;
            context.res.body = {
                access_token: data.access_token,
                token_type: data.token_type
            };
        } catch (error) {
            context.log.error('Error exchanging token:', error);
            context.res.status = 500;
            context.res.body = { error: "Failed to exchange token" };
        }
    } else {
        context.res.status = 400;
        context.res.body = { error: "Please provide a code in the request body" };
    }
};