import React from "react";
import ReactDOM from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import App from "./App";
import "./index.css";

const fallbackConvexUrl = "https://honorable-moose-495.convex.cloud";
const convexUrl = import.meta.env.VITE_CONVEX_URL || fallbackConvexUrl;

if (!import.meta.env.VITE_CONVEX_URL) {
  console.warn(
    "Missing VITE_CONVEX_URL. Falling back to production Convex URL:",
    fallbackConvexUrl
  );
}

const convex = new ConvexReactClient(convexUrl);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConvexProvider client={convex}>
      <App />
    </ConvexProvider>
  </React.StrictMode>
);
