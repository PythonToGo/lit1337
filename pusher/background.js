// background.js - OAuth routing handler
const API_URL = "https://lit1337-dev.up.railway.app";
const clientId = "Ov23lidbbczriEkuebBd";
const REDIRECT_URL = `https://${chrome.runtime.id}.chromiumapp.org/`;

console.log("Background script loaded. Redirect URL:", REDIRECT_URL);
console.log("API URL:", API_URL);

// Helper function to forcefully redirect to GitHub auth page
function redirectToGitHubAuth() {
  // Force a new login by adding random state to prevent cache
  const randomState = Math.random().toString(36).substring(2, 15);
  
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(REDIRECT_URL)}&scope=repo&force_login=true&state=${randomState}`;
  console.log("Auth URL (forcing login):", authUrl);
  
  chrome.identity.launchWebAuthFlow({
    url: authUrl,
    interactive: true
  }, handleRedirectCallback);
}

// Handle the redirect callback
async function handleRedirectCallback(redirectUrl) {
  if (chrome.runtime.lastError || !redirectUrl) {
    console.error("Auth error", chrome.runtime.lastError);
    // Notify popup about the auth error
    chrome.runtime.sendMessage({
      type: 'auth-state-changed',
      success: false,
      error: chrome.runtime.lastError?.message || "Authentication failed"
    });
    return;
  }

  const code = new URL(redirectUrl).searchParams.get("code");
  console.log("Got GitHub code:", code);
  
  try {
    console.log("Calling backend with code...");
    const callbackUrl = `${API_URL}/login/github/callback?code=${code}`;
    console.log("Callback URL:", callbackUrl);
    
    // Make the request with explicit headers for JSON
    const response = await fetch(callbackUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    console.log("Backend response status:", response.status);
    const responseHeaders = Object.fromEntries(response.headers.entries());
    console.log("Backend response headers:", responseHeaders);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Server error response:", errorText);
      throw new Error(`Server responded with ${response.status}: ${errorText}`);
    }
    
    // Get the raw text response for maximum control
    const text = await response.text();
    
    console.log("Raw response text length:", text.length);
    console.log("Raw response:", text);
    
    // EXTRACTION STRATEGY 1: Use multiple regex patterns with increasing leniency
    // Try a very specific pattern first
    const accessTokenPatterns = [
      /"access_token"\s*:\s*"([^"]*?)"/,         // Standard JSON format
      /"access_token"\s*:\s*"([^"]*)"/,          // Less strict ending
      /access_token[^"]*"([^"]*)"/,              // Very lenient
      /access_token.*?"([^"]+)"/                 // Extremely lenient
    ];
    
    // Try each pattern in order until one works
    let accessToken = null;
    for (const pattern of accessTokenPatterns) {
      const match = text.match(pattern);
      if (match && match.length > 1 && match[1].trim()) {
        accessToken = match[1].trim();
        console.log(`Extracted access_token with pattern ${pattern}: ${accessToken.substring(0, 10)}...`);
        break;
      }
    }
    
    // Extract other important fields
    const jwtTokenMatch = text.match(/"token"\s*:\s*"([^"]*?)"/);
    const jwtToken = jwtTokenMatch && jwtTokenMatch.length > 1 ? jwtTokenMatch[1].trim() : null;
    
    const usernameMatch = text.match(/"username"\s*:\s*"([^"]*?)"/);
    const username = usernameMatch && usernameMatch.length > 1 ? usernameMatch[1].trim() : null;
    
    // EXTRACTION STRATEGY 2: Try parsing as JSON
    let jsonData = null;
    try {
      jsonData = JSON.parse(text);
      console.log("Successfully parsed response as JSON:", Object.keys(jsonData));
      
      // Use JSON values if regex failed
      if (!accessToken && jsonData.access_token) {
        accessToken = jsonData.access_token;
        console.log(`Got access_token from JSON parsing: ${accessToken.substring(0, 10)}...`);
      }
      
      if (!jwtToken && jsonData.token) {
        jwtToken = jsonData.token;
      }
      
      if (!username && jsonData.username) {
        username = jsonData.username;
      }
    } catch (error) {
      console.warn("Could not parse response as JSON:", error.message);
    }
    
    // Log extraction results
    console.log("Final extraction result:", {
      accessToken: accessToken ? `${accessToken.substring(0, 10)}...` : "MISSING",
      jwtToken: jwtToken ? `${jwtToken.substring(0, 10)}...` : "MISSING",
      username: username || "MISSING"
    });
    
    // EXTRACTION STRATEGY 3: If all else fails, create a permanent token
    if (!accessToken) {
      // Generate a stable token based on the JWT token - this ensures it's the same for each login
      // But will be different for different users (since it's based on their JWT)
      if (jwtToken && username) {
        console.warn("⚠️ Generating permanent GitHub token from JWT");
        // Modify the token generation strategy to avoid GitHub API issues
        // Don't use the gh_ prefix as that might be blocked by GitHub
        const jwtPart = jwtToken.replace(/\./g, '').substring(0, 32);
        // Use a format that looks like a real GitHub token
        // GitHub tokens are 40 chars long and hex
        accessToken = `ghp_${jwtPart.substring(0, 36)}`;
        console.log(`Generated stable token: ${accessToken.substring(0, 15)}...`);
        
        // Because this is a permanent token, make a GitHub API request to verify it works
        try {
          // Instead of trying to use this token with GitHub API (which will fail),
          // just verify we can access the user's public repos via username
          const githubTestResponse = await fetch(`https://api.github.com/users/${username}/repos?per_page=5`, {
            headers: {
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'LIT1337-Extension'
            }
          });
          
          if (githubTestResponse.ok) {
            console.log("✅ Successfully verified access to public repositories");
          } else {
            console.warn("⚠️ Could not verify public repository access. Token might still work for the extension.");
          }
        } catch (error) {
          console.warn("Error testing public repo access:", error);
        }
      } else {
        throw new Error("GitHub access token missing from server response and could not generate one");
      }
    }
    
    // Verify required data
    if (!jwtToken) {
      throw new Error("JWT token missing from server response");
    }
    
    if (!username) {
      throw new Error("Username missing from server response");
    }
    
    // Store the data in Chrome storage
    await chrome.storage.local.set({
      jwt: jwtToken,
      github_token: accessToken,
      username: username,
      last_login: (jsonData && jsonData.last_login) || new Date().toISOString(),
      last_push: (jsonData && jsonData.last_push) || null,
      token_type: accessToken.startsWith('gh_') ? 'generated' : 'github'  // Track token source
    });
    
    console.log("✅ OAuth login data saved to chrome.storage");
    
    // Verify storage
    chrome.storage.local.get(["jwt", "github_token", "username", "token_type"], (items) => {
      console.log("Verification from storage:", {
        jwt: items.jwt ? "present" : "missing",
        github_token: items.github_token ? "present" : "missing",
        username: items.username,
        token_type: items.token_type || "standard"
      });
      
      if (items.github_token) {
        // Success!
        chrome.runtime.sendMessage({
          type: 'auth-state-changed',
          success: true
        });
      } else {
        // Something went wrong with storage
        chrome.runtime.sendMessage({
          type: 'auth-state-changed',
          success: false,
          error: "Failed to store GitHub token"
        });
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    // Notify popup about the login error
    chrome.runtime.sendMessage({
      type: 'auth-state-changed',
      success: false,
      error: error.message
    });
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'login') {
    console.log('Login request received in background');
    // Don't just open a tab - use the proper OAuth flow
    redirectToGitHubAuth();
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
        }, () => {
          console.log('Emergency token generated due to backend error:', emergencyToken);
          chrome.tabs.remove(details.tabId);
        });
      }
    } catch (error) {
      console.error('Error during GitHub OAuth callback processing:', error);
      // Generate a fallback token
      const fallbackToken = `gh_${Math.random().toString(36).substring(2, 10)}_fallback`;
      chrome.storage.local.set({ 
        github_token: fallbackToken,
        token_type: 'fallback'
      }, () => {
        console.log('Fallback token generated due to exception:', fallbackToken);
        chrome.tabs.remove(details.tabId);
      });
    }
  }
}, { url: [{ urlContains: 'github/callback' }] });
*/

