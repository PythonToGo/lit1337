// background.js - OAuth routing handler

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
      console.error("OAuth failed:", chrome.runtime.lastError);
      sendResponse({ success: false });
      return;
    }

    const code = new URL(redirectUri).searchParams.get("code");

    try {
      const response = await fetch(`https://lit1337.up.railway.app/login/github/callback?code=${code}`);
      const data = await response.json();

      if (data?.token) {
        chrome.storage.local.set({
          jwt: data.token,
          username: data.username,
          last_push: new Date().toISOString()
        }, () => {
          console.log("✅ OAuth login saved to chrome.storage");
          sendResponse({ success: true });
        });
      } else {
        console.error("❌ Invalid token received:", data);
        sendResponse({ success: false });
      }
    } catch (err) {
      console.error("OAuth callback fetch error:", err);
      sendResponse({ success: false });
    }
  });

  return true; // async response required
});
