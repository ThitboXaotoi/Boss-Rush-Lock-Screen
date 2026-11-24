// Browser-side helpers for the art bench: decode a dropped file, paint it, download a result.
import type { Rgb } from '@boss-rush/core';
import { decodePng, encodePng } from '@boss-rush/render';
import type { RgbaImage } from '@boss-rush/tools/atlas';

export async function readPngFile(file: File): Promise<RgbaImage> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    return decodePng(bytes);
  } catch (error) {
    throw new Error(
      `${file.name}: ${error instanceof Error ? error.message : 'this file is not a PNG the tool can read'}. ` +
        'Export it as a normal 8-bit PNG, not palette-indexed or 16-bit.',
    );
  }
}

export function paint(canvas: HTMLCanvasElement, image: RgbaImage): void {
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d');
  if (!context) return;
  const data = new Uint8ClampedArray(image.rgba.length);
  data.set(image.rgba);
  context.putImageData(new ImageData(data, image.width, image.height), 0, 0);
}

export function colourAt(image: RgbaImage, x: number, y: number): Rgb {
  const i = (y * image.width + x) * 4;
  return [image.rgba[i]!, image.rgba[i + 1]!, image.rgba[i + 2]!];
}

function saveFile(name: string, bytes: Uint8Array, type: string): void {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  const url = URL.createObjectURL(new Blob([copy], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadPng(name: string, image: RgbaImage): void {
  saveFile(name, encodePng(image), 'image/png');
}

export function downloadText(name: string, text: string): void {
  saveFile(name, new TextEncoder().encode(text), 'application/json');
}

/** For the optional dev-only "Save to project" hook. */
export function pngBase64(image: RgbaImage): string {
  const bytes = encodePng(image);
  let text = '';
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text);
}
