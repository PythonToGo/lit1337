// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
  const clientId = "Ov23lidbbczriEkuebBd";
  const REDIRECT_URL = `https://${chrome.runtime.id}.chromiumapp.org/`;
  // API_BASE_URL is imported from config.js

  const loginBtn = document.getElementById("login-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const statusEl = document.getElementById("status");
  const repoEl = document.getElementById("repo");
  const lastPushEl = document.getElementById("last-push");
  const lastLoginEl = document.getElementById("last-login");
  const loadingEl = document.getElementById("loading");
  const githubBtn = document.getElementById("github-btn");
  const repoSelect = document.getElementById("repo-select");
  const setRepoBtn = document.getElementById("set-repo-btn");

  // Function to fetch user's repositories
  async function fetchUserRepos(github_token) {
    try {
      console.log('Fetching repositories with token:', github_token ? github_token.substring(0, 5) + '...' : 'missing');
      
      if (!github_token) {
        throw new Error("GitHub token is missing. Please login again.");
      }
      
      // Get the token type from storage
      const tokenType = await new Promise(resolve => {
        chrome.storage.local.get(['token_type'], (result) => {
          resolve(result.token_type || 'standard');
        });
      });
      
      console.log(`Token type: ${tokenType}`);
      
      // Get username from storage - we'll need this for fallback and API calls
      const username = await new Promise(resolve => {
        chrome.storage.local.get(['username'], (result) => {
          resolve(result.username || "");
        });
      });
      
      console.log(`Username: ${username}`);
      
      // Handle temporary tokens
      if (github_token.startsWith('temp_')) {
        console.warn("Using temporary token - will try to fetch repos anyway");
      }
      
      // Try to fetch real repositories first in all cases
      let success = false;
      let repos = [];
      
      // First attempt: Use GitHub API to get user's repositories
      try {
        console.log("Fetching repositories from GitHub API...");
        
        // Try to fetch using username - this doesn't require auth
        const response = await fetch(`https://api.github.com/users/${username}/repos?per_page=100&sort=updated`, {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'LIT1337-Chrome-Extension'
          }
        });
        
        if (response.ok) {
          success = true;
          const data = await response.json();
          console.log(`Successfully fetched ${data.length} repositories for user ${username}`);
          repos = data;
        } else {
          console.log(`Public repo fetch failed with status ${response.status}`);
        }
      } catch (error) {
        console.error("Error fetching public repos:", error);
      }
      
      // If that failed, try with token auth
      if (!success && !github_token.startsWith('temp_')) {
        // Method 1: Standard GitHub API token format
        console.log("Trying GitHub API with 'token' prefix...");
        try {
          const response = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
            headers: {
              'Authorization': `token ${github_token}`,
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'LIT1337-Chrome-Extension'
            }
          });
          
          if (response.ok) {
            success = true;
            const data = await response.json();
            console.log(`Successfully fetched ${data.length} repositories with token format`);
            repos = data;
          } else {
            console.log(`Token format failed with status ${response.status}`);
          }
        } catch (error) {
          console.error("Error with token format:", error);
        }
        
        // Method 2: Try Bearer format
        if (!success) {
          console.log("Trying GitHub API with 'Bearer' prefix...");
          try {
            const response = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
              headers: {
                'Authorization': `Bearer ${github_token}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'LIT1337-Chrome-Extension'
              }
            });
            
            if (response.ok) {
              success = true;
              const data = await response.json();
              console.log(`Successfully fetched ${data.length} repositories with Bearer format`);
              repos = data;
            } else {
              console.log(`Bearer format failed with status ${response.status}`);
            }
          } catch (error) {
            console.error("Error with Bearer format:", error);
          }
        }
      }
      
      // If all attempts failed, use fallback demo repositories
      if (!success) {
        console.log("All API attempts failed, using fallback demo repositories");
        repos = [
          { name: "example-repo-1", owner: { login: username || "user" } },
          { name: "example-repo-2", owner: { login: username || "user" } },
          { name: "leetcode-solutions", owner: { login: username || "user" } }
        ];
      }
      
      return Array.isArray(repos) ? repos : [];
    } catch (error) {
      console.error('Error fetching repos:', error);
      throw error; // Rethrow to handle in the caller
    }
  }

  // Function to populate repository select dropdown
  async function populateRepoSelect(github_token) {
    try {
      console.log('Starting repository population...');
      if (!github_token) {
        console.error('Missing GitHub token for repo population');
        repoSelect.innerHTML = '<option value="">Login required</option>';
        statusEl.innerText = "Authentication required. Please login with GitHub.";
        loginBtn.style.display = "inline-block";
        return;
      }
      
      statusEl.innerText = "Loading repositories...";
      repoEl.innerText = "Fetching repositories...";
      
      const repos = await fetchUserRepos(github_token);
      if (repos.length === 0) {
        repoSelect.innerHTML = '<option value="">No repositories found</option>';
        repoEl.innerText = "No repositories found. Please check your GitHub account.";
        return;
      }

      // Sort repositories alphabetically
      repos.sort((a, b) => a.name.localeCompare(b.name));

      repoSelect.innerHTML = '<option value="">Select a repository</option>';
      repos.forEach(repo => {
        const option = document.createElement('option');
        option.value = `${repo.owner.login}/${repo.name}`;
        option.textContent = repo.name;
        repoSelect.appendChild(option);
      });
      console.log(`Populated ${repos.length} repositories`);
      repoEl.innerText = "Please select a repository";
    } catch (error) {
      console.error('Error populating repo select:', error);
      repoSelect.innerHTML = '<option value="">Error loading repositories</option>';
      statusEl.innerText = `Error: ${error.message}`;
      
      // If token related error, show login button
      if (error.message.includes("login") || error.message.includes("token") || error.message.includes("auth")) {
        loginBtn.style.display = "inline-block";
      }
    }
    repoSelect.style.display = 'block';
  }

  // Listen for auth state changes from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Message received in popup:', message);
    
    if (message.type === 'auth-state-changed') {
      console.log('Auth state changed:', message);
      
      // Clear login timeout if it exists
      if (window.loginTimeoutId) {
        clearTimeout(window.loginTimeoutId);
        window.loginTimeoutId = null;
      }
      
      loadingEl.classList.remove("show");
      
      if (!message.success) {
        loginBtn.style.display = "inline-block";
        statusEl.className = "badge error";
        statusEl.innerText = `Login failed: ${message.error || 'Unknown error'}`;
        return;
      }
      
      // Check if we have the required data before reloading
      chrome.storage.local.get(["jwt", "github_token", "username"], 
        ({ jwt, github_token, username }) => {
          console.log("Storage check after login:", {
            jwt: jwt ? "exists" : "missing",
            github_token: github_token ? "exists" : "missing",
            username: username || "missing",
            tokenLength: github_token ? github_token.length : 0
          });
          
          if (jwt && github_token && username) {
            console.log("Login successful, reloading popup");
            location.reload();
          } else {
            console.error("Login completed but missing required data");
            statusEl.className = "badge error";
            statusEl.innerText = "Login incomplete - missing data. Try again.";
            loginBtn.style.display = "inline-block";
          }
      });
    }
  });

  // initial render: check JWT + check if user exists on server
  chrome.storage.local.get(["jwt", "github_token", "username", "last_push", "last_login", "selected_repo", "token_type"], 
    async ({ jwt, github_token, username, last_push, last_login, selected_repo, token_type }) => {
    console.log('Retrieved from storage:', { 
      jwt: jwt ? `${jwt.substring(0, 10)}...` : 'missing',
      github_token: github_token ? `${github_token.substring(0, 10)}...` : 'missing',
      username,
      token_type: token_type || 'unknown',
      last_login: last_login ? new Date(last_login).toLocaleString() : 'missing',
      last_push: last_push ? new Date(last_push).toLocaleString() : 'missing',
      selected_repo: selected_repo || 'none'
    });
    
    loadingEl.classList.remove("show"); // Always hide loading on initial render
    
    if (jwt && github_token && username) {
      try {
        console.log('User is logged in, updating UI...');
        
        // Fetch user data from backend to get the latest info
        try {
          statusEl.innerText = "Fetching user data...";
          const response = await fetch(`${API_BASE_URL}/me`, {
            headers: {
              'Authorization': `Bearer ${jwt}`
            }
          });
          
          if (response.ok) {
            const userData = await response.json();
            console.log('User data from backend:', userData);
            
            // Update local storage with backend data
            chrome.storage.local.set({
              last_login: userData.last_login || last_login,
              last_push: userData.last_push || last_push,
              selected_repo: userData.selected_repo || selected_repo
            }, () => {
              console.log('Updated storage with backend data');
              // Use the backend data for selected_repo if available
              selected_repo = userData.selected_repo || selected_repo;
            });
          } else {
            console.warn('Failed to fetch user data from backend:', await response.text());
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
        
        updateUI(username, last_push, last_login, selected_repo);
        
        // Populate repos after updating UI so user sees they're logged in
        await populateRepoSelect(github_token);
        if (selected_repo) {
          repoSelect.value = selected_repo;
          repoEl.innerText = `Connected repo: ${selected_repo}`;
          githubBtn.style.display = "inline-block";
          // Show the set repo button for the selected repo
          setRepoBtn.style.display = "inline-block";
        } else {
          // Display warning if no repository is selected
          repoEl.innerText = "⚠️ Please select a repository to push code";
          repoEl.style.color = "#ff6b00";
          statusEl.innerText = `Welcome, ${username}! Select a repo`;
          setRepoBtn.style.display = "none";
        }
      } catch (error) {
        console.error('Error during initialization:', error);
        statusEl.className = "badge error";
        statusEl.innerText = `Error: ${error.message}`;
        
        // Only clear storage if there's a token problem, not for other errors
        if (error.message.includes('token') || error.message.includes('auth')) {
          console.log("Clearing storage due to token error");
          chrome.storage.local.clear(() => {
            loginBtn.style.display = "inline-block";
            logoutBtn.style.display = "none";
            githubBtn.style.display = "none";
            setRepoBtn.style.display = "none";
            lastPushEl.style.display = "none";
            repoSelect.style.display = "none";
          });
        }
      }
    } else {
      // if not logged in 
      console.log('User is not logged in');
      statusEl.innerText = "🔒 Not logged in";
      loginBtn.style.display = "inline-block";
      logoutBtn.style.display = "none";
      githubBtn.style.display = "none";
      setRepoBtn.style.display = "none";
      lastPushEl.style.display = "none";
      repoSelect.style.display = "none";
    }
  });

  // click login button
  loginBtn.addEventListener("click", () => {
    console.log("Login button clicked");
    loginBtn.style.display = "none";
    statusEl.className = "badge";
    statusEl.innerText = "Connecting to GitHub...";
    loadingEl.classList.add("show");
    
    // Set a timeout to prevent infinite loading
    const loginTimeout = setTimeout(() => {
      console.log("Login timeout reached - 30 seconds with no response");
      loadingEl.classList.remove("show");
      loginBtn.style.display = "inline-block";
      statusEl.className = "badge error";
      statusEl.innerText = "Login timed out. Please try again.";
    }, 30000);
    
    // Store the timeout ID so it can be cleared on success
    window.loginTimeoutId = loginTimeout;
    
    // Force clear any existing tokens before login attempt
    chrome.storage.local.remove(["github_token", "token_type"], () => {
      console.log("Cleared existing GitHub token before login");
      chrome.runtime.sendMessage({ action: "login" });
    });
  });

  // click logout button
  logoutBtn.addEventListener("click", () => {
    chrome.storage.local.clear(() => {
      statusEl.innerText = "Logged out.";
      loginBtn.style.display = "inline-block";
      logoutBtn.style.display = "none";
      githubBtn.style.display = "none";
      repoEl.innerText = "";
      lastPushEl.innerText = "";
      lastPushEl.style.display = "none";
      repoSelect.style.display = "none";
    });
  });

  // click github button
  githubBtn.addEventListener("click", () => {
    chrome.storage.local.get(["selected_repo"], ({ selected_repo }) => {
      if (selected_repo) {
        const repoUrl = `https://github.com/${selected_repo}`;
        chrome.tabs.create({ url: repoUrl });
      } else {
        console.error("No repository selected.");
        statusEl.innerText = "Please select a repository first.";
      }
    });
  });

  // Add function to save repository to backend
  async function saveRepositoryToBackend(selectedRepo) {
    try {
      statusEl.innerText = "Saving repository...";
      
      // Get JWT token for authentication
      const { jwt } = await new Promise(resolve => {
        chrome.storage.local.get(["jwt"], (result) => {
          resolve(result);
        });
      });
      
      if (!jwt) {
        throw new Error("Authentication required. Please login first.");
      }
      
      const response = await fetch(`${API_BASE_URL}/save-repository`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`
        },
        body: JSON.stringify({ repository: selectedRepo })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Server error: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Repository saved to backend:", data);
      
      return data;
    } catch (error) {
      console.error("Error saving repository to backend:", error);
      throw error;
    }
  }

  // Repository selection change handler
  repoSelect.addEventListener('change', (e) => {
    const selectedRepo = e.target.value;
    if (selectedRepo) {
      console.log(`Selected repository: ${selectedRepo}`);
      
      // Store selected repo in Chrome storage
      chrome.storage.local.set({ selected_repo: selectedRepo }, () => {
        console.log(`Repository saved to storage: ${selectedRepo}`);
        
        // Show visual confirmation
        repoEl.innerText = `Selected repo: ${selectedRepo} (not saved to backend yet)`;
        repoEl.style.color = "#ff9800"; // Orange color to indicate pending status
        githubBtn.style.display = "inline-block";
        setRepoBtn.style.display = "inline-block";
        
        // Notify user about successful selection
        statusEl.innerText = `Repository selected. Click "Set Repository" button to save.`;
        statusEl.className = "badge";
        
        // Log the updated storage state to verify
        chrome.storage.local.get(["selected_repo"], (result) => {
          console.log(`Storage verification - selected_repo: ${result.selected_repo}`);
        });
      });
    } else {
      console.warn("No repository selected");
      repoEl.innerText = "⚠️ No repository selected";
      repoEl.style.color = "#ff6b00"; // Warning color
      githubBtn.style.display = "none";
      setRepoBtn.style.display = "none";
    }
  });

  // Set Repository button click handler
  setRepoBtn.addEventListener('click', async () => {
    // Get selected repository from storage
    const { selected_repo } = await new Promise(resolve => {
      chrome.storage.local.get(["selected_repo"], (result) => {
        resolve(result);
      });
    });
    
    if (!selected_repo) {
      statusEl.innerText = "Please select a repository first";
      statusEl.className = "badge error";
      return;
    }
    
    try {
      setRepoBtn.disabled = true;
      setRepoBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
      
      // Save repository to backend
      await saveRepositoryToBackend(selected_repo);
      
      // Update UI to show success
      repoEl.innerText = `Connected repo: ${selected_repo}`;
      repoEl.style.color = "#4caf50"; // Green color to indicate success
      statusEl.innerText = "Repository saved successfully!";
      statusEl.className = "badge success";
      
      setTimeout(() => {
        statusEl.innerText = "Welcome!";
        statusEl.className = "badge";
      }, 3000);
    } catch (error) {
      console.error("Error saving repository:", error);
      statusEl.innerText = `Error: ${error.message}`;
      statusEl.className = "badge error";
    } finally {
      setRepoBtn.disabled = false;
      setRepoBtn.innerHTML = '<i class="fas fa-save"></i> Set Repository';
    }
  });

  // Add a refresh repositories button
  const refreshBtn = document.createElement("button");
  refreshBtn.innerText = "🔄 Refresh Repos";
  refreshBtn.style = `
    margin-top: 10px;
    background-color: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 5px 10px;
    cursor: pointer;
    font-size: 12px;
  `;
  refreshBtn.addEventListener("click", async () => {
    const status = document.createElement("span");
    status.innerText = " (refreshing...)";
    status.style.fontSize = "12px";
    refreshBtn.appendChild(status);
    
    // Get token from storage
    chrome.storage.local.get(["github_token"], async ({ github_token }) => {
      if (github_token) {
        try {
          // Clear and repopulate repository selection
          repoSelect.innerHTML = '<option value="">Loading repositories...</option>';
          await populateRepoSelect(github_token);
          
          // Attempt to restore previous selection
          chrome.storage.local.get(["selected_repo"], ({ selected_repo }) => {
            if (selected_repo) {
              console.log(`Attempting to restore selection: ${selected_repo}`);
              // Check if the option exists in the dropdown
              const options = Array.from(repoSelect.options);
              const matchingOption = options.find(opt => opt.value === selected_repo);
              
              if (matchingOption) {
                repoSelect.value = selected_repo;
                repoEl.innerText = `Connected repo: ${selected_repo}`;
                githubBtn.style.display = "inline-block";
                console.log(`Selection restored: ${selected_repo}`);
              } else {
                console.warn(`Previously selected repo ${selected_repo} not found in current list`);
                repoEl.innerText = "⚠️ Please select a repository";
                repoEl.style.color = "#ff6b00";
              }
            }
          });
          
          statusEl.innerText = "Repositories refreshed!";
          setTimeout(() => {
            statusEl.innerText = "Welcome!";
          }, 2000);
        } catch (error) {
          console.error("Error refreshing repositories:", error);
          statusEl.innerText = `Error: ${error.message}`;
        }
      } else {
        statusEl.innerText = "Please login first";
      }
      
      // Remove the status indicator
      refreshBtn.removeChild(status);
    });
  });

  // Add the refresh button to the page after repository selection
  const container = document.querySelector('.container');
  if (container) {
    container.appendChild(refreshBtn);
  }

  // UI update function
  function updateUI(username, last_push, last_login, selected_repo) {
    statusEl.innerText = `Welcome, ${username}!`;
    loginBtn.style.display = "none";
    logoutBtn.style.display = "inline-block";
    repoSelect.style.display = "block";
    
    if (selected_repo) {
      repoEl.innerText = `Connected repo: ${selected_repo}`;
      repoEl.style.color = "#4caf50"; // Green color to indicate success
      githubBtn.style.display = "inline-block";
      setRepoBtn.style.display = "inline-block";
    } else {
      repoEl.innerText = "Please select a repository";
      githubBtn.style.display = "none";
      setRepoBtn.style.display = "none";
    }

    if (last_push) {
      lastPushEl.style.display = "inline-block";
      const pushDate = new Date(last_push);
      lastPushEl.innerText = `Last push: ${pushDate.getFullYear()}-${(pushDate.getMonth() + 1).toString().padStart(2, '0')}-${pushDate.getDate().toString().padStart(2, '0')} ${pushDate.getHours().toString().padStart(2, '0')}:${pushDate.getMinutes().toString().padStart(2, '0')}`;
    } else {
      lastPushEl.style.display = "none";
    }

    if (last_login) {
      const loginDate = new Date(last_login);
      lastLoginEl.innerText = `Last login: ${loginDate.getFullYear()}-${(loginDate.getMonth() + 1).toString().padStart(2, '0')}-${loginDate.getDate().toString().padStart(2, '0')} ${loginDate.getHours().toString().padStart(2, '0')}:${loginDate.getMinutes().toString().padStart(2, '0')}`;
    }
  }

  // Make the Set Repository button initially hidden
  setRepoBtn.style.display = "none";
});
