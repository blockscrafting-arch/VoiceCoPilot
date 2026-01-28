let activeTabId = null;
let offscreenReady = false;

async function ensureOffscreen() {
  if (offscreenReady) {
    return;
  }
  const existing = await chrome.offscreen.hasDocument();
  if (!existing) {
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: ["USER_MEDIA"],
      justification: "Capture and process audio for VoiceCoPilot.",
    });
  }
  offscreenReady = true;
}

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === "startCapture") {
    activeTabId = sender.tab?.id ?? null;
    ensureOffscreen().then(() => {
      chrome.runtime.sendMessage({
        type: "offscreenStart",
        tabId: activeTabId,
        mode: message.mode || "tab",
      });
    });
  }

  if (message.type === "stopCapture") {
    chrome.runtime.sendMessage({ type: "offscreenStop" });
  }

  if (message.type === "audioChunk" && activeTabId) {
    chrome.tabs.sendMessage(activeTabId, message);
  }
});
