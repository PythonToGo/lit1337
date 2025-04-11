<<<<<<< Updated upstream
// // background.js - OAuth routing handler
importScripts("config.js");
=======
// background.js - OAuth routing handler
// const API_URL = "https://lit1337-dev.up.railway.app";
const API_URL = "http://localhost:8000";
const clientId = "Ov23lidbbczriEkuebBd";
const REDIRECT_URL = `https://${chrome.runtime.id}.chromiumapp.org/`;
>>>>>>> Stashed changes

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type !== "oauth-login") return;

  const clientId = "Ov23lidbbczriEkuebBd";
  const REDIRECT_URL = `https://${chrome.runtime.id}.chromiumapp.org/`;
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(REDIRECT_URL)}&scope=repo&prompt=consent`;

  chrome.identity.launchWebAuthFlow({
    url: authUrl,
    interactive: true
  }, async (redirectUri) => {
    if (chrome.runtime.lastError || !redirectUri) {
      console.error("❌ OAuth failed:", chrome.runtime.lastError?.message || "No redirect URI");
      sendResponse({ success: false });
      return;
    }

    const code = new URL(redirectUri).searchParams.get("code");

    if (!code) {
      console.error("❌ No code in redirect URI:", redirectUri);
      sendResponse({ success: false });
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/login/github/callback?code=${code}`);
      const data = await response.json();

<<<<<<< Updated upstream
      if (data?.token) {
        chrome.storage.local.set({
          jwt: data.token,
          username: data.username,
          last_push: data.last_push,
          last_login: data.last_login
=======
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'login') {
    console.log('Login request received in background');
    // Don't just open a tab - use the proper OAuth flow
    redirectToGitHubAuth();
    return true;
  }
  
  if (request.action === 'open_url') {
    console.log('URL open request received:', request.url);
    // Open the URL in a new tab
    if (request.url) {
      chrome.tabs.create({ url: request.url }, (tab) => {
        console.log('Opened URL in new tab:', tab?.id);
        sendResponse({ success: true, tab_id: tab?.id });
      });
      return true; // Keep the message channel open for the async response
    } else {
      console.error('No URL provided for open_url action');
      sendResponse({ success: false, error: 'No URL provided' });
    }
    return true;
  }
});

// Handle OAuth redirect - DISABLED because we now use chrome.identity.launchWebAuthFlow
/*
chrome.webNavigation.onCompleted.addListener(async (details) => {
  console.log('Navigation detected:', details.url);
  
  // Check if this is a callback from GitHub OAuth
  if (details.url.includes('github/callback') && details.url.includes('code=')) {
    console.log('GitHub OAuth callback detected');
    
    try {
      // Extract the code from the URL
      const url = new URL(details.url);
      const code = url.searchParams.get('code');
      
      if (!code) {
        console.error('No code found in GitHub callback URL');
        throw new Error('Authentication failed: No code received from GitHub');
      }
      
      console.log('GitHub code received:', code.substring(0, 5) + '...');
      
      // Make a GET request to our backend with the code
      const response = await fetch(`https://lit1337-dev.up.railway.app/login/github/callback?code=${code}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      console.log('Backend response status:', response.status);
      
      // Handle successful response
      if (response.status === 200) {
        try {
          // Try to parse as JSON first
          const contentType = response.headers.get('content-type');
          let responseData;
          
          if (contentType && contentType.includes('application/json')) {
            responseData = await response.json();
            console.log('Backend response JSON:', responseData);
          } else {
            // If not JSON, get the response as text
            const textResponse = await response.text();
            console.log('Backend response text:', textResponse);
            
            try {
              // Try to parse the text as JSON anyway
              responseData = JSON.parse(textResponse);
              console.log('Successfully parsed text response as JSON:', responseData);
            } catch (parseError) {
              console.warn('Could not parse text response as JSON:', parseError);
              // Create a basic response structure with a generated token
              responseData = {
                access_token: `gh_${Math.random().toString(36).substring(2, 8)}_user`,
                message: 'Generated token from text response',
                token_type: 'generated'
              };
            }
          }
          
          // Check if we have an access token
          if (responseData.access_token) {
            console.log(`Access token received: ${responseData.access_token.substring(0, 5)}...`);
            
            // Store token type if available
            const tokenType = responseData.token_type || 'standard';
            chrome.storage.local.set({ token_type: tokenType });
            
            // Store the token
            chrome.storage.local.set({ github_token: responseData.access_token }, () => {
              console.log('Access token stored in chrome.storage.local');
              // Close the tab
              chrome.tabs.remove(details.tabId);
            });
          } else {
            console.error('No access token in response data:', responseData);
            // Generate a temporary token so the user can still use the extension
            const tempToken = `temp_${Math.random().toString(36).substring(2, 8)}`;
            chrome.storage.local.set({ 
              github_token: tempToken,
              token_type: 'temporary'
            }, () => {
              console.log('Temporary token stored as fallback:', tempToken);
              chrome.tabs.remove(details.tabId);
            });
          }
        } catch (processError) {
          console.error('Error processing response:', processError);
          // Generate a temporary token
          const tempToken = `temp_${Math.random().toString(36).substring(2, 10)}`;
          chrome.storage.local.set({ 
            github_token: tempToken,
            token_type: 'temporary'
          }, () => {
            console.log('Temporary token stored due to processing error:', tempToken);
            chrome.tabs.remove(details.tabId);
          });
        }
      } else {
        // Handle error response
        console.error('Backend returned error status:', response.status);
        const errorText = await response.text();
        console.error('Error response:', errorText);
        
        // Generate an emergency token
        const emergencyToken = `gh_${Math.random().toString(36).substring(2, 10)}_emergency`;
        chrome.storage.local.set({ 
          github_token: emergencyToken,
          token_type: 'emergency'
>>>>>>> Stashed changes
        }, () => {
          console.log("✅ OAuth login saved to chrome.storage");
          sendResponse({ success: true });
        });
      } else {
        console.error("❌ Invalid token received:", data);
        sendResponse({ success: false });
      }
    } catch (err) {
      console.error("❌ OAuth callback fetch error:", err);
      sendResponse({ success: false });
    }
    });
});
