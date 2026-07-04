/// <reference types="vite/client" />

declare const __GSWING_BUILD_SHA__: string;
declare const __GSWING_BUILD_TIME__: string;

interface Window {
  __GSWING_DEPLOYMENT__?: {
    commitSha: string;
    buildTime: string;
  };
}
