// Draait als service worker; enige plek die daadwerkelijk met Jira praat.
// Voorkomt CORS-problemen en houdt het API-token uit het content script.

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minuten cache per ticket
const KEY_REGEX = /^[A-Z][A-Z0-9]{1,9}-\d+$/;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "FETCH_JIRA_ISSUE") {
    fetchIssueWithCache(message.key).then(sendResponse);
    return true; // async response
  }

  if (message.type === "CLEAR_JIRA_CACHE") {
    clearJiraCache().then(sendResponse);
    return true;
  }
});

async function fetchIssueWithCache(key) {
  if (!KEY_REGEX.test(key || "")) {
    return { ok: false, key, error: "Ongeldige key" };
  }

  const cacheKey = "jira_cache_" + key;
  const cached = await chrome.storage.local.get(cacheKey);
  const entry = cached[cacheKey];

  if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
    return entry.data;
  }

  const data = await fetchIssueFromJira(key);
  await chrome.storage.local.set({ [cacheKey]: { data, timestamp: Date.now() } });
  return data;
}

async function clearJiraCache() {
  const all = await chrome.storage.local.get(null);
  const cacheKeys = Object.keys(all).filter((k) => k.startsWith("jira_cache_"));
  if (cacheKeys.length) {
    await chrome.storage.local.remove(cacheKeys);
  }
  return { ok: true, removed: cacheKeys.length };
}

function normalizeJiraUrl(rawUrl) {
  const trimmed = (rawUrl || "").trim();
  if (!trimmed) return "";

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withProtocol.replace(/\/+$/, "");
}

function toBase64(input) {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary);
}

async function fetchIssueFromJira(key) {
  const settings = await chrome.storage.local.get(["jiraUrl", "jiraEmail", "jiraToken"]);

  if (!settings.jiraUrl || !settings.jiraEmail || !settings.jiraToken) {
    return { ok: false, key, error: "Niet geconfigureerd" };
  }

  const cleanUrl = normalizeJiraUrl(settings.jiraUrl);
  if (!cleanUrl) {
    return { ok: false, key, error: "Ongeldige Jira-URL" };
  }

  const endpoint = `${cleanUrl}/rest/api/3/issue/${encodeURIComponent(key)}?fields=summary,status`;
  const auth = toBase64(`${settings.jiraEmail}:${settings.jiraToken}`);

  try {
    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json"
      }
    });

    if (response.status === 200) {
      const data = await response.json();
      return {
        ok: true,
        key: data.key,
        summary: data.fields.summary,
        status: data.fields.status.name,
        url: `${cleanUrl}/browse/${data.key}`
      };
    }
    if (response.status === 404) {
      return { ok: false, key, error: "Niet gevonden" };
    }
    if (response.status === 401 || response.status === 403) {
      return { ok: false, key, error: "Auth mislukt" };
    }
    return { ok: false, key, error: `HTTP ${response.status}` };
  } catch (err) {
    return { ok: false, key, error: "Netwerkfout" };
  }
}