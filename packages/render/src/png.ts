// PNG at the edges. One encoder for Node and the browser, so the same frame gives the same
// bytes everywhere. fast-png is pinned to an exact version for that reason: do not bump it
// without regenerating the golden PNGs.
// SHARED CONTRACT: integrator-only.
import { decode, encode } from 'fast-png';
import type { Frame } from './render';

export function encodePng(frame: Frame): Uint8Array {
  return encode({
    width: frame.width,
    height: frame.height,
    data: frame.rgba,
    depth: 8,
    channels: 4,
  });
}

/** Decodes any 8-bit PNG to RGBA. Throws on 16-bit or palette-indexed input. */
export function decodePng(bytes: Uint8Array): Frame {
  const png = decode(bytes);
  if (png.depth !== 8 || png.palette) {
    throw new Error('decodePng: only 8-bit, non-indexed PNGs are supported');
  }
  const { width, height, channels } = png;
  const src = png.data;
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0, p = 0; i < width * height; i++, p += channels) {
    const o = i * 4;
    if (channels >= 3) {
      rgba[o] = src[p]!;
      rgba[o + 1] = src[p + 1]!;
      rgba[o + 2] = src[p + 2]!;
      rgba[o + 3] = channels === 4 ? src[p + 3]! : 255;
    } else {
      rgba[o] = rgba[o + 1] = rgba[o + 2] = src[p]!;
      rgba[o + 3] = channels === 2 ? src[p + 1]! : 255;
    }
  }
  return { width, height, rgba };
}
