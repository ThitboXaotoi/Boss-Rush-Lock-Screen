// The one plan shared by planner, preview and exporters.
// SHARED FILE: integrator-only (see briefs/README.md). Briefs use the exports, not the internals.
//
// Load order: `#plan=<base64url JSON>` in the URL, then localStorage, then the sample plan.
import { fixturePlan, PLAN_VERSION } from '@boss-rush/core';
import type { Plan } from '@boss-rush/core';
import { useEffect, useState } from 'preact/hooks';

const STORAGE_KEY = 'boss-rush.plan.v1';
const HASH_KEY = 'plan';

/** Plan -> URL-safe text. */
export function encodePlan(plan: Plan): string {
  const bytes = new TextEncoder().encode(JSON.stringify(plan));
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Text -> Plan, or null when it is not a version-1 plan. */
export function decodePlan(text: string): Plan | null {
  try {
    const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return asPlan(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return null;
  }
}

/** Shape check only. TODO(integrator): use validatePlan() once brief A lands. */
function asPlan(value: unknown): Plan | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Partial<Plan>;
  if (v.version !== PLAN_VERSION || !Array.isArray(v.bosses) || !v.settings) return null;
  return value as Plan;
}

function fromHash(): Plan | null {
  const text = new URLSearchParams(location.hash.slice(1)).get(HASH_KEY);
  return text ? decodePlan(text) : null;
}

function fromStorage(): Plan | null {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    return text ? asPlan(JSON.parse(text)) : null;
  } catch {
    return null;
  }
}

let current: Plan = fromHash() ?? fromStorage() ?? fixturePlan;
const listeners = new Set<() => void>();

export function getPlan(): Plan {
  return current;
}

export function setPlan(plan: Plan): void {
  current = plan;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
  } catch {
    // Storage full or blocked: the plan still lives in memory and in the share link.
  }
  for (const listener of listeners) listener();
}

/** A link that opens the app with this plan loaded. */
export function shareUrl(plan: Plan = current): string {
  return `${location.origin}${location.pathname}#${HASH_KEY}=${encodePlan(plan)}`;
}

export function usePlan(): [Plan, (plan: Plan) => void] {
  const [plan, setLocal] = useState(current);
  useEffect(() => {
    const listener = () => setLocal(current);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return [plan, setPlan];
}
