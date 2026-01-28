let audioContext = null;
let processor = null;
let mediaStream = null;

async function startCapture() {
  if (audioContext) {
    return;
  }
  try {
    mediaStream = await chrome.tabCapture.capture({
      audio: true,
      video: false,
    });
    if (!mediaStream) {
      chrome.runtime.sendMessage({
        type: "status",
        status: "error",
        message: "Не удалось захватить звук вкладки.",
      });
      return;
    }

    audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(mediaStream);
    processor = audioContext.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0);
      const pcm16 = new Int16Array(input.length);
      for (let i = 0; i < input.length; i += 1) {
        const sample = Math.max(-1, Math.min(1, input[i]));
        pcm16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      }
      chrome.runtime.sendMessage({
        type: "audioChunk",
        data: pcm16.buffer,
        sampleRate: audioContext.sampleRate,
        channels: 1,
      });
    };

    source.connect(processor);
    processor.connect(audioContext.destination);
    chrome.runtime.sendMessage({
      type: "status",
      status: "started",
    });
  } catch (error) {
    chrome.runtime.sendMessage({
      type: "status",
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

async function stopCapture() {
  if (processor) {
    processor.disconnect();
    processor = null;
  }
  if (audioContext) {
    await audioContext.close();
    audioContext = null;
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }
  chrome.runtime.sendMessage({ type: "status", status: "stopped" });
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "offscreenStart") {
    startCapture();
  }
  if (message.type === "offscreenStop") {
    stopCapture();
  }
});
