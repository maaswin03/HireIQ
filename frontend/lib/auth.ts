/**
 * Lightweight auth helpers — role + candidate identity, stored in localStorage.
 *
 * Keys
 * ────
 *  hireiq-role          "hr" | "candidate"
 *  hireiq-candidate-id  UUID generated once when the user picks the Candidate role
 */

export const ROLE_KEY = "hireiq-role";
export const CANDIDATE_ID_KEY = "hireiq-candidate-id";
export const HR_ID_KEY = "hireiq-hr-id";

type Role = "hr" | "candidate";

/** Read the stored role (null if not set) */
export function getRole(): Role | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(ROLE_KEY);
  return v === "hr" || v === "candidate" ? v : null;
}

/** Read the stored candidate ID (null if not a candidate session) */
export function getCandidateId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CANDIDATE_ID_KEY);
}

/** Read the stored HR ID (null if not an HR session) */
export function getHRId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(HR_ID_KEY);
}

/**
 * Set the active role.
 * - For "candidate": generates a UUID and stores it under CANDIDATE_ID_KEY
 *   (no-op if one already exists, so repeated calls are stable)
 * - For "hr": clears any leftover candidate ID
 */
export function setRole(role: Role): void {
  localStorage.setItem(ROLE_KEY, role);
  if (role === "candidate") {
    if (!localStorage.getItem(CANDIDATE_ID_KEY)) {
      localStorage.setItem(CANDIDATE_ID_KEY, generateUUID());
    }
    localStorage.removeItem(HR_ID_KEY);
  } else {
    if (!localStorage.getItem(HR_ID_KEY)) {
      localStorage.setItem(HR_ID_KEY, generateUUID());
    }
    localStorage.removeItem(CANDIDATE_ID_KEY);
  }
}

/** Remove all auth state (role + candidate ID + HR ID + any saved form) */
export function clearAuth(): void {
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(CANDIDATE_ID_KEY);
  localStorage.removeItem(HR_ID_KEY);
}

function generateUUID(): string {
  // Use the Web Crypto API where available, otherwise fall back
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback (older browsers)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}
