import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ensureConfigLoaded } from "./lib/api";
import "./index.css";

ensureConfigLoaded().then(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
