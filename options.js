function normalizeJiraUrl(rawUrl) {
  const trimmed = (rawUrl || "").trim();
  if (!trimmed) return "";

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withProtocol.replace(/\/+$/, "");
}

function setStatus(message, isError = false) {
  const status = document.getElementById("status");
  status.textContent = message;
  status.style.color = isError ? "#DE350B" : "#00875A";
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
        resolve({ ok: false, error: "Extensie niet beschikbaar" });
        return;
      }
      resolve(response);
    });
  });
}

async function refreshConnectionStatus() {
  setConnectionStatus("checking", "Controleren...");
  const result = await requestConnectionStatus();

  if (result.ok) {
    setConnectionStatus("connected", "Succesvol gekoppeld", `${result.displayName} @ ${result.jiraUrl}`);
    return;
  }

  if (result.error === "Niet geconfigureerd") {
    setConnectionStatus("idle", "Nog niet gekoppeld", "Vul URL, e-mail en API-token in.");
    return;
  }

  setConnectionStatus("error", "Koppeling mislukt", result.error || "Onbekende fout");
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
  const settings = await chrome.storage.local.get(["jiraUrl", "jiraEmail"]);
  document.getElementById("jiraUrl").value = settings.jiraUrl || "";
  document.getElementById("jiraEmail").value = settings.jiraEmail || "";
  await refreshConnectionStatus();
});

document.getElementById("settings-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  const jiraUrl = normalizeJiraUrl(document.getElementById("jiraUrl").value);
  const jiraEmail = document.getElementById("jiraEmail").value.trim();
  const jiraToken = document.getElementById("jiraToken").value.trim();

  if (!jiraUrl || !/^https?:\/\//i.test(jiraUrl)) {
    setStatus("Voer een geldige Jira-URL in", true);
    return;
  }

  if (!jiraEmail || !jiraEmail.includes("@")) {
    setStatus("Voer een geldig e-mailadres in", true);
    return;
  }

  const toSave = { jiraUrl, jiraEmail };
  if (jiraToken) {
    toSave.jiraToken = jiraToken;
  }

  await chrome.storage.local.set(toSave);
  const cacheResult = await clearCache();

  if (cacheResult.ok) {
    setStatus(`Opgeslagen. Cache opgeschoond (${cacheResult.removed}).`);
  } else {
    setStatus("Opgeslagen. Kon cache niet leegmaken.", true);
  }

  document.getElementById("jiraToken").value = "";
  await refreshConnectionStatus();
});