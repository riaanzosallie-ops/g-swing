import html2canvas from "html2canvas";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Browser } from "@capacitor/browser";
import { Preferences } from "@capacitor/preferences";

export const isNative = () => Capacitor.isNativePlatform();

/** Render a DOM node to a high-quality JPEG data URL. */
export async function renderNodeToJpeg(node: HTMLElement, quality = 0.95): Promise<string> {
  const canvas = await html2canvas(node, {
    backgroundColor: "#0b0d0a",
    scale: Math.min(window.devicePixelRatio || 2, 3),
    useCORS: true,
    logging: false,
  });
  return canvas.toDataURL("image/jpeg", quality);
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(",");
  const mime = /data:(.*?);base64/.exec(meta)?.[1] || "image/jpeg";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

/** Save the rendered image to the device. Native -> Filesystem (Documents). Web -> download. */
export async function saveImageToDevice(dataUrl: string, fileName: string): Promise<{ ok: boolean; where: string }> {
  if (isNative()) {
    const base64 = dataUrl.split(",")[1];
    await Filesystem.writeFile({
      path: `GSwing/${fileName}`,
      data: base64,
      directory: Directory.Documents,
      recursive: true,
    });
    return { ok: true, where: "Files › G Swing" };
  }
  const blob = dataUrlToBlob(dataUrl);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { ok: true, where: "Downloads" };
}

/** Share an image. Native -> Capacitor Share with file URI. Web -> Web Share API with File, or fallback. */
export async function shareImage(dataUrl: string, fileName: string, text: string, title = "G Swing — Fairway Memory") {
  if (isNative()) {
    const base64 = dataUrl.split(",")[1];
    const written = await Filesystem.writeFile({
      path: fileName,
      data: base64,
      directory: Directory.Cache,
    });
    await Share.share({
      title,
      text,
      url: written.uri,
      dialogTitle: "Share your Fairway Memory",
    });
    return { ok: true, channel: "native-sheet" as const };
  }

  const blob = dataUrlToBlob(dataUrl);
  const file = new File([blob], fileName, { type: "image/jpeg" });

  // Modern mobile browsers (iOS Safari 15+, Chrome Android) support file sharing
  const navAny = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (navAny.canShare && navAny.canShare({ files: [file] })) {
    await navigator.share({ title, text, files: [file] });
    return { ok: true, channel: "web-share-files" as const };
  }
  if (navigator.share) {
    await navigator.share({ title, text });
    return { ok: true, channel: "web-share-text" as const };
  }
  // Last resort: download + copy text
  await saveImageToDevice(dataUrl, fileName);
  await navigator.clipboard.writeText(text);
  return { ok: true, channel: "fallback-download" as const };
}

/** Open WhatsApp directly with caption (image share goes through native sheet). */
export async function shareToWhatsApp(text: string) {
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  if (isNative()) {
    await Browser.open({ url });
  } else {
    window.open(url, "_blank", "noopener");
  }
}

/** Open X / Twitter intent. */
export async function shareToX(text: string, link?: string) {
  const params = new URLSearchParams({ text });
  if (link) params.set("url", link);
  const url = `https://twitter.com/intent/tweet?${params.toString()}`;
  if (isNative()) await Browser.open({ url });
  else window.open(url, "_blank", "noopener");
}

/** Open Facebook share dialog. Requires a public link to share. */
export async function shareToFacebook(link: string, quote?: string) {
  const params = new URLSearchParams({ u: link });
  if (quote) params.set("quote", quote);
  const url = `https://www.facebook.com/sharer/sharer.php?${params.toString()}`;
  if (isNative()) await Browser.open({ url });
  else window.open(url, "_blank", "noopener");
}

/** Connected-accounts storage (Preferences on native, localStorage on web — Preferences handles both). */
const ACCOUNT_KEYS = ["instagram", "facebook", "x"] as const;
export type SocialProvider = (typeof ACCOUNT_KEYS)[number];

export async function getConnected(provider: SocialProvider): Promise<{ handle?: string } | null> {
  const { value } = await Preferences.get({ key: `gswing.social.${provider}` });
  return value ? JSON.parse(value) : null;
}
export async function setConnected(provider: SocialProvider, data: { handle: string; token?: string }) {
  await Preferences.set({ key: `gswing.social.${provider}`, value: JSON.stringify(data) });
}
export async function disconnect(provider: SocialProvider) {
  await Preferences.remove({ key: `gswing.social.${provider}` });
}

export const ALL_PROVIDERS = ACCOUNT_KEYS;