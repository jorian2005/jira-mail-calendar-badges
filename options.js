const ERROR_CODES = {
  EXTENSION_UNAVAILABLE: "ERR_EXTENSION_UNAVAILABLE",
  NOT_CONFIGURED: "ERR_NOT_CONFIGURED"
};

const SETTINGS_KEYS = [
  "jiraUrl",
  "jiraEmail",
  "enableGmailBadges",
  "enableCalendarBadges",
  "maxBadgesPerItem",
  "projectWhitelist",
  "showExtraIssueInfo"
];

const DEFAULT_SETTINGS = {
  enableGmailBadges: true,
  enableCalendarBadges: true,
  maxBadgesPerItem: 3,
  projectWhitelist: "",
  showExtraIssueInfo: true
};

function t(key, substitutions, fallback = "") {
  return chrome.i18n.getMessage(key, substitutions) || fallback || key;
}

function applyI18n() {
  const uiLanguage = chrome.i18n.getUILanguage?.();
  if (uiLanguage) {
    document.documentElement.lang = uiLanguage;
  }

  document.title = t("optionsPageTitle", null, document.title);

  document.querySelectorAll("[data-i18n]").forEach((node) => {
    const key = node.getAttribute("data-i18n");
    node.textContent = t(key, null, node.textContent);
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    const key = node.getAttribute("data-i18n-placeholder");
    node.setAttribute("placeholder", t(key, null, node.getAttribute("placeholder") || ""));
  });
}

function normalizeJiraUrl(rawUrl) {
  const trimmed = (rawUrl || "").trim();
  if (!trimmed) return "";

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== "https:") {
      return "";
    }
    return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, "");
  } catch (_err) {
    return "";
  }
}

function isValidJiraCloudUrl(jiraUrl) {
  try {
    const parsed = new URL(jiraUrl);
    return parsed.protocol === "https:" && parsed.hostname.endsWith(".atlassian.net") && parsed.pathname === "/";
  } catch (_err) {
    return false;
  }
}

function parseProjectWhitelist(rawValue) {
  return (rawValue || "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
}

function setStatus(message, isError = false) {
  const status = document.getElementById("status");
  status.textContent = message;
  status.classList.toggle("status-error", isError);
  status.classList.toggle("status-ok", !isError);
  if (!isError) {
    setTimeout(() => {
      if (status.textContent === message) {
        status.textContent = "";
      }
    }, 2500);
  }
}

function setConnectionStatus(state, message, hint = "") {
  const statusBox = document.getElementById("connection-status");
  const value = document.getElementById("connection-status-value");
  const hintNode = document.getElementById("connection-status-hint");

  statusBox.setAttribute("data-state", state);
  value.textContent = message;
  hintNode.textContent = hint;
}

async function requestConnectionStatus() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "TEST_JIRA_CONNECTION" }, (response) => {
      if (chrome.runtime.lastError || !response) {
        resolve({ ok: false, errorCode: ERROR_CODES.EXTENSION_UNAVAILABLE, error: t("errorExtensionUnavailable") });
        return;
      }
      resolve(response);
    });
  });
}

async function refreshConnectionStatus() {
  setConnectionStatus("checking", t("connChecking"));
  const result = await requestConnectionStatus();

  if (result.ok) {
    setConnectionStatus(
      "connected",
      t("connConnected"),
      t("connConnectedHint", [result.displayName || "", result.jiraUrl || ""], `${result.displayName || ""} @ ${result.jiraUrl || ""}`)
    );
    return;
  }

  if (result.errorCode === ERROR_CODES.NOT_CONFIGURED) {
    setConnectionStatus("idle", t("connNotConnected"), t("connNotConfiguredHint"));
    return;
  }

  setConnectionStatus("error", t("connFailed"), result.error || t("errorUnknown"));
}

function setButtonsBusy(isBusy) {
  document.getElementById("save").disabled = isBusy;
  document.getElementById("test-connection").disabled = isBusy;
}

function wireTokenVisibilityToggle() {
  const toggle = document.getElementById("toggleTokenVisibility");
  const tokenInput = document.getElementById("jiraToken");
  toggle.addEventListener("change", () => {
    tokenInput.type = toggle.checked ? "text" : "password";
  });
}

function getFormValues() {
  const jiraUrl = normalizeJiraUrl(document.getElementById("jiraUrl").value);
  const jiraEmail = document.getElementById("jiraEmail").value.trim();
  const jiraToken = document.getElementById("jiraToken").value.trim();
  const enableGmailBadges = document.getElementById("enableGmailBadges").checked;
  const enableCalendarBadges = document.getElementById("enableCalendarBadges").checked;
  const maxBadgesPerItem = Number.parseInt(document.getElementById("maxBadgesPerItem").value, 10);
  const projectWhitelist = document.getElementById("projectWhitelist").value.trim().toUpperCase();
  const showExtraIssueInfo = document.getElementById("showExtraIssueInfo").checked;

  return {
    jiraUrl,
    jiraEmail,
    jiraToken,
    enableGmailBadges,
    enableCalendarBadges,
    maxBadgesPerItem,
    projectWhitelist,
    showExtraIssueInfo
  };
}

function validateFormValues({ jiraUrl, jiraEmail, maxBadgesPerItem, projectWhitelist }) {
  if (!jiraUrl || !isValidJiraCloudUrl(jiraUrl)) {
    return t("validationInvalidJiraCloudUrl");
  }

  if (!jiraEmail || !jiraEmail.includes("@")) {
    return t("validationInvalidEmail");
  }

  if (!Number.isInteger(maxBadgesPerItem) || maxBadgesPerItem < 1 || maxBadgesPerItem > 5) {
    return t("validationInvalidMaxBadges");
  }

  const whitelist = parseProjectWhitelist(projectWhitelist);
  const hasInvalidProject = whitelist.some((project) => !/^[A-Z]{2,10}$/.test(project));
  if (hasInvalidProject) {
    return t("validationInvalidProjectWhitelist");
  }

  return "";
}

async function clearCache() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "CLEAR_JIRA_CACHE" }, (response) => {
      if (chrome.runtime.lastError || !response || !response.ok) {
        resolve({ ok: false, removed: 0 });
        return;
      }
      resolve(response);
    });
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  applyI18n();
  const settings = await chrome.storage.local.get(SETTINGS_KEYS);
  document.getElementById("jiraUrl").value = settings.jiraUrl || "";
  document.getElementById("jiraEmail").value = settings.jiraEmail || "";
  document.getElementById("enableGmailBadges").checked = settings.enableGmailBadges ?? DEFAULT_SETTINGS.enableGmailBadges;
  document.getElementById("enableCalendarBadges").checked = settings.enableCalendarBadges ?? DEFAULT_SETTINGS.enableCalendarBadges;
  document.getElementById("maxBadgesPerItem").value = String(settings.maxBadgesPerItem ?? DEFAULT_SETTINGS.maxBadgesPerItem);
  document.getElementById("projectWhitelist").value = settings.projectWhitelist ?? DEFAULT_SETTINGS.projectWhitelist;
  document.getElementById("showExtraIssueInfo").checked = settings.showExtraIssueInfo ?? DEFAULT_SETTINGS.showExtraIssueInfo;
  wireTokenVisibilityToggle();
  await refreshConnectionStatus();
});

document.getElementById("test-connection").addEventListener("click", async () => {
  setButtonsBusy(true);
  setStatus("");
  try {
    await refreshConnectionStatus();
  } finally {
    setButtonsBusy(false);
  }
});

document.getElementById("settings-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  const formValues = getFormValues();
  const validationError = validateFormValues(formValues);
  if (validationError) {
    setStatus(validationError, true);
    return;
  }

  setButtonsBusy(true);

  const toSave = {
    jiraUrl: formValues.jiraUrl,
    jiraEmail: formValues.jiraEmail,
    enableGmailBadges: formValues.enableGmailBadges,
    enableCalendarBadges: formValues.enableCalendarBadges,
    maxBadgesPerItem: formValues.maxBadgesPerItem,
    projectWhitelist: formValues.projectWhitelist,
    showExtraIssueInfo: formValues.showExtraIssueInfo
  };
  if (formValues.jiraToken) {
    toSave.jiraToken = formValues.jiraToken;
  }

  try {
    await chrome.storage.local.set(toSave);
    const cacheResult = await clearCache();

    if (cacheResult.ok) {
      setStatus(t("statusSavedCacheCleared", [String(cacheResult.removed)]));
    } else {
      setStatus(t("statusSavedCacheClearFailed"), true);
    }

    document.getElementById("jiraToken").value = "";
    document.getElementById("toggleTokenVisibility").checked = false;
    document.getElementById("jiraToken").type = "password";
    await refreshConnectionStatus();
  } finally {
    setButtonsBusy(false);
  }
});