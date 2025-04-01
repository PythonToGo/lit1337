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

// add push button
function addPushButton() {
  if (document.getElementById("leet-github-push")) return;

  const btn = document.createElement("button");
  btn.id = "leet-github-push";
  btn.innerText = "Push to GitHub";
  btn.style = `
    position: fixed;
    bottom: 40px;
    right: 30px;
    z-index: 9999;
    padding: 10px 16px;
    background: #24292e;
    color: white;
    border: none;
    border-radius: 5px;
    font-weight: bold;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  `;

  btn.onclick = pushCodeToGitHub;
  document.body.appendChild(btn);
}

async function pushCodeToGitHub() {
  const meta = getProblemMeta();
  const slug = meta?.slug;
  const title = meta?.title;

  if (!slug || !title) {
    alert("Could not detect problem slug or title.");
    return;
  }

  const problemNumber = await getProblemNumberFromSlug(slug);
  if (!problemNumber) {
    alert("Could not fetch problem number.");
    return;
  }

  const lang = getLanguageFromEditor();
  const ext = getExtensionFromLang(lang || 'txt');
  const code = getCode();
  const filename = `${problemNumber}_${title}.${ext}`;

  chrome.storage.local.get("jwt", ({ jwt }) => {
    if (!jwt) {
      alert("Please log in via popup first.");
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
          alert(`Pushed as ${filename}`);
        } else {
          alert("Push failed: " + JSON.stringify(data));
        }
      })
      .catch(err => {
        console.error("Push error:", err);
        alert("Push error occurred.");
      });
  });
}

// detect DOM change & insert push button
function waitForEditorAndInsertButton() {
  const editor = document.querySelector('.monaco-editor');
  if (editor) {
    addPushButton();
  } else {
    // retry every 100ms for 5 seconds
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

const observer = new MutationObserver(() => {
  waitForEditorAndInsertButton();
});
observer.observe(document.body, { childList: true, subtree: true });

// try initial insertion for safety
setTimeout(waitForEditorAndInsertButton, 1000);