// Scant zichtbare Gmail-rijen op Jira-keys en injecteert badges vóór de afzendernaam.

const JIRA_KEY_REGEX = /\b[A-Z][A-Z0-9]{1,9}-\d+\b/g;
const ROW_STATE = new WeakMap();

// Statuskleuren — pas aan naar wens
const STATUS_COLORS = {
  "to do": "#DFE1E6",
  "in progress": "#0052CC",
  done: "#00875A",
  default: "#6B778C"
};

function colorForStatus(status) {
  const key = (status || "").toLowerCase();
  return STATUS_COLORS[key] || STATUS_COLORS.default;
}

function textColorForStatus(status) {
  const key = (status || "").toLowerCase();
  return key === "to do" ? "#172B4D" : "#FFFFFF";
}

function extractKeys(text) {
  const matches = text.match(JIRA_KEY_REGEX) || [];
  return Array.from(new Set(matches)).slice(0, 3); // max 3 badges per rij, voorkomt overvolle UI
}

function fetchIssue(key) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "FETCH_JIRA_ISSUE", key }, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, key, error: "Extensie niet beschikbaar" });
        return;
      }

      if (!response) {
        resolve({ ok: false, key, error: "Geen response" });
        return;
      }

      resolve(response);
    });
  });
}

function buildBadge(issueData) {
  const badge = document.createElement("span");
  badge.className = "jira-badge";

  if (!issueData.ok) {
    badge.classList.add("jira-badge--error");
    badge.textContent = `${issueData.key} ⚠`;
    badge.title = issueData.error;
    return badge;
  }

  badge.style.backgroundColor = colorForStatus(issueData.status);
  badge.style.color = textColorForStatus(issueData.status);
  badge.textContent = `${issueData.key} · ${issueData.status}`;
  badge.title = issueData.summary;

  badge.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(issueData.url, "_blank", "noopener");
  });

  return badge;
}

async function processRow(row) {
  // .y6 span bevat meestal de subject+snippet tekst; .bog het onderwerp zelf.
  const textNode = row.querySelector(".y6") || row;
  const rowText = textNode.innerText || "";
  const stateFingerprint = rowText.slice(0, 500);

  if (ROW_STATE.get(row) === stateFingerprint) {
    return;
  }
  ROW_STATE.set(row, stateFingerprint);

  const keys = extractKeys(rowText);

  // Target specifiek de ZICHTBARE naam-div (.yW), niet de verborgen accessibility-div (.afn)
  // die Gmail ook met dezelfde span[email]-structuur vult.
  const visibleNameSpan = row.querySelector(".yW span[email], .yW span.yP");
  if (!visibleNameSpan) return;

  // .bA4 is de directe wrapper om de naam-span. We plaatsen de badge ná die wrapper,
  // dus na de naam maar vóór het ongelezen-aantal (span.bx0).
  const nameWrapper = visibleNameSpan.closest(".bA4") || visibleNameSpan;

  const existingContainer = row.querySelector(".jira-badge-container");
  if (existingContainer) {
    existingContainer.remove();
  }

  if (keys.length === 0) return;

  const container = document.createElement("span");
  container.className = "jira-badge-container";
  nameWrapper.insertAdjacentElement("afterend", container);

  for (const key of keys) {
    try {
      const issueData = await fetchIssue(key);
      container.appendChild(buildBadge(issueData));
    } catch (err) {
      // Extension context kan invalide raken bij reload; negeer stil
    }
  }
}

const HEADER_PROCESSED_ATTR = "data-jira-badge-header-processed";

async function processOpenedEmailHeader() {
  const subjectHeader = document.querySelector("h2.hP");
  if (!subjectHeader) return;
  if (subjectHeader.getAttribute(HEADER_PROCESSED_ATTR)) return;
  subjectHeader.setAttribute(HEADER_PROCESSED_ATTR, "true");

  const subjectText = subjectHeader.innerText || "";
  const keys = extractKeys(subjectText);
  if (keys.length === 0) return;

  const container = document.createElement("span");
  container.className = "jira-badge-container jira-badge-container--header";
  subjectHeader.insertAdjacentElement("afterend", container);

  for (const key of keys) {
    try {
      const issueData = await fetchIssue(key);
      container.appendChild(buildBadge(issueData));
    } catch (err) {
      // Extension context kan invalide raken bij reload; negeer stil
    }
  }
}

function scanVisibleRows() {
  document.querySelectorAll("tr.zA").forEach(processRow);
}

const observer = new MutationObserver(() => {
  clearTimeout(window.__jiraScanDebounce);
  window.__jiraScanDebounce = setTimeout(() => {
    scanVisibleRows();
    processOpenedEmailHeader();
  }, 300);
});

observer.observe(document.body, { childList: true, subtree: true });

// Eerste scan bij laden
scanVisibleRows();
processOpenedEmailHeader().then(r => {}).catch(e => {});