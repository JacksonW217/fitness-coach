/** Small helpers for the Forge ⇄ Claude app round trip. */

const PENDING_KEY = 'forge.coach.pending';
const PROJECT_KEY = 'forge.coach.projectUrl';
const PENDING_TTL_MS = 3 * 60 * 60 * 1000;

export function claudeUrl(): string {
  try {
    const u = localStorage.getItem(PROJECT_KEY);
    if (u && /^https:\/\/claude\.ai\//.test(u)) return u;
  } catch {
    /* ignore */
  }
  return 'https://claude.ai/new';
}

export function getProjectUrl() {
  try {
    return localStorage.getItem(PROJECT_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setProjectUrl(url: string) {
  try {
    if (url) localStorage.setItem(PROJECT_KEY, url.trim());
    else localStorage.removeItem(PROJECT_KEY);
  } catch {
    /* ignore */
  }
}

export function setPending(id: string) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify({ id, at: Date.now() }));
  } catch {
    /* ignore */
  }
}

export function getPending(): string | null {
  try {
    const j = JSON.parse(localStorage.getItem(PENDING_KEY) ?? 'null');
    if (j && Date.now() - j.at < PENDING_TTL_MS) return j.id;
  } catch {
    /* ignore */
  }
  return null;
}

export function clearPending() {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Copy text without awaiting, so it can run in the same tap as opening Claude
 * (iOS only allows opening another app synchronously inside a tap).
 */
export function copyNow(text: string): void {
  // Start the async clipboard write inside the tap (iOS allows it), without
  // awaiting, so opening Claude can also happen in the same tap.
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => legacyCopy(text));
  } else legacyCopy(text);
}

function legacyCopy(text: string) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.contentEditable = 'true';
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    document.execCommand('copy');
    ta.remove();
  } catch {
    /* ignore */
  }
}

export const looksLikeOurPrompt = (t: string) => t.trimStart().startsWith('# My Forge data');
