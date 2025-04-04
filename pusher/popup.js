const clientId = "Ov23lidbbczriEkuebBd";
const REDIRECT_URL = `https://${chrome.runtime.id}.chromiumapp.org/`;

const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const statusEl = document.getElementById("status");
const repoEl = document.getElementById("repo");
const lastPushEl = document.getElementById("last-push");

// 초기 렌더링: JWT 검사 + 서버에 유저 존재 확인
chrome.storage.local.get(["jwt", "username", "last_push"], ({ jwt, username, last_push }) => {
  if (!jwt) return;

  fetch("https://lit1337.up.railway.app/me", {
    headers: { Authorization: `Bearer ${jwt}` }
  })
    .then((res) => {
      if (!res.ok) throw new Error("Invalid or expired token");
      return res.json();
    })
    .then(() => {
      // 서버에서도 유저가 존재 → UI 렌더
      updateUI(username, last_push);
    })
    .catch(() => {
      // 서버에는 유저 없음 → 로그아웃 처리
      chrome.storage.local.clear(() => {
        statusEl.innerText = "Session expired. Please login again.";
        loginBtn.style.display = "inline-block";
        logoutBtn.style.display = "none";
        repoEl.innerText = "";
        lastPushEl.innerText = "";
      });
    });
});

// 로그인 버튼 클릭
loginBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "oauth-login" }, (response) => {
    if (response.success) {
      const { username, last_push, token } = response;

      // JWT + 유저 정보 저장
      chrome.storage.local.set(
        { jwt: token, username, last_push },
        () => updateUI(username, last_push)
      );
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

// UI 업데이트 함수
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

chrome.runtime.onStartup?.addListener(() => {
  chrome.storage.local.clear();
});
chrome.runtime.onInstalled?.addListener(() => {
  chrome.storage.local.clear();
});
