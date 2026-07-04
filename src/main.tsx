import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "@fontsource/sora/400.css";
import "@fontsource/sora/600.css";
import "@fontsource/sora/700.css";
import "@fontsource/sora/800.css";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";

window.__GSWING_DEPLOYMENT__ = {
  commitSha: __GSWING_BUILD_SHA__,
  buildTime: __GSWING_BUILD_TIME__,
};

console.info("[gswing.deploy] frontend bundle", window.__GSWING_DEPLOYMENT__);

createRoot(document.getElementById("root")!).render(<App />);
