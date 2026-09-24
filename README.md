# Exsodus – Wallet-Seitenleiste für Exodus

Exsodus rüstet der [Exodus](https://www.exodus.com/)-Desktop-App eine Seitenleiste nach, mit der
du **mehrere getrennte Wallets** (jede mit eigener 12-Wörter-Phrase) verwaltest und mit einem Klick
zwischen ihnen wechselst – ohne jedes Mal den Datenordner von Hand zu tauschen.

Die Seitenleiste ist optisch an Exodus angelehnt: gleiche Farben, Schrift (Roboto) und der typische
Verlauf von Violett nach Cyan. Sie übernimmt automatisch das aktive Exodus-Theme sowie Sprache und
Anzeigewährung.

> **Kurz gesagt:** ein Wallet-Umschalter, der so aussieht und sich so anfühlt, als käme er von Exodus.

<p align="center">
  <img src="docs/images/sidebar.png" width="330" alt="Wallet-Seitenleiste mit Gesamtsumme und Wallet-Liste">
</p>

---

## Funktionen

- **Mehrere Wallets nebeneinander** – jede in ihrem eigenen Datenordner unter `%APPDATA%\Exodus-Wallets`,
  jede mit eigener 12-Wörter-Phrase.
- **Umschalten mit einem Klick** – Wallet öffnen, zu einem laufenden Fenster springen oder per
  *Wechseln* die aktuelle Wallet schließen und die neue öffnen.
- **Gesamtsumme oben** – der Wert aller Wallets zusammen, bei gemischten Währungen als Teilsummen
  (z. B. `12.330,19 € + 150,14 £`; ohne Kursumrechnung aus dem Netz).
- **Kontostände ohne Öffnen** – jedes laufende Fenster speichert seinen letzten Fiat-Stand alle 20 s,
  sodass die Leiste die Stände aller Wallets zeigt.
- **Adressen kopieren ohne Öffnen** – Empfangsadressen aller Coins, mit Coin-Suche und **Portfolio-Tabs**;
  bei mehreren Portfolios kopierst du gezielt die Adresse des richtigen Portfolios.
- **12 Wörter anzeigen** – führt zu Exodus' eigener Backup-Seite (Exodus fragt dort das Passwort ab).
- **Start-Wallet festlegen** – diese Wallet öffnet sich, wenn du Exodus normal startest.
- **Umbenennen** – auch offene Wallets (werden dafür geschlossen und optional wieder geöffnet).
- **Löschen** – verschiebt den Wallet-Ordner in den **Papierkorb** (Bestätigung durch Eintippen des Namens).
- **Eigenes Bild pro Wallet** – oder das Exodus-Logo als Standard.
- **Alte Ordner übernehmen** – von Hand umbenannte `exodus.wallet`-Ordner werden erkannt und kopiert.
- **Fenstertitel** – jedes Fenster trägt den Wallet-Namen (Taskleiste, Alt+Tab).
- **Rechtsklick** auf eine Wallet öffnet das Menü an der Mausposition.
- **Sprache & Währung** folgen der Exodus-Einstellung (Deutsch/Englisch, Zahlen- und Datumsformat passend).

### Bildschirmfotos

| Aktionsmenü | Adressen kopieren | Wallet löschen |
|:---:|:---:|:---:|
| ![Menü](docs/images/menu.png) | ![Adressen](docs/images/addresses.png) | ![Löschen](docs/images/delete.png) |

*(Die Bilder zeigen Beispieldaten in einer Testumgebung.)*

---

## Installation

**Voraussetzungen:** Windows, [Node.js](https://nodejs.org/) und eine installierte Exodus-Desktop-App.

Es reichen der `install.js` und der Ordner `payload/` im selben Verzeichnis:

```
exsodus\
├── install.js
└── payload\
    ├── main.js
    └── preload.js
```

Dann:

1. Exodus **vollständig schließen** (auch das Symbol im Infobereich der Taskleiste).
2. Im Ordner ausführen:
   ```
   node install.js install
   ```
3. Exodus starten – links oben vor dem Logo ist jetzt der Wallet-Knopf.

Weitere Befehle:

| Befehl | Wirkung |
|---|---|
| `node install.js install` | Seitenleiste in die neueste Exodus-Version einbauen (legt vorher ein Backup an) |
| `node install.js uninstall` | Original-Exodus aus dem Backup wiederherstellen |
| `node install.js status` | Zeigt für jede installierte Version, ob die Seitenleiste aktiv ist |
| `node install.js install --app "<Pfad zu app-x.y.z>"` | Eine bestimmte Exodus-Version statt der neuesten |

> **Nach jedem Exodus-Update** einmal `node install.js install` erneut ausführen – das Update ersetzt die
> Datei `app.asar`, in die das Addon eingebaut wird. Deine Wallets bleiben davon unberührt.

---

## Umzug auf einen anderen Rechner

Wallets, Namen, Bilder, Start-Wallet und gespeicherte Adressen liegen unter `%APPDATA%\Exodus-Wallets`
(und die Haupt-Wallet unter `%APPDATA%\Exodus`) und werden **nicht** vom Installer kopiert.

- **Sauber neu:** Addon installieren und jede Wallet mit ihren 12 Wörtern wiederherstellen.
- **Von Hand umbenannte Ordner:** Liegt ein alter `exodus.wallet`-Ordner (z. B. als `exodus.wallet1`)
  direkt in `%APPDATA%\Exodus`, bietet die Leiste unten *„Alten Ordner … übernehmen“* an. Das Original
  bleibt dabei unangetastet, die Kopie wird Datei für Datei per Prüfsumme geprüft.

---

## Sicherheit

- Das Addon **liest oder entschlüsselt keine Seeds, Passwörter oder privaten Schlüssel** und baut
  **keine Netzwerkverbindungen** auf.
- Es liest über Exodus' eigene Selektoren nur die Fiat-Kontostände und öffentlichen Empfangsadressen
  und speichert sie als Cache im jeweiligen Datenordner.
- „12 Wörter anzeigen“ öffnet nur Exodus' eigenen Backup-Bildschirm – die Passwortabfrage übernimmt Exodus.
- Löschen heißt **Papierkorb**, kein hartes Löschen. Schlägt das Verschieben fehl, passiert nichts.
- Die Aktionen nehmen nur Aufrufe der echten Exodus-Oberfläche an (geprüfte Herkunft und Session).

> ⚠️ Trotzdem gilt: Sichere immer deine 12 Wörter. Nur damit lässt sich eine Wallet wiederherstellen,
> wenn ein Datenordner verloren geht.

---

## Wie es funktioniert

Exodus ist eine Electron-App. Der Installer packt `resources\app.asar` aus, hängt **eine Zeile** an
`src/app/main/index.js` an (inline, als IIFE) und legt die beiden Payload-Dateien daneben ab. Sonst
bleibt alles Byte für Byte gleich; das Original wird als `app.asar.orig` gesichert.

- **`payload/main.js`** – läuft im Hauptprozess: verwaltet die Datenordner, startet Exodus mit dem
  offiziellen Parameter `--datadir`, speichert Kontostand- und Adress-Cache, setzt Fenstertitel und
  beantwortet die IPC-Aufrufe der Seitenleiste.
- **`payload/preload.js`** – läuft als zusätzliches Preload-Skript in der Exodus-Oberfläche (eigene
  isolierte Welt) und baut die Seitenleiste als DOM auf. Alle Aktionen laufen über IPC an `main.js`.
- **`install.js`** – liest und schreibt das asar-Format selbst (inkl. Integritäts-Hashes), prüft das
  Ergebnis vor dem Ersetzen und kann sauber deinstallieren.

Details siehe [ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Kompatibilität

Entwickelt und getestet mit **Exodus 26.8.x** unter Windows. Da das Addon auf interne Bausteine von
Exodus zugreift (Selektoren, Session-Namen, Fenstertyp), kann eine deutlich andere Version abweichen.
Der Installer warnt, wenn erwartete Bausteine fehlen. Bei Problemen hilft die Datei
`exodus-wallets-debug.log`, die das Addon auf den Desktop schreibt.

---

## Haftungsausschluss

Dieses Projekt ist ein inoffizielles Community-Addon und steht in **keiner Verbindung zu Exodus
Movement, Inc.** „Exodus“ ist eine Marke ihrer jeweiligen Inhaber. Die Nutzung erfolgt auf eigene
Verantwortung; das Verändern von `app.asar` kann von zukünftigen Exodus-Versionen überschrieben werden.

## Lizenz

[MIT](LICENSE) – gilt für den Code dieses Addons, nicht für Exodus selbst.
