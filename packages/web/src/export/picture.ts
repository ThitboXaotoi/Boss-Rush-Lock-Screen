// Shared bits for the export sections: profile lookup with a safe fallback,
// scene -> PNG bytes, and Blob download links.
import { profiles } from '@boss-rush/core';
import type { Plan, Profile, SceneState } from '@boss-rush/core';
import { encodePng, render } from '@boss-rush/render';
import type { Atlas, Frame } from '@boss-rush/render';

/** The plan's layout profile, falling back to compact when it is not built yet. */
export function resolveProfile(plan: Plan): { profile: Profile; fellBack: boolean } {
  const profile = (profiles as Record<string, Profile | undefined>)[plan.settings.profile];
  if (profile) return { profile, fellBack: false };
  return { profile: profiles.compact as Profile, fellBack: true };
}

/** Render one scene at a device size and encode it as PNG bytes. */
export function renderScenePng(
  scene: SceneState,
  profile: Profile,
  atlas: Atlas,
  device: { width: number; height: number },
): { png: Uint8Array; frame: Frame } {
  const frame = render(scene, profile, atlas, { device });
  return { png: encodePng(frame), frame };
}

/** PNG bytes -> an object URL for <img>/<a>. The caller revokes it. */
export function pngUrl(png: Uint8Array): string {
  return URL.createObjectURL(new Blob([png as BlobPart], { type: 'image/png' }));
}

/** Raw bytes -> an object URL with the given MIME type. The caller revokes it. */
export function bytesUrl(bytes: Uint8Array, mime: string): string {
  return URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
}

/** Text -> an object URL with the given MIME type. The caller revokes it. */
export function textUrl(text: string, mime: string): string {
  return URL.createObjectURL(new Blob([text], { type: mime }));
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
