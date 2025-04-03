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
    const res = await fetch("http://localhost:8000/stats", {
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

function autoSubmitAndPush() {
  if (isPushing) return; // 이미 푸시중이면 중단
  isPushing = true;

  const submitButton = Array.from(document.querySelectorAll("button")).find(btn => btn.innerText.trim().toLowerCase() === "submit");
  const pushBtn = document.getElementById("leet-github-push");

  if (!submitButton || !pushBtn) {
    alert("Submit button not found");
    isPushing = false;
    return;
  }

  pushBtn.innerText = "⏳ Submitting...";
  submitButton.click();

  let attempt = 0;
  const maxTry = 10;
  const interval = setInterval(() => {
    attempt++;

    if (isAcceptedOnly()) {
      clearInterval(interval);
      const confirmed = confirm("✅ Problem accepted!\nDo you want to push your code to GitHub?");
      if (confirmed) {
        pushCodeToGitHub(pushBtn).finally(() => {
          isPushing = false;
        });
      } else {
        pushBtn.innerText = "🔁 Push";
        isPushing = false;
      }
    }

    if (attempt >= maxTry) {
      clearInterval(interval);
      pushBtn.innerText = "❌ Not Accepted";
      isPushing = false;
    }
  }, 1500);
}

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

  pushBtn.onclick = () => autoSubmitAndPush();
  buttonGroup.insertBefore(pushBtn, buttonGroup.firstChild);
}

async function pushCodeToGitHub(pushBtn = document.getElementById("leet-github-push")) {
  const meta = getProblemMeta();
  const slug = meta?.slug;
  const title = meta?.title;

  if (!slug || !title) {
    pushBtn.innerText = "❌ Error";
    return;
  }

  // submit 강제실행
  const submitButton = Array.from(document.querySelectorAll("button"))
    .find(btn => btn.innerText.trim().toLowerCase() === "submit");
  if (submitButton) submitButton.click();

  // 5~15초 내 accepted 검사 반복
  let accepted = false;
  const interval = setInterval(() => {
    if (isAcceptedOnly()) {
      accepted = true;
      clearInterval(interval);
    }
  }, 3000);

  await new Promise(resolve => setTimeout(() => {
    clearInterval(interval);
    resolve();
  }, 15000));

  if (!accepted) {
    pushBtn.innerText = "❌ Not Accepted";
    return;
  }

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
    const res = await fetch("http://localhost:8000/push-code", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`
      },
      body: JSON.stringify({ filename, code })
    });

    const data = await res.json();

    if (res.ok) {
      if (data.message === "Already pushed!") {
        pushBtn.innerText = "⚠️ Already";
      } else if (data.message === "No change") {
        pushBtn.innerText = "🟡 No change";
      } else {
        pushBtn.innerText = "✅ Push";
      }
    } else {
      pushBtn.innerText = "❌ Failed";
    }
  } catch (err) {
    console.error("Push error:", err);
    pushBtn.innerText = "❌ Error";
  }

  pushBtn.disabled = false;
  await getStatsFromAPI();
}


function waitForEditorAndInsertButton() {
  const editor = document.querySelector('.monaco-editor');
  if (editor) {
    addPushButton();
    // monitorSubmitButton();
  } else {
    let retry = 0;
    const interval = setInterval(() => {
      if (document.querySelector('.monaco-editor')) {
        addPushButton();
        // monitorSubmitButton();
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
});
observer.observe(document.body, { childList: true, subtree: true });

// first call
setTimeout(waitForEditorAndInsertButton, 1000);