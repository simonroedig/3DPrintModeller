/** German texts for the start, export, help and about dialogs (src/ui/Dialogs.tsx, About.tsx, brand.ts) */
const de: Record<string, string> = {
  // brand + pitch (About.tsx)
  "Precise parts for 3D printing, right in your browser.": "Präzise Teile für den 3D-Druck, direkt im Browser.",
  "For my 3D printing projects, I couldn't find any software tailored to my needs. Tinkercad is intuitive but quickly hits its limits. Shapr3D is powerful, but often overkill for a quick print part. {app} combines both: intuitive building with simple primitives, plus real CAD tools for the complex parts.":
    "Für meine 3D-Druck-Projekte gab es keine Software, die genau auf meine Bedürfnisse zugeschnitten war: Tinkercad ist intuitiv, stößt aber schnell an Grenzen. Shapr3D ist mächtig, für ein schnelles Druckteil aber oft zu viel. {app} verbindet beides: intuitives Bauen mit einfachen Grundkörpern und echte CAD-Werkzeuge für die komplexen Teile.",
  "Intuitive like Tinkercad": "Intuitiv wie Tinkercad",
  "Drop in primitives and drag the arrows. Parts snap to each other and to the print bed.":
    "Grundkörper einfügen, an Pfeilen ziehen. Teile rasten aneinander und am Druckbett ein.",
  "Precise like CAD": "Präzise wie CAD",
  "Sketches on any plane, exact dimensions, real fillets and chamfers on an OpenCascade kernel.":
    "Skizzen in jeder Ebene, exakte Maße, echte Rundungen und Fasen auf einem OpenCascade-Kern.",
  "Boolean operations": "Boolesche Operationen",
  "Union, subtract, intersect: non-destructive, so every part stays editable.":
    "Vereinen, Abziehen, Schnittmenge: nicht-destruktiv, alle Teile bleiben änderbar.",
  "Made for printing": "Gemacht für den Druck",
  "Export to 3MF, STL or STEP, import STEP, STL, 3MF and OBJ. All right in your browser.":
    "Export als 3MF, STL oder STEP, Import von STEP, STL, 3MF und OBJ. Alles im Browser.",
  "Designed & developed by {author}": "Entworfen & entwickelt von {author}",
  "Source code": "Quellcode",

  // tech stack chips (About.tsx)
  "Built with": "Gebaut mit",
  "React 19": "React 19",
  "UI framework that builds the interface from components": "UI-Framework, aus dessen Komponenten die Oberfläche besteht",
  TypeScript: "TypeScript",
  "JavaScript with static types, catches bugs during development": "JavaScript mit statischen Typen, findet Fehler schon beim Entwickeln",
  "Three.js + React Three Fiber": "Three.js + React Three Fiber",
  "3D rendering in the browser, written as React components": "3D-Darstellung im Browser, geschrieben als React-Komponenten",
  "OpenCascade CAD kernel (WebAssembly)": "OpenCascade CAD-Kern (WebAssembly)",
  "The CAD kernel that computes solids, fillets and booleans, compiled to run in the browser":
    "Der CAD-Kern, der Volumenkörper, Rundungen und boolesche Operationen berechnet, kompiliert für den Browser",
  "Web Worker": "Web Worker",
  "Runs the CAD kernel in the background so the interface stays smooth": "Lässt den CAD-Kern im Hintergrund laufen, damit die Oberfläche flüssig bleibt",
  "Zustand (state management)": "Zustand (State-Management)",
  "Small library that holds the app state: document, selection, undo/redo":
    "Kleine Bibliothek, die den App-Zustand hält: Dokument, Auswahl, Rückgängig/Wiederholen",
  "Tailwind CSS": "Tailwind CSS",
  "Utility-first CSS framework used for all styling": "CSS-Framework mit Utility-Klassen für das gesamte Styling",

  // dialog frame
  "Close (Esc)": "Schließen (Esc)",
  Cancel: "Abbrechen",

  // start dialog
  "Let's get started": "Los geht's",
  "New project": "Neues Projekt",
  "Create your first project.": "Lege dein erstes Projekt an.",
  "Your current project stays saved.": "Das aktuelle Projekt bleibt gespeichert.",
  "Which unit do you work in?": "In welcher Einheit arbeitest du?",
  Millimeter: "Millimeter",
  "Precise parts · 1 mm grid": "Präzise Teile · Raster 1 mm",
  Centimeter: "Zentimeter",
  "Larger parts · 1 cm grid": "Größere Teile · Raster 1 cm",
  Inch: "Zoll",
  "Imperial · 1/16″ grid": "Imperial · Raster 1/16″",
  "Grid (everything snaps to it)": "Raster (alles rastet darauf ein)",
  "Start an empty project": "Leeres Projekt starten",
  "Or explore an example": "Oder ein Beispiel ansehen",
  "Built from a plate, a wedge and a lip, with a cable channel subtracted and the edges rounded. Everything stays editable.":
    "Aus Platte, Keil und Lippe gebaut, Kabelkanal abgezogen, Kanten gerundet. Alles bleibt änderbar.",
  "Phone stand": "Handyständer",
  "Two wedges joined by a crossbar, forming a speaker stand": "Zwei Keile und ein Steg als Lautsprecher-Ständer",
  "Speaker wedge": "Lautsprecher-Keil",

  // export dialog
  Export: "Exportieren",
  "Touching parts are merged, holes are subtracted automatically.": "Sich berührende Teile werden vereint, Löcher automatisch abgezogen.",
  "Recommended · Bambu, Prusa, Orca, Cura": "Empfohlen · Bambu, Prusa, Orca, Cura",
  "Universal, works with every slicer": "Universell, jeder Slicer",
  "Exact CAD geometry (Fusion, FreeCAD, …)": "Exakte CAD-Geometrie (Fusion, FreeCAD …)",
  "Quality (tessellation)": "Qualität (Tessellierung)",
  Normal: "Normal",
  "0.02 mm deviation": "0,02 mm Abweichung",
  High: "Hoch",
  "0.008 mm · smooth curves": "0,008 mm · glatte Rundungen",
  Ultra: "Ultra",
  "0.003 mm · large files": "0,003 mm · große Dateien",
  "Export selection only ({count})": "Nur Auswahl exportieren ({count})",
  "Each body as a separate object (e.g. for different colors)": "Jeden Körper als eigenes Objekt (z. B. für unterschiedliche Farben)",
  "File name": "Dateiname",
  model: "modell",
  "There is no visible solid to export.": "Es gibt keinen sichtbaren Volumenkörper zum Exportieren.",
  "Done · Volume {volume} cm³ ≈ {grams} g PLA (100% infill) · File {size} KB":
    "Fertig · Volumen {volume} cm³ ≈ {grams} g PLA (100 % Infill) · Datei {size} KB",

  // help dialog
  "Keyboard shortcuts & controls": "Tastenkürzel & Bedienung",
  // key column; letter keys and names that stay the same in German are listed too
  V: "V",
  "R / C / P": "R / C / P",
  F: "F",
  L: "L",
  "1 to 7": "1 bis 7",
  Space: "Leertaste",
  "0": "0",
  "Ctrl + G": "Strg + G",
  "Ctrl + Shift + G": "Strg + Shift + G",
  "Ctrl + D": "Strg + D",
  "Ctrl + C / V": "Strg + C / V",
  "Ctrl + Z / Ctrl + Shift + Z": "Strg + Z / Strg + Shift + Z",
  "Del / Backspace": "Entf / Backspace",
  "Arrow keys": "Pfeiltasten",
  "Page Up / Page Down": "Bild ↑ / Bild ↓",
  "Q / E": "Q / E",
  "M / Shift + M": "M / Shift + M",
  H: "H",
  "Alt while dragging": "Alt beim Ziehen",
  "Shift while dragging": "Shift beim Ziehen",
  "Drag a number field": "Zahlenfeld ziehen",
  Esc: "Esc",
  "Ctrl + S / Ctrl + O": "Strg + S / Strg + O",
  "Drop a file into the window": "Datei ins Fenster ziehen",
  // description column
  "Select & move": "Auswählen & Verschieben",
  "Sketch a rectangle / circle / polygon in the plane of the current view (3D: ground plane)":
    "Rechteck / Kreis / Polygon skizzieren, in der Ebene der aktuellen Ansicht (3D = Boden)",
  "Edit edges & faces (or double-click a body)": "Kanten & Flächen bearbeiten (auch Doppelklick auf einen Körper)",
  "Lay a face flat on the print bed": "Fläche aufs Druckbett legen",
  "3D / Top / Front / Back / Left / Right / Bottom": "3D / Oben / Vorne / Hinten / Links / Rechts / Unten",
  "Switch between top view and 3D": "Zwischen Oben und 3D wechseln",
  "Zoom to fit": "Alles einpassen",
  "Union (subtract, intersect, group: left toolbar / panel)": "Vereinen (Abziehen, Schnittmenge, Gruppieren: linke Leiste / Panel)",
  "Split a combined body": "Kombinierten Körper trennen",
  Duplicate: "Duplizieren",
  "Copy / Paste": "Kopieren / Einfügen",
  "Undo / Redo": "Rückgängig / Wiederholen",
  "Delete selection": "Auswahl löschen",
  "Move selection by 1 grid step (Shift: ×10)": "Auswahl um 1 Rasterschritt verschieben (Shift: ×10)",
  "Move selection along Z": "Auswahl in Z verschieben",
  "Rotate selection 90° around Z": "Auswahl um 90° um Z drehen",
  "Center the selection (or everything, if nothing is selected) on the bed, snapped to the grid / exactly":
    "Auswahl (ohne Auswahl: alles) mittig aufs Bett, im Raster / exakt",
  "Toggle selection between solid and hole": "Auswahl zwischen Volumen und Loch umschalten",
  "Turn off grid & snapping": "Raster & Einrasten aus",
  "Scale combined bodies proportionally via their handles": "Griffe vereinter Körper: proportional skalieren",
  "Drag left/right to change the value (Shift ×10, Alt ×0.1), click to type":
    "Zahl per Links/Rechts-Ziehen ändern (Shift ×10, Alt ×0,1), Klick zum Tippen",
  "Cancel / exit tool / clear selection": "Abbrechen / Werkzeug beenden / Auswahl aufheben",
  "Download project file / open as a new project (also accepts STEP/STL/3MF/OBJ)":
    "Projektdatei herunterladen / als neues Projekt öffnen (nimmt auch STEP/STL/3MF/OBJ)",
  "Import STEP, STL, 3MF or OBJ": "STEP, STL, 3MF oder OBJ importieren",
  "Mouse: left button to select, drag and draw · hold the right button to orbit (from a 2D view, this continues in 3D) · middle button to pan · wheel to zoom. Set the sketch plane at the top right (drag, type a value or click a face). Number fields understand math like {example1} or {example2}. All projects are saved automatically in your browser. In the project bar at the bottom you can switch, create, rename (double-click), duplicate or delete projects.":
    "Maus: Linke Taste auswählen, ziehen und zeichnen · Rechte Taste halten drehen (aus einer 2D-Ansicht geht es dabei in 3D weiter) · Mittlere Taste verschieben · Rad zoomen. Die Skizzenebene stellst du oben rechts ein (ziehen, eintippen oder auf eine Fläche klicken). Zahlenfelder verstehen Rechnungen wie {example1} oder {example2}. Alle Projekte werden automatisch im Browser gespeichert. Unten in der Projektleiste kannst du wechseln, anlegen, umbenennen (Doppelklick), kopieren oder löschen.",
};

export default de;
