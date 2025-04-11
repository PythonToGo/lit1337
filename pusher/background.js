// background.js - OAuth routing handler
importScripts("config.js");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type !== "oauth-login") return;

  const clientId = "Ov23lidbbczriEkuebBd";
  const REDIRECT_URL = `https://${chrome.runtime.id}.chromiumapp.org/`;
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(REDIRECT_URL)}&scope=repo&prompt=consent`;

  chrome.identity.launchWebAuthFlow({
    url: authUrl,
    interactive: true
  }, async (redirectUri) => {
    if (chrome.runtime.lastError || !redirectUri) {
      console.error("❌ OAuth failed:", chrome.runtime.lastError?.message || "No redirect URI");
      sendResponse({ success: false });
      return;
    }

    const code = new URL(redirectUri).searchParams.get("code");

    if (!code) {
      console.error("❌ No code in redirect URI:", redirectUri);
      sendResponse({ success: false });
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/login/github/callback?code=${code}`);
      const data = await response.json();

      if (data?.token) {
        chrome.storage.local.set({
          jwt: data.token,
          username: data.username,
          last_push: data.last_push,
          last_login: data.last_login
        }, () => {
          console.log("✅ OAuth login saved to chrome.storage");
          sendResponse({ success: true });
        });
      } else {
        console.error("❌ Invalid token received:", data);
        sendResponse({ success: false });
      }
    } catch (err) {
      console.error("❌ OAuth callback fetch error:", err);
      sendResponse({ success: false });
    }
  });
  return true;
});
