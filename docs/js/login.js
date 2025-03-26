/**
 * Handle GitHub auth code detection
 */
(function() {
    if (
      window.location.search.includes("code=") &&
      !window.location.pathname.includes("/auth/github/callback")
    ) {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get("code");
  
      if (code) {
        sessionStorage.setItem("github_auth_code", code);
        console.log("OAuth code detected, processing login...");
      }
    }
  })();
  
  /**
   * Login form handling
   */
  document.addEventListener('DOMContentLoaded', function() {
    const patInput = document.getElementById('pat-input');
    const loginButton = document.getElementById('login-button');
  
    // Focus input on page load
    if (patInput) {
      patInput.focus();
    }
  
    // Login via button click
    if (loginButton) {
      loginButton.addEventListener('click', handleLogin);
    }
  
    // Login via Enter key
    if (patInput) {
      patInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
          event.preventDefault();
          handleLogin();
        }
      });
    }
  
    /**
     * Handle the login process
     */
    function handleLogin() {
      const token = patInput.value.trim();
      
      if (!token) {
        showError('Please enter a valid token');
        return;
      }
      
      // Visual feedback
      loginButton.textContent = 'Logging in...';
      loginButton.disabled = true;
      
      // In a real application, you would validate the token first
      validateToken(token)
        .then(isValid => {
          if (isValid) {
            // Store token and redirect
            sessionStorage.setItem('github_token', token);
            window.location.href = 'dashboard.html';
          } else {
            showError('Invalid token. Please check and try again.');
            loginButton.textContent = 'Login';
            loginButton.disabled = false;
          }
        })
        .catch(error => {
          console.error('Login error:', error);
          showError('An error occurred. Please try again.');
          loginButton.textContent = 'Login';
          loginButton.disabled = false;
        });
    }
  
    /**
     * Show error message
     * @param {string} message - Error message to display
     */
    function showError(message) {
      // Clear any existing errors
      const existingError = document.querySelector('.error-message');
      if (existingError) {
        existingError.remove();
      }
      
      // Create and show new error
      const errorElement = document.createElement('div');
      errorElement.className = 'error-message';
      errorElement.textContent = message;
      errorElement.style.color = '#d32f2f';
      errorElement.style.marginBottom = '1rem';
      errorElement.style.fontSize = '0.9rem';
      
      const tokenInput = document.querySelector('.token-input');
      tokenInput.insertBefore(errorElement, patInput);
      
      // Focus input
      patInput.focus();
    }
  
    /**
     * Validate GitHub token
     * This function would normally make an API call to GitHub
     * For demo purposes, we're just simulating a validation
     * @param {string} token - GitHub token to validate
     * @returns {Promise<boolean>} - Promise resolving to validation result
     */
    function validateToken(token) {
      // This is a placeholder - in a real app, you would check the token with GitHub API
      return new Promise((resolve) => {
        // Simulate API call
        setTimeout(() => {
          // For demo, consider any non-empty token valid
          // In production, use the auth.js file to properly validate
          resolve(token.length > 10);
        }, 800);
      });
    }
  });