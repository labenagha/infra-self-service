/**
 * Dashboard JavaScript for Infrastructure Self-Service Portal
 */

// Check authentication on page load
document.addEventListener('DOMContentLoaded', function() {
    checkAuthentication();
    updateLastLoginTime();
  });
  
  /**
   * Check if user is authenticated, redirect to login if not
   */
  function checkAuthentication() {
    // Check if token exists in session storage
    const token = sessionStorage.getItem('github_token');
    if (!token) {
      // Redirect to login page if no token
      window.location.href = 'index.html';
    }
  }
  
  /**
   * Update last login time display
   */
  function updateLastLoginTime() {
    const lastLoginElement = document.getElementById('last-login-time');
    if (lastLoginElement) {
      const now = new Date();
      
      // Format date: March 18, 2025 10:45 AM
      const options = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric', 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true 
      };
      
      const formattedDate = now.toLocaleDateString('en-US', options);
      lastLoginElement.textContent = formattedDate;
      
      // Store current login time for future reference
      sessionStorage.setItem('last_login_time', now.toISOString());
    }
  }