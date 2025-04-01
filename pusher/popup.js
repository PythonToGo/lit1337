const clientId = "Ov23lidbbczriEkuebBd";
const REDIRECT_URL = `https://${chrome.runtime.id}.chromiumapp.org/`;

const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const statusEl = document.getElementById("status");
const repoEl = document.getElementById("repo");
const lastPushEl = document.getElementById("last-push");



// 로그인 상태 초기 렌더링
chrome.storage.local.get(["username", "last_push"], ({ username, last_push }) => {
  if (username) {
    updateUI(username, last_push);
  }
});

// chrome.storage.onChanged.addListener((changes, areaName) => {
//   if (areaName === "local" && changes.username) {
//     const username = changes.username.newValue;
//     const last_push = changes.last_push?.newValue;
//     updateUI(username, last_push);
//   }
// });

// 로그인 버튼 클릭
// loginBtn.addEventListener("click", () => {
//   const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(REDIRECT_URL)}&scope=repo&prompt=consent`;

//   chrome.identity.launchWebAuthFlow({
//     url: authUrl,
//     interactive: true
//   }, async (redirectUri) => {
//     if (chrome.runtime.lastError || !redirectUri) {
//       console.error("OAuth failed:", chrome.runtime.lastError);
//       statusEl.innerText = "GitHub login failed. Please try again.";
//       return;
//     }

//     const url = new URL(redirectUri);
//     const code = url.searchParams.get("code");

//     if (!code) {
//       statusEl.innerText = "No authentication code found.";
//       return;
//     }

//     try {
//       const res = await fetch(`http://localhost:8000/login/github/callback?code=${code}`);
//       const data = await res.json();

//       console.log("OAuth response data:", data);

//       chrome.storage.local.set({
//         jwt: data.token,
//         username: data.username,
//         last_push: new Date().toISOString()
//       }, () => {
//         console.log("Storage set:", { token: data.token, username: data.username });

//         // UI 즉시 반영
//         updateUI(data.username, new Date().toISOString());
//         setTimeout(() => {
//           window.close(); // close popup after 2 seconds
//         }, 5000);
//       });

//     } catch (err) {
//       console.error("Token request failed:", err);
//       statusEl.innerText = "Login failed.";
//     }
//   });
// });
loginBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "oauth-login" }, (response) => {
    if (response.success) {
      // storage에 저장된 값으로 다시 로딩
      chrome.storage.local.get(["username", "last_push"], ({ username, last_push }) => {
        updateUI(username, last_push);
      });
    } else {
      statusEl.innerText = "GitHub login failed.";
    }
  });
});



// 로그아웃 버튼 클릭
logoutBtn.addEventListener("click", () => {
  chrome.storage.local.clear(() => {
    statusEl.innerText = "Logged out.";
    loginBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";
    repoEl.innerText = "";
    lastPushEl.innerText = "";
  });
});

// UI 갱신 함수
function updateUI(username, last_push) {
  statusEl.innerText = `Welcome, ${username}!`;
  loginBtn.style.display = "none";
  logoutBtn.style.display = "inline-block";
  repoEl.innerText = `Connected repo: ${username}/leetcode-repo`;

  if (last_push) {
    const date = new Date(last_push);
    lastPushEl.innerText = `Recent push: ${date.toLocaleString()}`;
  }
}
