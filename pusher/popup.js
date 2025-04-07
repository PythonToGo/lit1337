const clientId = "Ov23lidbbczriEkuebBd";
const REDIRECT_URL = `https://${chrome.runtime.id}.chromiumapp.org/`;

const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const statusEl = document.getElementById("status");
const repoEl = document.getElementById("repo");
const lastPushEl = document.getElementById("last-push");
const lastLoginEl = document.getElementById("last-login");
const loadingEl = document.getElementById("loading");
const githubBtn = document.getElementById("github-btn");

// Fetch stats from the backend
function fetchStats() {
  fetch(`${API_BASE_URL}/stats`)
    .then(response => response.json())
    .then(data => {
      updateStatsUI(data);
    })
    .catch(error => {
      console.error('Error fetching stats:', error);
    });
}

// Update the UI with stats
function updateStatsUI(stats) {
  const totalSolvedEl = document.getElementById('total-solved');
  const recentProblemsEl = document.getElementById('recent-problems');

  totalSolvedEl.innerText = `Total solved: ${stats.total_solved}`;

  if (stats.recent && stats.recent.length > 0) {
    recentProblemsEl.innerText = 'Recent problems:\n' + stats.recent.map(problem => `- ${problem.filename} at ${problem.timestamp}`).join('\n');
  } else {
    recentProblemsEl.innerText = 'No recent problems.';
  }
}

// initial render: check JWT + check if user exists on server
chrome.storage.local.get(["jwt", "username", "last_push", "last_login"], ({ jwt, username, last_push, last_login }) => {
  if (jwt && username) {
    updateUI(username, last_push, last_login);
    fetchStats();
  } else {
    // if not logged in 
    statusEl.innerText = "🔒 Not logged in";
    loginBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";
    githubBtn.style.display = "none"; // Hide GitHub button when not logged in
    lastPushEl.style.display = "none"; // Hide last push element when not logged in
  }
});

// click login button
loginBtn.addEventListener("click", () => {
  loadingEl.classList.add("show");

  chrome.runtime.sendMessage({ type: "oauth-login" }, (response) => {
    loadingEl.classList.remove("show");

    console.log("Login response:", response);

    if (response.success) {
      const { token, last_push } = response;

      chrome.storage.local.set({ jwt: token }, () => {
        console.log("User data saved.");
        location.reload(); // popup refresher
      });
    } else {
      statusEl.innerText = "GitHub login failed.";
    }
  });
});

// click logout button
logoutBtn.addEventListener("click", () => {
  chrome.storage.local.clear(() => {
    statusEl.innerText = "Logged out.";
    loginBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";
    githubBtn.style.display = "none"; // Hide GitHub button on logout
    repoEl.innerText = "";
    lastPushEl.innerText = "";
    lastPushEl.style.display = "none"; // Hide last push element on logout
  });
});

// click github button
githubBtn.addEventListener("click", () => {
  chrome.storage.local.get("username", ({ username }) => {
    if (username) {
      const repoUrl = `https://github.com/${username}/leetcode_repo`;
      chrome.tabs.create({ url: repoUrl }); // 새 탭에서 레포지토리 열기
    } else {
      console.error("Username not found.");
    }
  });
});

// UI update function
function updateUI(username, last_push, last_login) {
  statusEl.innerText = `Welcome, ${username}!`;
  loginBtn.style.display = "none";
  logoutBtn.style.display = "inline-block";
  githubBtn.style.display = "inline-block"; // Show GitHub button when logged in
  repoEl.innerText = `Connected repo: ${username}/leetcode_repo`;

  if (last_push) {
    lastPushEl.style.display = "inline-block"; // Show last push element when there is a last push
    const pushDate = new Date(last_push);
    lastPushEl.innerText = `Last push: ${pushDate.getFullYear()}-${(pushDate.getMonth() + 1).toString().padStart(2, '0')}-${pushDate.getDate().toString().padStart(2, '0')} ${pushDate.getHours().toString().padStart(2, '0')}:${pushDate.getMinutes().toString().padStart(2, '0')}`;
  } else {
    lastPushEl.style.display = "none"; // Hide last push element if no last push
  }

  if (last_login) {
    const loginDate = new Date(last_login);
    lastLoginEl.innerText = `Last login: ${loginDate.getFullYear()}-${(loginDate.getMonth() + 1).toString().padStart(2, '0')}-${loginDate.getDate().toString().padStart(2, '0')} ${loginDate.getHours().toString().padStart(2, '0')}:${loginDate.getMinutes().toString().padStart(2, '0')}`;
  }
}

