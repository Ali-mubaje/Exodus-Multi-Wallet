# Architektur & Interna

Diese Datei erklärt, wie Exsodus aufgebaut ist – gedacht für alle, die den Code lesen, anpassen oder
an eine neue Exodus-Version anpassen wollen.

## Überblick

Exodus ist eine Electron-App. Exsodus klinkt sich an zwei Stellen ein:

```
                 install.js
                     │  hängt EINE Zeile an src/app/main/index.js an (inline IIFE)
                     ▼
┌──────────────────────────────┐        IPC (exodus-wallets:*)       ┌───────────────────────────┐
│  payload/main.js              │  ◄───────────────────────────────► │  payload/preload.js       │
│  (Electron-Hauptprozess)      │                                    │  (Exodus-Oberfläche,      │
│                               │                                    │   isolierte Welt)         │
│  • Datenordner verwalten      │                                    │  • Seitenleiste als DOM   │
│  • Exodus mit --datadir starten│                                   │  • Menü, Adress-Ansicht,  │
│  • Kontostand-/Adress-Cache   │                                    │    Dialoge                │
│  • Fenstertitel, Start-Wallet │                                    │  • ruft main.js per IPC   │
└──────────────────────────────┘                                    └───────────────────────────┘
```

## Installer (`install.js`)

- Liest `resources\app.asar` mit einem eigenen, minimalen asar-Parser (Header-Pickle, Offsets,
  Integritäts-Hashes je 4-MB-Block).
- Sichert das unveränderte Original als `app.asar.orig`. Alle Änderungen gehen immer vom Original aus.
- Hängt an `src/app/main/index.js` eine als IIFE gewrappte Kopie von `main.js` an (Marker
  `/*exodus-wallets-sidebar*/`). Grund fürs Inlinen: Exodus überschreibt `require()` und lässt nur
  bestimmte Module zu.
- Legt `preload.js` unter `src/app/wallet-switcher/` ab; der Preload-Pfad wird beim Inlinen von
  `main/` auf `../wallet-switcher/preload.js` korrigiert.
- Prüft das neu gebaute asar (Payload-Dateien + einige unveränderte Dateien) **vor** dem Ersetzen.
- `uninstall` spielt einfach `app.asar.orig` zurück.

## Hauptprozess (`payload/main.js`)

### Wallet-Modell
- **Standard-Wallet:** `%APPDATA%\Exodus` (gehört Exodus selbst, wird ohne `--datadir` gestartet).
- **Weitere Wallets:** je ein Ordner unter `%APPDATA%\Exodus-Wallets\<Name>`, gestartet mit
  `--datadir <Ordner>`.
- Läuft eine Wallet, legt Chromium eine `lockfile` in ihren Ordner – daran wird „geöffnet“ erkannt.

### Kontostand- & Adress-Cache
- In jedes laufende Exodus-Fenster wird per `executeJavaScript` ein kleines Skript eingespielt, das
  über Exodus' eigene Selektoren (`selectors.fiatBalances`, `selectors.locale`, `selectors.walletAccounts`)
  die Fiat-Stände, Sprache und Währung liest.
- Ergebnis landet als `wallet-switcher-cache.json` im Datenordner der Wallet. So sehen andere Fenster
  den Stand, ohne die Wallet zu öffnen. Intervall: 20 s.
- **Adressen:** Exodus' Adress-API liegt nicht global, sondern kommt per React-Provider (`exodus`-Prop)
  in die Oberfläche. Das Skript sucht sie über den React-Fiber-Baum und ruft
  `addressProvider.getReceiveAddress({ assetName, walletAccount })` – pro Portfolio, Hardware-Portfolios
  (Ledger/Trezor) ausgenommen. Intervall: 5 min. Gespeichert unter `addresses`/`addressesAt`.

### Sprache (i18n)
- Folgt `selectors.locale.language` (Standard `en`). Texte des Hauptprozesses: `MESSAGES` (en, de).
- Die Seitenleiste hat ihr eigenes Wörterbuch `TEXTS` in `preload.js` und schaltet zur Laufzeit um,
  wenn `state.locale.language` wechselt.

### Fenstertitel
- Exodus' Hauptfenster ist ein `BaseWindow` (kein `BrowserWindow`), daher gibt es kein
  `browser-window-created`. Titel werden per Intervall gesetzt: „EXODUS <Version> – <Wallet-Name>“.

### Start-Wallet & Weiterleitung
- `startWallet` steht in `%APPDATA%\Exodus-Wallets\einstellungen.json`.
- Wird Exodus ohne `--datadir` gestartet (Desktop-Symbol/Startmenü) und ist eine andere Start-Wallet
  gesetzt, leitet `redirectToStartWallet()` an deren Ordner weiter und beendet sich.
- Eigene Starts tragen `EXODUS_WALLETS_DIRECT=1` und werden nicht umgeleitet; Verknüpfungen nutzen
  immer `--datadir`.

### Befehlskanal zwischen Fenstern
- Jede Wallet läuft in einem eigenen Prozess. Für „schließen“, „nach vorne holen“ und „Backup zeigen“
  legt `main.js` eine `wallet-switcher-command.json` in den Zielordner; der dortige Prozess prüft sie
  jede Sekunde.

### Umbenennen & Löschen
- **Umbenennen** einer offenen fremden Wallet: erst per `quit`-Befehl schließen, auf das Verschwinden
  der `lockfile` warten, dann den Ordner umbenennen. Die **eigene** Wallet benennt ein PowerShell-Helfer
  nach dem Beenden um (und öffnet sie optional wieder). Die Standard-Wallet bekommt nur einen
  Anzeigenamen (`standardName`), ihr Ordner bleibt.
- **Löschen** nur über `shell.trashItem` (Papierkorb). Schlägt es fehl, wird abgebrochen. Bestätigung
  durch Eintippen des Namens; Client sperrt den Knopf, `api.remove` prüft erneut.

### Icons & Bilder
- **Coin-Icons:** aus Exodus selbst (`src/res/deps/img/<asset>-<hash>.svg`, bevorzugt 40×40). Tokens
  fallen auf das Icon des Grund-Coins zurück.
- **Wallet-Bild:** Standard ist das Exodus-Logo. Eigenes Bild wird quadratisch zugeschnitten, auf
  128 px verkleinert und als `wallet-switcher-avatar.png` im Datenordner gespeichert; die Leiste
  bekommt es als `data:`-URL (Exodus-CSP erlaubt nur `self` und `data:`).

## Oberfläche (`payload/preload.js`)

- Läuft in einer isolierten Welt (kein Node, kein Zugriff auf Exodus-Interna außer den globalen
  Selektoren, die für den Cache genutzt werden).
- Baut `#xw-root` direkt am `body` auf. Da die Exodus-Theme-Klasse auf einem Element in
  `#app-container` sitzt, kopiert `syncTheme()` die berechneten CSS-Variablen herüber.
- CSS ist bewusst mit `!important` und maximalem `z-index` gegen Kollisionen mit Exodus abgeschirmt.
- Alle privilegierten Aktionen laufen über `ipcRenderer.invoke('exodus-wallets:*')`; `main.js` prüft
  Absender-URL und Session, bevor es etwas ausführt.

## Dateien im Datenordner einer Wallet

| Datei | Zweck |
|---|---|
| `wallet-switcher-cache.json` | Kontostand, Währung, Portfolios, Empfangsadressen (Cache) |
| `wallet-switcher-avatar.png` | eigenes Wallet-Bild (optional) |
| `wallet-switcher-command.json` | kurzlebiger Befehl an das Fenster dieser Wallet |
| `wallet-switcher-restore` | Merker: Wallet soll per 12 Wörtern eingerichtet werden |

Global unter `%APPDATA%\Exodus-Wallets`: `einstellungen.json` (Einstellungen inkl. Start-Wallet,
Anzeigename der Standard-Wallet) und `importiert.log` (übernommene Alt-Ordner).

## An eine neue Exodus-Version anpassen

Prüfpunkte, falls etwas nicht mehr greift:

1. **Session-Name** der Oberfläche (`persist:main` → Ordner `Partitions/main`).
2. **Selektoren** `selectors.fiatBalances/locale/walletAccounts/enabledAssets/assets`.
3. **Adress-API** über den React-Provider (`exodus.addressProvider.getReceiveAddress`).
4. **Fenstertyp** des Hauptfensters (aktuell `BaseWindow`).
5. **Icon-Pfad** `src/res/deps/img/<asset>-<hash>.svg`.
6. **Backup-Route** `/settings/backup` für „12 Wörter anzeigen“.

Das Debug-Log auf dem Desktop (`exodus-wallets-debug.log`) zeigt, welcher Schritt scheitert.
