/** German texts for the app chrome: top bar, tool rail, overlays, context bar, project bar, plane panel */
const de: Record<string, string> = {
  // top bar
  "About {app}": "Über {app}",
  "Open a project file (.json) as a new project (Ctrl+O)": "Projektdatei (.json) als neues Projekt öffnen (Strg+O)",
  Open: "Öffnen",
  "Download the project as a file (Ctrl+S). The browser saves automatically anyway":
    "Projekt als Datei herunterladen (Strg+S). Im Browser wird ohnehin automatisch gespeichert",
  Save: "Speichern",
  "Import STEP, STL, 3MF or OBJ (or drag a file into the window)": "STEP, STL, 3MF oder OBJ importieren (oder Datei ins Fenster ziehen)",
  Import: "Importieren",
  "Undo (Ctrl+Z)": "Rückgängig (Strg+Z)",
  "Redo (Ctrl+Shift+Z)": "Wiederholen (Strg+Shift+Z)",
  Language: "Sprache",
  Unit: "Einheit",
  in: "Zoll",
  Grid: "Raster",
  "Help & shortcuts (?)": "Hilfe & Tastenkürzel (?)",
  Export: "Exportieren",

  // tool rail
  "Select & Move": "Auswählen & Verschieben",
  Sketch: "Skizze",
  Rectangle: "Rechteck",
  Circle: "Kreis",
  "Polygon / polyline": "Polygon / Linienzug",
  Bodies: "Körper",
  "Box (Shift: as hole)": "Quader (Shift: als Loch)",
  "Cylinder (Shift: as hole)": "Zylinder (Shift: als Loch)",
  "Wedge (Shift: as hole)": "Keil (Shift: als Loch)",
  "Cone (Shift: as hole)": "Kegel (Shift: als Loch)",
  "Sphere (Shift: as hole)": "Kugel (Shift: als Loch)",
  "Tube (Shift: as hole)": "Rohr (Shift: als Loch)",
  Edit: "Ändern",
  "Edges & Faces: fillet or chamfer edges, push or tilt faces (or double-click a body)":
    "Kanten & Flächen: Kanten runden/fasen, Flächen verschieben oder neigen (auch Doppelklick auf einen Körper)",
  "Lay a face flat on the print bed": "Fläche aufs Druckbett legen",
  Combine: "Kombinieren",
  "Select several bodies first (Shift+click)": "Erst mehrere Körper wählen (Shift+Klick)",
  "Split: break a combined body back into its parts": "Trennen: kombinierten Körper wieder in seine Teile zerlegen",
  "Ctrl ⇧ G": "Strg ⇧ G",
  "Ctrl G": "Strg G",
  "Ctrl D": "Strg D",
  Del: "Entf",

  // combine operations (OPS in ops.tsx)
  Union: "Vereinen",
  "op|Group": "Gruppieren",
  "btn|Lay flat": "Aufs Bett",
  Subtract: "Abziehen",
  Intersection: "Schnittmenge",
  Intersect: "Schnitt",
  Group: "Gruppe",
  "Merge into one body. Holes are subtracted, the joining edges can be filleted":
    "Zu einem Körper verschmelzen. Löcher werden abgezogen, Übergangskanten lassen sich runden",
  "Subtract all other bodies from the first one selected. The cutting bodies are kept and stay editable":
    "Vom zuerst gewählten Körper alle weiteren abziehen. Die Werkzeuge bleiben erhalten und änderbar",
  "Keep only the volume that all selected bodies share": "Nur das Volumen behalten, das alle gewählten Körper gemeinsam haben",
  "Just bundle them (move and scale together), the parts stay separate volumes":
    "Nur zusammenfassen (gemeinsam verschieben/skalieren), Teile bleiben getrennte Volumen",

  // view switcher
  "3D": "3D",
  Top: "Oben",
  Bottom: "Unten",
  Front: "Vorne",
  Back: "Hinten",
  Left: "Links",
  Right: "Rechts",
  "{view} view ({key})": "{view}-Ansicht ({key})",
  "Fit all (0)": "Alles einpassen (0)",

  // status bar
  "Drag: move (snaps to faces) · Double-click or F: Edges & Faces · Alt: free · Arrow keys: nudge · Del: delete":
    "Ziehen: verschieben (rastet an Flächen ein) · Doppelklick oder F: Kanten & Flächen · Alt: frei · Pfeiltasten: nudgen · Entf: löschen",
  "Click a body to select it · Shift+click: multi-select · Hold right mouse: orbit · Middle mouse: pan · Wheel: zoom":
    "Klicke einen Körper zum Auswählen · Shift+Klick: Mehrfachauswahl · Rechte Maus halten: drehen · Mittlere Maus: verschieben · Rad: zoomen",
  "Click & drag (or click twice) for a rectangle · Alt: no grid · Esc: cancel":
    "Klicken & ziehen (oder zwei Klicks) für ein Rechteck · Alt: ohne Raster · Esc: abbrechen",
  "Click & drag for a circle · Alt: no grid · Esc: cancel": "Klicken & ziehen für einen Kreis · Alt: ohne Raster · Esc: abbrechen",
  "Click to place points · Shift: 15° steps · Click the start point / Enter: close · Backspace: remove last point":
    "Klicken setzt Punkte · Shift: 15°-Schritte · Klick auf Startpunkt / Enter: schließen · Backspace: letzter Punkt zurück",
  "Drag the arrow out: fillet · drag it in: chamfer · Shift+click: more edges · Enter: apply · Esc: clear selection":
    "Pfeil raus ziehen: Rundung · rein ziehen: Fase · Shift+Klick: weitere Kanten · Enter: anwenden · Esc: Auswahl aufheben",
  "Drag the green arrow: offset the face · Tilt: pick an edge, then add or remove a wedge · Enter: apply · Esc: clear selection":
    "Grünen Pfeil ziehen: Fläche versetzen · „Neigen“: Kante wählen und Keil dazu/weg · Enter: anwenden · Esc: Auswahl aufheben",
  "Hover over edges (yellow) or faces (blue) and click · Tip: union touching parts first (Ctrl+G), then the joints can be filleted":
    "Fahre über Kanten (gelb) oder Flächen (blau) und klicke · Tipp: berührende Teile erst vereinen (Strg+G), dann lassen sich die Übergänge runden",
  "Click a flat face: the part is rotated so that it lies flat on the print bed":
    "Klicke eine ebene Fläche: das Teil wird so gedreht, dass sie flach auf dem Druckbett liegt",
  "Loading CAD kernel…": "CAD-Kern lädt…",
  "Calculating…": "Berechne…",
  Ready: "Bereit",
  "Cancel the calculation (the CAD kernel restarts)": "Berechnung abbrechen (der CAD-Kern wird neu gestartet)",
  "Calculation canceled": "Berechnung abgebrochen",
  Cancel: "Abbrechen",

  // mode names (MODE_NAME in Overlays.tsx)
  Select: "Auswahl",
  "Sketch · Rectangle": "Skizze · Rechteck",
  "Sketch · Circle": "Skizze · Kreis",
  "Sketch · Polygon": "Skizze · Polygon",
  "Edges & Faces": "Kanten & Flächen",
  "Lay flat": "Aufs Bett legen",

  // tool options
  "Corner → corner": "Ecke → Ecke",
  "From one corner to the opposite one": "Von einer Ecke zur gegenüberliegenden",
  "From center": "Aus der Mitte",
  "From the center point": "Vom Mittelpunkt aus",
  "Center point": "Mittelpunkt",
  "Center point, then radius": "Mittelpunkt, dann Radius",
  "Drag it out like a rectangle": "Wie ein Rechteck aufziehen",
  "Click to place points · Click the start / Enter closes": "Klicken setzt Punkte · Klick auf Start / Enter schließt",
  "The sketch lies in the plane of the current view (3D = floor) · set its position at the top right":
    "Die Skizze liegt in der Ebene der aktuellen Ansicht (3D = Boden) · Lage oben rechts einstellen",
  "Plane: {orient} · {axis} = {value}": "Ebene: {orient} · {axis} = {value}",
  "Click the face that should rest on the bed": "Klicke die Fläche, die unten aufliegen soll",
  "Leave mode (Esc)": "Modus verlassen (Esc)",

  // edges & faces options
  "Apply (Enter)": "Anwenden (Enter)",
  Apply: "Anwenden",
  Fillet: "Rundung",
  Chamfer: "Fase",
  "Drag the arrow outward": "Pfeil nach außen ziehen",
  "Drag the arrow inward": "Pfeil nach innen ziehen",
  Radius: "Radius",
  Distance: "Abstand",
  "{n} edge": "{n} Kante",
  "{n} edges": "{n} Kanten",
  "Drag the arrow: out = fillet, in = chamfer": "Pfeil ziehen: raus = Rundung, rein = Fase",
  "Select all edges of the body": "Alle Kanten des Körpers auswählen",
  "All edges": "Alle Kanten",
  Push: "Verschieben",
  Tilt: "Neigen",
  "Offset the face outward or inward": "Fläche nach außen/innen versetzen",
  "Tilt the face around an edge (add or remove a wedge)": "Fläche um eine Kante kippen (Keil dazu/weg)",
  "Positive = outward, negative = inward": "Positiv = nach außen, negativ = nach innen",
  "Click the edge to tilt around": "Klicke die Kante, um die gekippt wird",
  "Add wedge": "Keil dazu",
  "Remove wedge": "Keil weg",
  "Add material": "Material hinzufügen",
  "Remove material": "Material wegnehmen",
  Angle: "Winkel",
  "Other edge": "Andere Kante",
  "Hover over edges or faces and click to select": "Fahre über Kanten oder Flächen und klicke zum Auswählen",
  "All edges of the selected body": "Alle Kanten des ausgewählten Körpers",

  // loading, start card
  "Loading CAD kernel (OpenCascade)…": "CAD-Kern (OpenCascade) wird geladen…",
  "Empty project: how to get started": "Leeres Projekt: so geht's los",
  "Hide start card": "Startkarte ausblenden",
  "Draw a sketch: {r} rectangle, {c} circle, or add a basic body on the left.":
    "Skizze zeichnen: {r} Rechteck, {c} Kreis, oder links einen Grundkörper einfügen.",
  "Extrude, then drag the arrows or type in the dimensions.": "Extrudieren, Maße an den Pfeilen ziehen oder eintippen.",
  "Round edges with {key}, combine parts, export as 3MF.": "Kanten runden mit {key}, Teile kombinieren, als 3MF exportieren.",

  // context bar
  Extrude: "Extrudieren",
  "Pull the sketch up into a body. Set the height in the panel on the right or with the arrow in the model":
    "Skizze zum Körper hochziehen. Höhe im Panel rechts oder am Pfeil im Modell",
  "As hole": "Als Loch",
  "Extrude as a hole (subtracted on union)": "Als Loch extrudieren (wird beim Vereinen abgezogen)",
  Delete: "Löschen",
  Duplicate: "Duplizieren",
  "Fillet or chamfer edges, push or tilt faces (or double-click the body)":
    "Kanten runden oder fasen, Flächen verschieben oder neigen (auch Doppelklick auf den Körper)",
  "Click a face that should rest on the bed": "Eine Fläche anklicken, die unten aufliegen soll",
  "Rotate 90° around the vertical axis": "90° um die Hochachse drehen",
  "Center on the print bed (on the grid), Shift+M: exact": "Mittig aufs Druckbett (im Raster), Shift+M: exakt",
  "Center all together on the print bed (on the grid), Shift+M: exact": "Gemeinsam mittig aufs Druckbett (im Raster), Shift+M: exakt",
  Solid: "Volumen",
  Hole: "Loch",
  "Make it a normal body again": "Wieder zum normalen Körper machen",
  "Make it a hole, subtracted on union": "Zum Loch machen, wird beim Vereinen abgezogen",

  // project bar
  "just now": "gerade eben",
  "{n} min ago": "vor {n} Min.",
  "{n} h ago": "vor {n} Std.",
  yesterday: "gestern",
  "Collapse project list": "Projektliste einklappen",
  "Expand project list": "Projektliste aufklappen",
  Projects: "Projekte",
  "{n} body · saved {when}": "{n} Körper · gespeichert {when}",
  "{n} bodies · saved {when}": "{n} Körper · gespeichert {when}",
  "{n} body · {when}": "{n} Körper · {when}",
  "{n} bodies · {when}": "{n} Körper · {when}",
  "Create a new project, the current one stays saved": "Neues Projekt anlegen, das aktuelle bleibt gespeichert",
  New: "Neu",
  "Create a new project": "Neues Projekt anlegen",
  "New project": "Neues Projekt",
  "no preview": "keine Vorschau",
  "Double-click to rename": "Doppelklick zum Umbenennen",

  // plane panel
  "top to bottom": "von oben nach unten",
  "front to back": "von vorne nach hinten",
  "back to front": "von hinten nach vorne",
  "left to right": "von links nach rechts",
  "right to left": "von rechts nach links",
  "View direction": "Blickrichtung",
  "Show preview": "Vorschau zeigen",
  "Collapse preview": "Vorschau einklappen",
  "Click: go to the 3D view · Hold the right mouse button in the model: orbit in 3D directly":
    "Klick: zur 3D-Ansicht · Rechte Maustaste im Modell halten: direkt in 3D drehen",
  "Click: 3D": "Klick: 3D",
  "Plane {axis} {value}": "Ebene {axis} {value}",
  "flush with {target}": "bündig mit {target}",
  "Sketch plane": "Skizzenebene",
  "Drag left/right to move the plane · snaps to faces · Alt: free · Mouse wheel: grid step":
    "Links/rechts ziehen verschiebt die Ebene · rastet an Flächen ein · Alt: frei · Mausrad: Rasterschritt",
  "flush: {target}": "bündig: {target}",
  drag: "ziehen",
  "Plane {axis}": "Ebene {axis}",
  "Exact position of the sketch plane": "Exakte Lage der Skizzenebene",
  "Click a face of a body, the sketch then lies exactly on it": "Fläche eines Körpers anklicken, die Skizze liegt dann genau darauf",
  "Put the plane exactly on a face": "Ebene genau an eine Fläche legen",
  "Flush with face …": "Bündig mit Fläche …",
  "Now click a flat face in the model · Esc cancels": "Klicke jetzt eine ebene Fläche im Modell an · Esc bricht ab",

  // fields
  "Drag to change (Shift ×10, Alt ×0.1)": "Ziehen zum Ändern (Shift ×10, Alt ×0,1)",

  // files
  project: "projekt",
  'Opened "{name}" as a project': "„{name}“ als Projekt geöffnet",
  "Could not read the file": "Datei konnte nicht gelesen werden",

  // drop target (App.tsx)
  "Drop file here": "Datei hier ablegen",
  "STEP (recommended), STL, 3MF or OBJ": "STEP (empfohlen), STL, 3MF oder OBJ",
};

export default de;
