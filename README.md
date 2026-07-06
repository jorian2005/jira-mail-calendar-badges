# Jira Gmail Badge (Chrome Extension)

Deze extensie toont Jira-ticket badges direct in je Gmail inboxregels zodra er een issue key in onderwerp/snippet staat (bijv. `PROJ-123`).

## Wat doet het?

- Scant zichtbare Gmail-inboxrijen op Jira keys.
- Vraagt issue data op via de background service worker (niet vanuit de pagina zelf).
- Toont per gevonden key een badge met issue-status.
- Op klik opent de badge het issue in Jira.
- Gebruikt lokale cache (5 minuten) om API-calls te beperken.

## Vereisten

- Google Chrome of Chromium-gebaseerde browser met ondersteuning voor Manifest V3.
- Gmail op `https://mail.google.com/*`.
- Jira Cloud account op `*.atlassian.net`.
- Atlassian API-token.

## Installatie (developer mode)

1. Download of clone deze map lokaal.
2. Open Chrome en ga naar `chrome://extensions`.
3. Zet **Developer mode** aan (rechtsboven).
4. Klik **Load unpacked**.
5. Selecteer de map `jira-gmail-badge`.
6. De extensie verschijnt nu in je extensielijst.

## Configuratie

1. Open de extensie-instellingen:
   - `chrome://extensions` -> zoek **Jira Ticket Badges voor Gmail** -> **Details** -> **Extension options**.
2. Vul in:
   - **Jira-URL**: bijv. `https://jouwbedrijf.atlassian.net`
   - **Atlassian e-mailadres**
   - **API-token**
3. Klik **Opslaan**.
4. De cache wordt automatisch leeggemaakt zodat nieuwe instellingen direct actief zijn.

## Gebruik

1. Open Gmail inbox (of refresh Gmail-tab).
2. Zorg dat in onderwerp/snippet een Jira key staat (zoals `ABC-123`).
3. Je ziet naast de afzendernaam een badge zoals:
   - `ABC-123 - In Progress`
4. Klik op de badge om het issue in Jira te openen.

## Jira API-token aanmaken

1. Ga naar Atlassian Account Security.
2. Maak een nieuw API token aan.
3. Kopieer het token en plak dit in de extensie-opties.

> Tip: laat het tokenveld leeg bij opslaan als je het bestaande token wilt behouden.

## Bekende limieten

- De extensie leest maximaal 3 unieke Jira keys per inboxrij.
- Key-pattern: `A-Z` + cijfers mogelijk in projectdeel, vorm zoals `PROJ-123`.
- Extensie werkt op Gmail web UI; niet in mobiele apps.

## Troubleshooting

- **Geen badges zichtbaar**
  - Controleer of je op `https://mail.google.com` zit.
  - Herlaad de Gmail-tab na installeren of na configuratiewijzigingen.
  - Controleer of de mailtekst echt een Jira key bevat.

- **Badge met waarschuwing**
  - Open extension options en controleer URL/e-mail/token.
  - `Auth mislukt`: token onjuist of geen toegang tot issue.
  - `Niet gevonden`: issue key bestaat niet of project is niet zichtbaar voor dit account.
  - `Netwerkfout`: tijdelijke netwerk- of Jira-bereikbaarheidsfout.

- **Wijzigingen lijken niet direct door te komen**
  - Sla opties opnieuw op (cache wordt geleegd).
  - Herlaad Gmail.

## Ontwikkeling

Projectstructuur:

- `manifest.json` - extensieconfiguratie (MV3)
- `background.js` - service worker; Jira API-calls + cache
- `content.js` - Gmail DOM scan + badge injectie
- `content.css` - badge styling
- `options.html` / `options.js` - instellingenpagina

## Veiligheid en privacy

- Jira-credentials worden opgeslagen in `chrome.storage.local` op je eigen browserprofiel.
- API-calls naar Jira gebeuren alleen vanuit de extensie-service-worker.
- Er wordt geen externe analytics of tracking gebruikt in deze codebase.

## Updaten na codewijzigingen

1. Ga naar `chrome://extensions`.
2. Klik bij de extensie op **Reload**.
3. Herlaad je Gmail-tab.

