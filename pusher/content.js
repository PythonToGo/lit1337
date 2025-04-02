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

// extract code from editor
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
    const number = data?.data?.question?.questionFrontendId;
    return number ? number.padStart(4, "0") : null;
  } catch (err) {
    console.error("GraphQL error:", err);
    return null;
  }
}

function isAcceptedOrSolved() {
  // Case 1: Solved
  const solvedXPath = '/html/body/div[1]/div[2]/div/div/div[4]/div/div/div[4]/div/div[1]/div[1]/div[2]';
  const solvedElem = document.evaluate(solvedXPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
  if (solvedElem && solvedElem.textContent.trim() === "Solved") return true;

  // Case 2: Accepted
  const acceptedXPath = '/html/body/div[1]/div[2]/div/div/div[4]/div/div/div[11]/div/div/div/div[2]/div/div[1]/div[1]/div[1]/span';
  const acceptedElem = document.evaluate(acceptedXPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
  if (acceptedElem && acceptedElem.textContent.trim() === "Accepted") return true;

  return false;
}

function monitorSubmitButton() {
  const submitXPath = '/html/body/div[1]/div[2]/div/div/div[4]/div/div/div[8]/div/div[3]/div[2]/div[2]/div[2]/div[2]/div/button/span';
  const submitBtn = document.evaluate(submitXPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;

  if (!submitBtn) return;

  const realBtn = submitBtn.closest("button");
  if (!realBtn || realBtn.dataset.listenerAttached) return;

  realBtn.dataset.listenerAttached = "true";
  realBtn.addEventListener("click", () => {
    const pushBtn = document.getElementById("leet-github-push");
    if (pushBtn) pushBtn.innerText = "🔁 Push";

    setTimeout(() => {
      if (isAcceptedOrSolved()) {
        const confirmed = confirm("✅ Problem accepted!\nDo you want to push your code to GitHub?");
        if (confirmed) {
          pushCodeToGitHub();
        }
      }
    }, 3000);
  });
}

// add push button
function addPushButton() {
  if (document.getElementById("leet-github-push")) return;

  const buttonGroupXPath = '/html/body/div[1]/div[2]/div/div/div[4]/div/div/div[8]/div/div[1]/div[2]';
  const buttonGroup = document.evaluate(buttonGroupXPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;

  if (!buttonGroup) {
    console.warn("[PushButton] Button group container not found.");
    return;
  }

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

  pushBtn.onclick = () => pushCodeToGitHub(pushBtn);
  buttonGroup.insertBefore(pushBtn, buttonGroup.firstChild);
}

async function pushCodeToGitHub(pushBtn = document.getElementById("leet-github-push")) {
  if (!isAcceptedOrSolved()) {
    if (pushBtn) {
      pushBtn.innerText = "❌ Not Accepted";
      pushBtn.disabled = false;
    }
    return;
  }

  if (pushBtn) {
    pushBtn.disabled = true;
    pushBtn.innerText = "⏳ Loading";
  }

  const meta = getProblemMeta();
  const slug = meta?.slug;
  const title = meta?.title;
  if (!slug || !title) {
    if (pushBtn) pushBtn.innerText = "❌ Error";
    return;
  }

  const problemNumber = await getProblemNumberFromSlug(slug);
  if (!problemNumber) {
    if (pushBtn) pushBtn.innerText = "❌ Error";
    return;
  }

  const lang = getLanguageFromEditor();
  const ext = getExtensionFromLang(lang || 'txt');
  const code = getCode();
  const filename = `${problemNumber}_${title}.${ext}`;

  chrome.storage.local.get("jwt", ({ jwt }) => {
    if (!jwt) {
      alert("Please log in via popup first.");
      if (pushBtn) pushBtn.innerText = "❌ No Login";
      return;
    }

    fetch("http://localhost:8000/push-code", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`
      },
      body: JSON.stringify({ filename, code })
    })
      .then(res => res.json())
      .then(data => {
        if (data.status === 200 || data.status === 201) {
          if (pushBtn) pushBtn.innerText = "✅ Push";
        } else {
          if (pushBtn) pushBtn.innerText = "❌ Failed";
        }
        if (pushBtn) pushBtn.disabled = false;
      })
      .catch(err => {
        console.error("Push error:", err);
        if (pushBtn) {
          pushBtn.innerText = "❌ Error";
          pushBtn.disabled = false;
        }
      });
  });
}

function waitForEditorAndInsertButton() {
  const editor = document.querySelector('.monaco-editor');
  if (editor) {
    addPushButton();
    monitorSubmitButton();
  } else {
    let retry = 0;
    const interval = setInterval(() => {
      if (document.querySelector('.monaco-editor')) {
        addPushButton();
        monitorSubmitButton();
        clearInterval(interval);
      } else if (retry++ > 50) {
        clearInterval(interval);
      }
    }, 100);
  }
}

const observer = new MutationObserver(() => {
  waitForEditorAndInsertButton();
});
observer.observe(document.body, { childList: true, subtree: true });

// first call
setTimeout(waitForEditorAndInsertButton, 1000);