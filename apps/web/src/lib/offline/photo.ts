const MAX_SIDE_PX = 1280;
const JPEG_QUALITY = 0.72;
const DATA_URL_PREFIX = /^data:[^;]+;base64,/;

/** Reduce la foto a ~300 KB para que quepa en el equipo y se envíe rápido con poca señal. */
export async function compressPhoto(file: Blob): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(
      1,
      MAX_SIDE_PX / Math.max(bitmap.width, bitmap.height)
    );
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY);
    });
    return blob ?? file;
  } catch {
    return file;
  }
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(reader.error ?? new Error("No se pudo leer la foto"));
    reader.onload = () =>
      resolve(String(reader.result).replace(DATA_URL_PREFIX, ""));
    reader.readAsDataURL(blob);
  });
}
