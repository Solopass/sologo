/**
 * Property & section lock state and enforcement helpers.
 */
import { LOCK_GROUP_KEYS } from './state.js';

function safeReadStorage(key, fallback) {
    try {
        if (typeof localStorage === 'undefined') return fallback;
        const raw = JSON.parse(localStorage.getItem(key) || 'null');
        return raw && typeof raw === 'object' ? raw : fallback;
    } catch {
        return fallback;
    }
}

export function safeWriteStorage(key, value) {
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(key, JSON.stringify(value));
        }
    } catch {
        // Ignore storage quota / private mode errors
    }
}

const savedGroups = safeReadStorage('solopass_locks', {});
export const lockedGroups = {
    colors: !!savedGroups.colors,
    ring: !!savedGroups.ring,
    wings: !!savedGroups.wings,
    glow: !!savedGroups.glow,
    text: !!savedGroups.text
};

export const lockedSliders = safeReadStorage('solopass_locked_sliders', {});

export function findLockGroupForKey(key) {
    for (const [grp, keys] of Object.entries(LOCK_GROUP_KEYS)) {
        if (keys.includes(key)) return grp;
    }
    return null;
}

export function isKeyLockedByGroup(key) {
    const grp = findLockGroupForKey(key);
    return grp ? !!lockedGroups[grp] : false;
}

export function isKeyLocked(key) {
    return !!lockedSliders[key] || isKeyLockedByGroup(key);
}

export function applyLocksToState(targetState, anchorState) {
    const out = { ...targetState };
    for (const [group, isLocked] of Object.entries(lockedGroups)) {
        if (!isLocked || !LOCK_GROUP_KEYS[group]) continue;
        for (const key of LOCK_GROUP_KEYS[group]) {
            if (anchorState[key] !== undefined) out[key] = anchorState[key];
        }
    }
    for (const [key, isLocked] of Object.entries(lockedSliders)) {
        if (isLocked && anchorState[key] !== undefined) {
            out[key] = anchorState[key];
        }
    }
    return out;
}

export function getLockedSummaryLabel() {
    const active = Object.entries(lockedGroups).filter(([, v]) => v).map(([k]) => k);
    const sliderCount = Object.values(lockedSliders).filter(Boolean).length;
    if (sliderCount > 0) active.push(`${sliderCount} slider${sliderCount > 1 ? 's' : ''}`);
    return active.length ? ` (kept: ${active.join(', ')})` : '';
}
