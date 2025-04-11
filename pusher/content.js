let isPushing = false;
let cachedJwt = null;

function getLanguageFromEditor() {
  // find language button
  const buttonXPath = '/html/body/div[1]/div[2]/div/div/div[4]/div/div/div[8]/div/div[1]/div[1]/div[1]/button/button';

  const button = document.evaluate(buttonXPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;

  if (button) {
    const lang = (button.innerText || button.textContent).trim().toLowerCase();
    console.log(`[LangDetect] Detected language: ${lang}`);
    return lang;
  }

  console.warn("[LangDetect] Could not detect language from editor.");
  return null;
}
function getExtensionFromLang(lang) {
  const map = {
    python: 'py',
    python3: 'py',
    cpp: 'cpp',
    'c++': 'cpp',
    java: 'java',
    javascript: 'js',
    typescript: 'ts',
    c: 'c',
    csharp: 'cs',
    ruby: 'rb',
    go: 'go',
    rust: 'rs',
    swift: 'swift',
    kotlin: 'kt',
    scala: 'scala',
    php: 'php'
  };
  return map[lang] || 'txt';
}

function getCode() {
  const codeLines = document.querySelectorAll('.view-line');
  if (!codeLines || codeLines.length === 0) {
    return "// No code found";
  }

  let code = '';
  codeLines.forEach(line => {
    code += line.innerText + '\n';
  });
  return code.trim();
}

function getProblemMeta() {
  const urlParts = window.location.pathname.split("/");
  const slug = urlParts.includes("problems") ? urlParts[urlParts.indexOf("problems") + 1] : null;
  if (!slug) return null;

  const title = slug
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join("_");

  return { slug, title };
}

function getCsrfToken() {
  const cookies = document.cookie.split("; ");
  const csrf = cookies.find(row => row.startsWith("csrftoken="));
  return csrf ? csrf.split("=")[1] : "";
}

function getJwtToken() {
  return new Promise((resolve, reject) => {
    if (cachedJwt) {
      return resolve(cachedJwt);
    }

    chrome.storage.local.get("jwt", ({ jwt }) => {
      if (jwt) {
        cachedJwt = jwt;
        resolve(jwt);
      } else {
        reject("JWT not found");
      }
    });
  });
}

async function getProblemNumberFromSlug(slug) {
  const query = {
    operationName: "getQuestionDetail",
    query: `
      query getQuestionDetail($titleSlug: String!) {
        question(titleSlug: $titleSlug) {
          questionFrontendId
        }
      }
    `,
    variables: { titleSlug: slug }
  };

  try {
    const res = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "x-csrftoken": getCsrfToken()
      },
      body: JSON.stringify(query)
    });

    const data = await res.json();
    // console.log("Stats:", data);
    const number = data?.data?.question?.questionFrontendId;
    return number ? number.padStart(4, "0") : null;
  } catch (err) {
    console.error("GraphQL error:", err);
    return null;
  }
}

async function getStatsFromAPI() {
  let jwt;
  try {
    jwt = await getJwtToken(); // 저장된 JWT 불러오기
  } catch (e) {
    console.error("❌ JWT Load Error:", e);
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/stats`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${jwt}`
      }
    });

    const data = await res.json();
    console.log("📊 Stats API Response:", data);
  } catch (err) {
    console.error("❌ Failed to fetch stats:", err);
  }
}

function isAcceptedOnly() {
  const acceptedXPath = '/html/body/div[1]/div[2]/div/div/div[4]/div/div/div[11]/div/div/div/div[2]/div/div[1]/div[1]/div[1]/span';
  const acceptedElem = document.evaluate(acceptedXPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
  return acceptedElem && acceptedElem.textContent.trim() === "Accepted";
}

function getSubmissionResult() {
  const resultXPath = '/html/body/div[1]/div[2]/div/div/div[4]/div/div/div[11]/div/div/div/div[2]/div/div[1]/div[1]/div[1]/span';
  const resultElem = document.evaluate(resultXPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
  return resultElem ? resultElem.textContent.trim() : null;
}

// Submit 버튼 클릭 후 상태를 모니터링하는 함수
function monitorSubmissionStatus(pushBtn) {
  let attempt = 0;
  const maxAttempts = 10; // 최대 15초 대기 (1.5초 * 10)
  
  const interval = setInterval(() => {
    attempt++;
    
    // Submit 결과가 나온 경우
    if (document.querySelector('.view-line')) {
      const result = getSubmissionResult();
      if (result) {
        clearInterval(interval);
        
        if (result === "Accepted") {
          pushCodeToGitHub(pushBtn).finally(() => {
            isPushing = false;
          });
        } else {
          pushBtn.innerText = `❌ ${result}`;
          isPushing = false;
        }
      } else if (attempt >= maxAttempts) {
        clearInterval(interval);
        pushBtn.innerText = "❌ No Result";
        isPushing = false;
      }
    }
    
    // timeout
    if (attempt >= maxAttempts) {
      clearInterval(interval);
      pushBtn.innerText = "❌ Timeout";
      isPushing = false;
    }
  }, 1500);
}

// Push button click handler
function handlePushButtonClick() {
  if (isPushing) return;
  isPushing = true;

  const pushBtn = document.getElementById("leet-github-push");
  const submitButton = Array.from(document.querySelectorAll("button"))
    .find(btn => btn.innerText.trim().toLowerCase() === "submit");

  if (!submitButton || !pushBtn) {
    alert("Submit button not found");
    isPushing = false;
    return;
  }

  // Submit button click and monitor status
  pushBtn.innerText = "⏳ Submitting...";
  submitButton.click();
  monitorSubmissionStatus(pushBtn);
}

// Add push button
function addPushButton() {
  if (document.getElementById("leet-github-push")) return;

  const buttonGroupXPath = '/html/body/div[1]/div[2]/div/div/div[4]/div/div/div[8]/div/div[1]/div[2]';
  const buttonGroup = document.evaluate(buttonGroupXPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;

  if (!buttonGroup) return;

  const pushBtn = document.createElement("button");
  pushBtn.id = "leet-github-push";
  pushBtn.innerText = "🔄 Push";
  pushBtn.style = `
    margin-right: 8px;
    background-color: #24292e;
    color: white;
    padding: 6px 12px;
    border-radius: 5px;
    border: none;
    font-weight: bold;
    cursor: pointer;
  `;

  pushBtn.onclick = handlePushButtonClick;
  buttonGroup.insertBefore(pushBtn, buttonGroup.firstChild);
}

// Modify monitorSubmitButton to reset button state after manual submission
function monitorSubmitButton() {
  const pushBtn = document.getElementById("leet-github-push");
  if (!pushBtn) return;

  const observer = new MutationObserver((mutations) => {
    // Only update button state if not in pushing process
    if (!isPushing) {
      const currentText = pushBtn.innerText;
      // Reset button only if it was in an error state (starts with ❌)
      if (currentText.startsWith("❌")) {
        pushBtn.innerText = "🔄 Push";
      }
    }
  });

  // Monitor result container
  const resultContainer = document.querySelector('.view-line')?.parentElement;
  if (resultContainer) {
    observer.observe(resultContainer, {
      childList: true,
      characterData: true,
      subtree: true
    });
  }
}

async function pushCodeToGitHub(pushBtn) {
  // 이미 Accepted인지 먼저 확인
  if (!isAcceptedOnly()) {
    pushBtn.innerText = "❌ Not Accepted";
    return;
  }

  const meta = getProblemMeta();
  if (!meta?.slug || !meta?.title) {
    pushBtn.innerText = "❌ Error";
    return;
  }

  const slug = meta.slug;
  const title = meta.title;

  const lang = getLanguageFromEditor();
  const ext = getExtensionFromLang(lang || 'txt');
  const code = getCode();

  if (!code || code.trim().startsWith("// No code")) {
    pushBtn.innerText = "❌ Empty";
    return;
  }

  const problemNumber = await getProblemNumberFromSlug(slug);
  const filename = `${problemNumber}_${title}.${ext}`;

  let jwt;
  try {
    jwt = await getJwtToken();
  } catch (e) {
    pushBtn.innerText = "❌ No Login";
    return;
  }

  pushBtn.innerText = "⏳ Loading";
  pushBtn.disabled = true;

  try {
<<<<<<< Updated upstream
    const res = await fetch(`${API_BASE_URL}/push-code`, {
=======
    console.log(`Pushing to repository: ${selectedRepo}`);
    
    // Check repository format
    if (!selectedRepo.includes('/')) {
      pushBtn.innerText = "❌ Invalid Repo";
      console.error("Invalid repository format. Should be 'username/repo'");
      alert("Repository format is invalid. It should be in the format 'username/repo'");
      return;
    }
    
    // Create request body with proper format
    const requestBody = { 
      filename, 
      code,
      selected_repo: selectedRepo
    };
    
    // Validate required fields
    if (!filename || !code || !selectedRepo) {
      pushBtn.innerText = "❌ Invalid Data";
      console.error("Missing required fields for push", { filename, codeLength: code?.length, selectedRepo });
      return;
    }
    
    // Log request details
    console.log("Request to:", `${API_BASE_URL}/push-code`);
    console.log("Request body:", { ...requestBody, code: code.length > 50 ? `${code.substring(0, 50)}...` : code });
    console.log("JWT Length:", jwt ? jwt.length : 'none');
    console.log("JWT Token:", jwt ? jwt : 'none');
    
    // Setup request with proper headers
    const options = {
>>>>>>> Stashed changes
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${jwt}`,
<<<<<<< Updated upstream
        "Accept": "application/json",
        "Origin": "https://leetcode.com"
=======
        "Accept": "application/json"
>>>>>>> Stashed changes
      },
      credentials: 'include',
      mode: 'cors',
<<<<<<< Updated upstream
      body: JSON.stringify({ 
        filename, 
        code,
        origin: "https://leetcode.com"
      })
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      console.error("Server error:", errorData);
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const data = await res.json();

    if (res.ok) {
      if (data.message === "Already pushed!") {
        pushBtn.innerText = "⚠️ Already";
      } else if (data.message === "No change") {
        pushBtn.innerText = "🟡 No change";
      } else {
        const pushedAt = data.pushed_at || new Date().toISOString();
        chrome.storage.local.set({ last_push: pushedAt }, () => {
          console.log(`[Push] Last push: ${pushedAt}`);
        });
        pushBtn.innerText = "✅ Push";
      }
=======
      cache: 'no-cache',
      body: JSON.stringify(requestBody)
    };
    
    console.log("Fetch options:", { ...options, body: "..." });
    
    // Make the API request
    let res;
    try {
      res = await fetch(`${API_BASE_URL}/push-code`, options);
      console.log(`API Response Status: ${res.status} ${res.statusText}`);
      console.log("Response Headers:", Object.fromEntries(res.headers.entries()));
    } catch (fetchError) {
      console.error("Fetch network error:", fetchError);
      pushBtn.innerText = "❌ Network";
      throw new Error(`Network error: ${fetchError.message}`);
    }

    // Handle non-ok responses
    if (!res.ok) {
      let errorInfo = "";
      try {
        // Try to parse JSON response
        const errorData = await res.json();
        console.error("Server JSON error:", errorData);
        errorInfo = JSON.stringify(errorData);
        
        // Special handling for 404 Not Found repository errors
        if ((res.status === 404 || 
            (res.status === 500 && errorData.detail && (
              errorData.detail.includes("404") || 
              errorData.detail.includes("not found") || 
              errorData.detail.includes("not accessible")
            ))
            )) {
          console.error("Repository not found error:", errorData);
          pushBtn.innerText = "❌ Repo Not Found";
          
          // Check if the user has selected a repository
          chrome.storage.local.get(['selected_repo', 'username'], ({ selected_repo, username }) => {
            // In case the selected repo is actually invalid, verify it
            if (selected_repo) {
              // If the user is the owner, suggest creating the repo
              const repoOwner = selected_repo.split('/')[0];
              
              if (username && repoOwner === username) {
                // User may need to create the repository
                const confirmCreate = confirm(`Repository '${selected_repo}' does not exist. Would you like to create it first?`);
                if (confirmCreate) {
                  // Open GitHub page to create a new repository
                  try {
                    // Check if we're in a content script (which doesn't have direct access to chrome.tabs.create)
                    if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
                      // Send a message to background script to open the tab
                      chrome.runtime.sendMessage({ 
                        action: "open_url", 
                        url: 'https://github.com/new' 
                      }, (response) => {
                        if (chrome.runtime.lastError) {
                          console.error("Error sending message:", chrome.runtime.lastError);
                          // Fallback: Try to open in current tab
                          window.open('https://github.com/new', '_blank');
                        }
                      });
                    } else {
                      // Direct approach if we're in popup script or have tabs permission
                      window.open('https://github.com/new', '_blank');
                    }
                  } catch (error) {
                    console.error("Error opening GitHub new repo page:", error);
                    // Fallback option
                    alert("Please create a new repository at github.com/new");
                  }
                }
              } else {
                // Different owner, show permissions error
                alert(`Repository '${selected_repo}' not found or not accessible. Please check if it exists and you have permissions.`);
              }
            } else {
              // No repository selected
              alert("No repository selected. Please select a repository in the extension popup.");
            }
          });
          return;
        }
        
        // Handle authentication errors
        if (res.status === 401 || 
            (errorData.detail && (
              errorData.detail.includes("authentication") || 
              errorData.detail.includes("token") ||
              errorData.detail.includes("Authorization")
            ))
           ) {
          console.error("Authentication error:", errorData);
          pushBtn.innerText = "❌ Auth Error";
          
          // Prompt for re-login
          const confirmRelogin = confirm("Your GitHub authentication has expired. Would you like to log in again?");
          if (confirmRelogin) {
            // Clear existing tokens and reload the extension popup
            chrome.storage.local.remove(["jwt", "github_token"], () => {
              chrome.runtime.sendMessage({ action: "login" });
            });
          }
          return;
        }
      } catch (jsonError) {
        // If not JSON, try to get text
        try {
          const errorText = await res.text();
          console.error("Server text error:", errorText);
          errorInfo = errorText;
        } catch (textError) {
          errorInfo = "Could not read error response";
          console.error("Error reading response:", textError);
        }
      }
      throw new Error(`HTTP error! status: ${res.status}, details: ${errorInfo}`);
    }

    // Parse successful response
    let data;
    try {
      data = await res.json();
      console.log("API Success Response:", data);
    } catch (parseError) {
      console.error("Error parsing success response:", parseError);
      throw new Error("Invalid JSON in success response");
    }

    // Update UI based on response
    if (data.message === "Already pushed!") {
      pushBtn.innerText = "⚠️ Already";
    } else if (data.message === "No change") {
      pushBtn.innerText = "🟡 No change";
>>>>>>> Stashed changes
    } else {
      pushBtn.innerText = "❌ Failed";
    }
  } catch (err) {
    console.error("Push error:", err);
    pushBtn.innerText = "❌ Error";
    if (err.message) console.error("Error message:", err.message);
    if (err.stack) console.error("Error stack:", err.stack);
  }

  pushBtn.disabled = false;
  await getStatsFromAPI();
}


function waitForEditorAndInsertButton() {
  const editor = document.querySelector('.monaco-editor');
  if (editor) {
    addPushButton();
  } else {
    let retry = 0;
    const interval = setInterval(() => {
      if (document.querySelector('.monaco-editor')) {
        addPushButton();
        clearInterval(interval);
      } else if (retry++ > 50) {
        clearInterval(interval);
      }
    }, 100);
  }
}

waitForEditorAndInsertButton();
const observer = new MutationObserver(() => {
  waitForEditorAndInsertButton();
  monitorSubmitButton();
});
observer.observe(document.body, { childList: true, subtree: true });

// first call
setTimeout(() => {
  waitForEditorAndInsertButton();
  monitorSubmitButton();
}, 1000);

document.addEventListener("keydown", function (e) {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const isShortcut = (isMac && e.metaKey && !e.ctrlKey && !e.altKey && e.key === 'm') ||
                     (!isMac && e.ctrlKey && !e.metaKey && !e.altKey && e.key === 'm');

  if (isShortcut) {
    e.preventDefault(); // prevent browser behavior like minimizing
    const pushBtn = document.getElementById("leet-github-push");
    if (pushBtn) {
      console.log("Shortcut triggered: Push to GitHub");
      handlePushButtonClick();
    } else {
      console.warn("Push button not found.");
    }
  }
});