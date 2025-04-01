// background.js is only for message routing

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "oauth-login") {
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

      const url = new URL(redirectUri);
      const code = url.searchParams.get("code");

      try {
        const res = await fetch(`http://localhost:8000/login/github/callback?code=${code}`);
        const data = await res.json();

        chrome.storage.local.set({
          jwt: data.token,
          username: data.username,
          last_push: new Date().toISOString()
        }, () => {
          console.log("Login success stored in chrome.storage");
          sendResponse({ success: true });
        });
      } catch (err) {
        console.error("OAuth callback error:", err);
        sendResponse({ success: false });
      }
    });

    // 비동기 응답을 기다리도록 반환 true
    return true;
  }
});
