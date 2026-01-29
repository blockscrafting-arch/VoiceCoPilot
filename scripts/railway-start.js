const { spawn } = require("node:child_process");

// #region agent log
fetch("http://127.0.0.1:7247/ingest/4d99c64e-0f7e-4f36-90da-c936a6efefa5", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    location: "scripts/railway-start.js",
    message: "Railway start wrapper entry",
    data: {
      cwd: process.cwd(),
      node: process.version,
      envPort: process.env.PORT || null,
      nodeEnv: process.env.NODE_ENV || null,
      argv: process.argv.slice(2),
    },
    timestamp: Date.now(),
    sessionId: "debug-session",
    runId: "railway-start",
    hypothesisId: "H1",
  }),
}).catch(() => {});
// #endregion

const command = "pnpm --filter @voicecopilot/web start";

// #region agent log
fetch("http://127.0.0.1:7247/ingest/4d99c64e-0f7e-4f36-90da-c936a6efefa5", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    location: "scripts/railway-start.js",
    message: "Spawning web start",
    data: { command },
    timestamp: Date.now(),
    sessionId: "debug-session",
    runId: "railway-start",
    hypothesisId: "H3",
  }),
}).catch(() => {});
// #endregion

const child = spawn(command, {
  stdio: "inherit",
  shell: true,
});

child.on("error", (error) => {
  // #region agent log
  fetch("http://127.0.0.1:7247/ingest/4d99c64e-0f7e-4f36-90da-c936a6efefa5", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "scripts/railway-start.js",
      message: "Spawn error",
      data: { message: error.message },
      timestamp: Date.now(),
      sessionId: "debug-session",
      runId: "railway-start",
      hypothesisId: "H3",
    }),
  }).catch(() => {});
  // #endregion
});

child.on("exit", (code, signal) => {
  // #region agent log
  fetch("http://127.0.0.1:7247/ingest/4d99c64e-0f7e-4f36-90da-c936a6efefa5", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "scripts/railway-start.js",
      message: "Child exited",
      data: { code, signal },
      timestamp: Date.now(),
      sessionId: "debug-session",
      runId: "railway-start",
      hypothesisId: "H3",
    }),
  }).catch(() => {});
  // #endregion

  if (code !== null) {
    process.exit(code);
  }
  process.exit(1);
});
