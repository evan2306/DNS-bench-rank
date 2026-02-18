const CUSTOM_PROVIDERS_KEY = "dns-benchmark:custom-providers";
const SELECTED_PROVIDERS_KEY = "dns-benchmark:selected-provider-ids";
const SETTINGS_KEY = "dns-benchmark:settings";

export function loadCustomProviders() {
  return safeRead(CUSTOM_PROVIDERS_KEY, []);
}

export function saveCustomProviders(value) {
  safeWrite(CUSTOM_PROVIDERS_KEY, value);
}

export function loadSelectedProviderIds() {
  return safeRead(SELECTED_PROVIDERS_KEY, []);
}

export function saveSelectedProviderIds(value) {
  safeWrite(SELECTED_PROVIDERS_KEY, value);
}

export function loadSettings() {
  return safeRead(SETTINGS_KEY, null);
}

export function saveSettings(value) {
  safeWrite(SETTINGS_KEY, value);
}

function safeRead(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function safeWrite(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    return;
  }
}
