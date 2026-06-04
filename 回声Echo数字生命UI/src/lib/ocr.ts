// REQ-020: on-device image OCR for chat-log import (Google ML Kit Text
// Recognition via @pantrist plugin, patched to the bundled Chinese model so it
// reads mixed CN/EN WeChat/QQ screenshots without Google Play Services).
//
// Native-only: ML Kit runs on Android/iOS. On Web/Electron there is no native
// recognizer, so callers must gate on ocrAvailable(). The image and the
// recognized text never leave the device.

import { Capacitor } from "@capacitor/core";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { CapacitorPluginMlKitTextRecognition } from "@pantrist/capacitor-plugin-ml-kit-text-recognition";

/** OCR is only available where ML Kit native runs (Android / iOS). */
export function ocrAvailable(): boolean {
  return Capacitor.isNativePlatform();
}

/** Thrown (string code) when the user cancels the album picker. */
export const OCR_CANCELLED = "OCR_CANCELLED";

/**
 * Pick one screenshot from the album and OCR it. Returns the recognized text
 * (may be empty if the image has no text). Throws OCR_CANCELLED if the user
 * dismisses the picker, or a generic Error on recognizer failure.
 */
export async function recognizeImageFromAlbum(): Promise<string> {
  if (!ocrAvailable()) throw new Error("OCR_NATIVE_ONLY");

  let base64: string | undefined;
  try {
    const photo = await Camera.getPhoto({
      source: CameraSource.Photos,
      resultType: CameraResultType.Base64,
      quality: 92,
      correctOrientation: true,
    });
    base64 = photo.base64String;
  } catch (e: unknown) {
    // Camera rejects with a "cancelled" message when the user backs out.
    const msg = String((e as { message?: string })?.message ?? e ?? "").toLowerCase();
    if (msg.includes("cancel")) throw new Error(OCR_CANCELLED);
    throw e;
  }

  if (!base64) return "";
  const res = await CapacitorPluginMlKitTextRecognition.detectText({ base64Image: base64 });
  return (res?.text ?? "").trim();
}
