# PrintModeller · by Simon R.

Ein schlanker 3D-Modeller im Browser – gebaut für **einfache, präzise Teile für den 3D-Druck**.

**Warum?** Für meine 3D-Druck-Projekte gab es keine Software, die genau auf meine Bedürfnisse zugeschnitten war:
Tinkercad ist intuitiv, stößt aber schnell an Grenzen – Shapr3D ist mächtig, für ein schnelles Druckteil aber oft zu viel.
PrintModeller verbindet beides: intuitives Bauen mit einfachen Grundkörpern und echte CAD-Werkzeuge für die komplexen Teile.

Skizze zeichnen → extrudieren → Teile aneinander schieben (sie rasten ein) → vereinen →
Kanten runden → als 3MF/STL exportieren. Mehr nicht, aber das richtig.

Unter der Haube rechnet ein echter CAD-Kern (OpenCascade via [replicad](https://replicad.xyz), als WebAssembly in
einem Web-Worker). Dadurch sind Rundungen, Fasen und Boolesche Operationen exakt – auch an den Übergängen
zwischen vereinten Teilen.

## Funktionen

- **Einheit & Raster beim Start wählen** (mm / cm / Zoll). Alles rastet auf das Raster, `Alt` beim Ziehen = frei.
- **Ansichten** 3D / Oben / Vorne / Hinten / Links / Rechts (Tasten `1`–`6`, `Leertaste` = Oben ↔ 3D, `0` = einpassen).
  2D-Ansichten sind orthografisch. Beim Überfahren der Ansichts-Buttons leuchtet im Modell die Seite auf, von der aus
  diese Ansicht schaut (in der Achsfarbe: X rot, Y grün, Z blau). Rechte Maustaste in einer 2D-Ansicht dreht direkt in 3D weiter.
- **Skizzen in jeder Ebene**: gezeichnet wird in der Ebene der aktuellen Ansicht (Vorne/Hinten/Links/Rechts, in 3D auf dem Boden).
  Rechteck (Ecke→Ecke oder aus der Mitte), Kreis (Mittelpunkt oder Ecke→Ecke), Polygon/Linienzug (Shift = 15°-Schritte).
  Maße live beim Zeichnen, danach exakt im Panel oder per Klick aufs Maß-Label. Nach dem Zeichnen ist wieder der Auswahl-Pfeil aktiv.
- **Mini-3D-Vorschau oben rechts** in jeder 2D-Ansicht: ein Auge in der Achsfarbe mit Sichtkegel zeigt, von wo du gerade
  schaust (Vorne und Hinten sind so klar unterscheidbar); der Kegel folgt dem sichtbaren Ausschnitt. Klick = zurück zu 3D.
- **Skizzenebene oben rechts**: dieselbe Vorschau zeigt beim Skizzieren, wo die Ebene im Raum liegt. Links/rechts ziehen verschiebt sie live
  (rastet bündig an Flächen anderer Körper ein), Mausrad = ein Rasterschritt, exakte Eingabe, Liste „Bündig mit Fläche …“ oder
  Fadenkreuz-Button und dann eine Fläche im Modell anklicken – die Skizze liegt genau darauf (die Ansicht dreht sich passend mit).
- **Extrudieren** per Höheneingabe oder am Pfeil ziehen – auch direkt als Loch.
- **Grundkörper**: Quader, Zylinder, **Keil** (mit Winkel-Eingabe), Kegel, Kugel, Rohr – jeweils auch als Loch (Shift+Klick).
- **Verschieben mit Einrasten**: Körper rasten an Flächen anderer Körper ein (bündig, anliegend, mittig) und am Druckbett.
  Pinke Hilfslinien zeigen, woran gerade eingerastet wurde.
- **Griffe** an den Flächen zum Ziehen der Maße – Pfeile in der Farbe ihrer Achse, die die Zugrichtung zeigen.
  Maß-Labels (X/Y/Z) direkt editierbar.
- **Drehen** in 90°-Schritten um X/Y/Z (bleibt auf dem Bett liegen), freie Winkel im Panel,
  **„Fläche aufs Bett legen“**: Fläche anklicken → das Teil liegt flach darauf.
- **Boolesche Operationen** (linke Leiste oder Panel bei Mehrfachauswahl):
  - **Vereinen** (`Strg+G`): ein echter Körper, Löcher werden abgezogen – danach lassen sich auch die Übergangskanten runden.
  - **Abziehen**: vom zuerst gewählten Körper werden alle weiteren abgezogen. Die Werkzeuge bleiben unsichtbar erhalten
    (bei Auswahl als Umriss sichtbar), lassen sich im Panel aufklappen und ändern, die Basis lässt sich tauschen.
  - **Schnittmenge**: nur das gemeinsame Volumen bleibt.
  - **Gruppieren**: nur zusammenfassen, die Teile bleiben getrennte Volumen.
  - Die Art lässt sich nachträglich umschalten, Teile lassen sich herauslösen, `Strg+Shift+G` trennt wieder alles.
  - Kombinierte Körper sind **skalierbar** (Griffe, Maßfelder oder Prozent; Shift an den Griffen = proportional) –
    parametrisch, d. h. runde Teile bleiben rund und alles bleibt exakt.
- **Kanten & Flächen bearbeiten** (`F` oder Doppelklick auf einen Körper): Beim Darüberfahren leuchten Kanten (gelb)
  und Flächen (blau) auf.
  - Kante anklicken → Pfeil **raus ziehen = Rundung, rein ziehen = Fase**. Klappt an äußeren und inneren Kanten
    (z. B. Übergänge vereinter Teile).
  - Fläche anklicken → **Verschieben** (Pfeil, nach außen/innen) oder **Neigen**: Kante wählen, um die gekippt wird,
    dann Keil dazu oder weg per Winkel oder Ziehen.
  - Alles bleibt nachträglich im Panel änderbar.
- **Zahlen ziehen** wie in Adobe-Programmen: auf einem Zahlenfeld (oder Maß-Label im 3D) links/rechts ziehen, Klick zum Tippen.
- **Tooltips** an allen Buttons (mit Tastenkürzel).
- **Kontextleiste** unten im Modell für die Auswahl: Kanten & Flächen, aufs Bett legen, drehen, Loch, kombinieren …
  – die nächsten sinnvollen Schritte, ohne Tastenkürzel kennen zu müssen.
- **Farben mit Bedeutung**: Skizze hellblau, Körper indigo, Kanten & Flächen orange, aufs Bett legen gelb,
  Vereinen grün, Abziehen rot, Schnittmenge lila – in Werkzeugleiste, Modusrahmen, Statusleiste und Panels gleich.
- **Druckbett** ein- und ausblendbar (Panel rechts, ohne Auswahl).
- **Ausrichten** mehrerer Körper (Anfang/Mitte/Ende pro Achse).
- **Export**: 3MF (empfohlen), STL (binär) oder STEP – mit wählbarer Tessellierungs-Qualität, wasserdichtes Netz,
  Volumen/Gewichts-Schätzung.
- **Import** von STEP, STL, 3MF und OBJ (Button „Importieren“ oder Datei ins Fenster ziehen). Jeder Volumenkörper
  wird ein eigener Körper und lässt sich wie alles andere verschieben, vereinen, bearbeiten und exportieren.
  - **STEP** (empfohlen) bringt die exakte CAD-Geometrie mit.
  - **STL/3MF/OBJ** sind Dreiecksnetze: bis ca. 12.000 Dreiecke werden sie in CAD-Körper umgewandelt – ebene Bereiche
    werden wieder zu echten Flächen (verschieben, neigen, Kanten dazwischen runden), gekrümmte Bereiche bleiben
    facettiert. Größere Netze werden als schnelles **Mesh-Objekt** geladen (verschieben, drehen, aufs Bett legen,
    exportieren); die Umwandlung lässt sich im Panel trotzdem starten.
  - Skalierung (cm→mm, Zoll→mm) im Panel.
- Lange Berechnungen zeigen die Laufzeit und lassen sich unten rechts **abbrechen** (der CAD-Kern startet neu).
- **Projekte**: Leiste unten (einklappbar) mit allen Projekten samt Vorschaubild, Anzahl Körper und Änderungszeit –
  wechseln, neu anlegen, umbenennen (Doppelklick), duplizieren, löschen. Alles wird automatisch im Browser gespeichert
  (IndexedDB, inkl. importierter Dateien); ein Projekt aus früheren Versionen wird als „Mein Projekt“ übernommen.
- Rückgängig/Wiederholen, Kopieren/Einfügen, Projektdatei herunterladen/öffnen (JSON).

## Bedienung (Kurzfassung)

| Taste | Aktion |
| --- | --- |
| `V` | Auswählen & verschieben |
| `R` / `C` / `P` | Rechteck / Kreis / Polygon |
| `F` | Kanten & Flächen bearbeiten |
| `L` | Fläche aufs Bett legen |
| `1`–`6` / `Leertaste` | Ansichten / Oben ↔ 3D |
| `Strg+G` / `Strg+Shift+G` | Vereinen / Trennen |
| `Strg+D` | Duplizieren |
| `Q` / `E` | 90° um Z drehen |
| `H` | Volumen ↔ Loch |
| Pfeiltasten / Bild↑↓ | Auswahl um einen Rasterschritt verschieben (Shift ×10) |
| `Esc` | Abbrechen / Werkzeug beenden |

Maus: links auswählen/ziehen/zeichnen, rechte Taste halten zum Drehen (aus 2D-Ansichten geht es in 3D weiter), mittlere Taste verschieben, Rad zoomen.
Zahlenfelder verstehen Rechnungen wie `120/2` oder `2cm+5`.

## Entwicklung

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # Typecheck + Produktions-Build nach dist/
npm run preview   # Build lokal ansehen
```

Stack: Vite 8, React 19, TypeScript, Three.js / React Three Fiber / drei, Zustand, Tailwind CSS 4,
replicad + OpenCascade (WASM) im Web Worker, fflate (3MF).

Name, Autor und Repo-Link stehen zentral in `src/ui/brand.ts`.

```
src/
  cad/        CAD-Worker (OpenCascade), Mesh-Cache, STL/3MF-Writer
  store/      Dokument, Auswahl, Undo/Redo, alle Modell-Operationen, Projekte
  lib/        Einheiten, Geometrie-Helfer, Snapping, Resize-Logik
  viewport/   3D-Ansicht: Kameras, Körper, Skizzen, Griffe, Kanten-Werkzeug, Ebenen-Vorschau
  ui/         Toolbar, Panels, Dialoge, Tastenkürzel
```

## Deployment

`.github/workflows/deploy.yml` baut bei jedem Push auf `main` und veröffentlicht auf GitHub Pages
(in den Repo-Einstellungen unter *Pages* als Quelle „GitHub Actions“ wählen). Der Build nutzt relative Pfade
und läuft daher auf jedem statischen Hoster.
