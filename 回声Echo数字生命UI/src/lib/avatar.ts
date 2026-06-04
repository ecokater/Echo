// Avatar helper: open a file picker, compress the chosen image to a small
// square base64 dataURL (keeps IndexedDB / localStorage light). Local-only.

const MAX_SIZE = 256;       // output square edge (px)
const QUALITY = 0.82;       // jpeg quality

function fileToImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

function compress(img: HTMLImageElement): string {
  // center-crop to square, then scale to MAX_SIZE
  const side = Math.min(img.width, img.height);
  const sx = (img.width - side) / 2;
  const sy = (img.height - side) / 2;
  const canvas = document.createElement("canvas");
  canvas.width = MAX_SIZE;
  canvas.height = MAX_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(img, sx, sy, side, side, 0, 0, MAX_SIZE, MAX_SIZE);
  return canvas.toDataURL("image/jpeg", QUALITY);
}

/** Open the OS file picker and return a compressed base64 dataURL, or null if cancelled. */
export function pickAvatar(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try {
        const img = await fileToImage(file);
        resolve(compress(img));
      } catch {
        resolve(null);
      }
    };
    input.click();
  });
}

/** Stable accent color derived from a name (fallback avatar background). */
export function colorFromName(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return `hsl(${h} 60% 55%)`;
}
