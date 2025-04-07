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
    const res = await fetch(`${API_BASE_URL}/push-code`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${jwt}`,
        "Accept": "application/json",
        "Origin": "https://leetcode.com"
      },
      credentials: 'include',
      mode: 'cors',
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