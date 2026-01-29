function postToPage(payload) {
  window.postMessage(payload, "*");
}

// Notify page that extension is loaded (for getDisplayMedia fallback detection)
postToPage({ source: "voicecopilot-extension", type: "ready" });

window.addEventListener("message", (event) => {
  if (!event.data || event.data.source !== "voicecopilot-web") {
    return;
  }
  if (event.data.type === "startCapture") {
    chrome.runtime.sendMessage({
      type: "startCapture",
      mode: event.data.mode || "tab",
    });
  }
  if (event.data.type === "stopCapture") {
    chrome.runtime.sendMessage({ type: "stopCapture" });
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "audioChunk") {
    postToPage({
      source: "voicecopilot-extension",
      type: "audioChunk",
      data: message.data,
      sampleRate: message.sampleRate,
      channels: message.channels,
    });
  }
  if (message.type === "status") {
    postToPage({
      source: "voicecopilot-extension",
      type: "status",
      status: message.status,
      message: message.message,
    });
  }
});
