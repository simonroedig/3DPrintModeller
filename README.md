# PrintModeller

Ein schlanker 3D-Modeller im Browser – gebaut für **einfache, präzise Teile für den 3D-Druck**.
Skizze zeichnen → extrudieren → Teile aneinander schieben (sie rasten ein) → vereinen →
Kanten runden → als 3MF/STL exportieren. Mehr nicht, aber das richtig.

Unter der Haube rechnet ein echter CAD-Kern (OpenCascade via [replicad](https://replicad.xyz), als WebAssembly in
einem Web-Worker). Dadurch sind Rundungen, Fasen und Boolesche Operationen exakt – auch an den Übergängen
zwischen vereinten Teilen.

## Funktionen

- **Einheit & Raster beim Start wählen** (mm / cm / Zoll). Alles rastet auf das Raster, `Alt` beim Ziehen = frei.
- **Ansichten** 3D / Oben / Vorne / Rechts (Tasten `1`–`4`, `0` = einpassen). 2D-Ansichten sind orthografisch.
- **Skizzen** in der Draufsicht: Rechteck (Ecke→Ecke oder aus der Mitte), Kreis (Mittelpunkt oder Ecke→Ecke),
  Polygon/Linienzug (Shift = 15°-Schritte). Maße live beim Zeichnen, danach exakt im Panel oder per Klick aufs Maß-Label.
- **Extrudieren** per Höheneingabe oder am grünen Pfeil ziehen – auch direkt als Loch.
- **Grundkörper**: Quader, Zylinder, **Keil** (mit Winkel-Eingabe), Kegel, Kugel, Rohr – jeweils auch als Loch (Shift+Klick).
- **Verschieben mit Einrasten**: Körper rasten an Flächen anderer Körper ein (bündig, anliegend, mittig) und am Druckbett.
  Pinke Hilfslinien zeigen, woran gerade eingerastet wurde.
- **Griffe** an den Flächen zum Ziehen der Maße, Maß-Labels (X/Y/Z) direkt editierbar.
- **Drehen** in 90°-Schritten um X/Y/Z (bleibt auf dem Bett liegen), freie Winkel im Panel,
  **„Fläche aufs Bett legen“**: Fläche anklicken → das Teil liegt flach darauf.
- **Vereinen** (`Strg+G`): Volumen werden vereinigt, Löcher abgezogen – danach lassen sich auch die Übergangskanten runden.
- **Kanten & Flächen bearbeiten** (`F` oder Doppelklick auf einen Körper): Beim Darüberfahren leuchten Kanten (gelb)
  und Flächen (blau) auf.
  - Kante anklicken → Pfeil **raus ziehen = Rundung, rein ziehen = Fase**. Klappt an äußeren und inneren Kanten
    (z. B. Übergänge vereinter Teile).
  - Fläche anklicken → **Verschieben** (Pfeil, nach außen/innen) oder **Neigen**: Kante wählen, um die gekippt wird,
    dann Keil dazu oder weg per Winkel oder Ziehen.
  - Alles bleibt nachträglich im Panel änderbar.
- **Zahlen ziehen** wie in Adobe-Programmen: Feld-Beschriftung (oder Maß-Label im 3D) links/rechts ziehen.
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
- Rückgängig/Wiederholen, Kopieren/Einfügen, Projekt speichern/öffnen (JSON), automatisches Speichern im Browser
  (IndexedDB, inkl. importierter Dateien).

## Bedienung (Kurzfassung)

| Taste | Aktion |
| --- | --- |
| `V` | Auswählen & verschieben |
| `R` / `C` / `P` | Rechteck / Kreis / Polygon |
| `F` | Kanten & Flächen bearbeiten |
| `L` | Fläche aufs Bett legen |
| `Strg+G` / `Strg+Shift+G` | Vereinen / Trennen |
| `Strg+D` | Duplizieren |
| `Q` / `E` | 90° um Z drehen |
| `H` | Volumen ↔ Loch |
| Pfeiltasten / Bild↑↓ | Auswahl um einen Rasterschritt verschieben (Shift ×10) |
| `Esc` | Abbrechen / Werkzeug beenden |

Maus: links auswählen/ziehen/zeichnen, rechte Taste halten zum Drehen (in 2D-Ansichten verschieben), mittlere Taste verschieben, Rad zoomen.
Zahlenfelder verstehen Rechnungen wie `120/2` oder `2cm+5`.

## Entwicklung

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # Typecheck + Produktions-Build nach dist/
npm run preview   # Build lokal ansehen
```

Stack: Vite 8, React 19, TypeScript, Three.js / React Three Fiber / drei, Zustand, Tailwind CSS 4,
replicad + OpenCascade (WASM), fflate (3MF).

```
src/
  cad/        CAD-Worker (OpenCascade), Mesh-Cache, STL/3MF-Writer
  store/      Dokument, Auswahl, Undo/Redo, alle Modell-Operationen
  lib/        Einheiten, Geometrie-Helfer, Snapping, Resize-Logik
  viewport/   3D-Ansicht: Kameras, Körper, Skizzen, Griffe, Fillet-Werkzeug
  ui/         Toolbar, Panels, Dialoge, Tastenkürzel
```

## Deployment

`.github/workflows/deploy.yml` baut bei jedem Push auf `main` und veröffentlicht auf GitHub Pages
(in den Repo-Einstellungen unter *Pages* als Quelle „GitHub Actions“ wählen). Der Build nutzt relative Pfade
und läuft daher auf jedem statischen Hoster.
