/** German texts for the properties panel (src/ui/Sidebar.tsx) */
const de: Record<string, string> = {
  // scene tree
  Objects: "Objekte",
  "Nothing here yet. Draw a sketch or add a body.": "Noch nichts da. Zeichne eine Skizze oder füge einen Körper ein.",
  Hole: "Loch",
  Solid: "Volumen",
  Show: "Einblenden",
  Hide: "Ausblenden",
  Sketch: "Skizze",

  // features
  Fillet: "Rundung",
  Chamfer: "Fase",
  "Face offset": "Fläche versetzt",
  "Face tilt": "Fläche geneigt",

  // body
  "Geometry error: {error}": "Geometriefehler: {error}",
  "{count} parts": "{count} Teile",
  "Normal, printed body": "Normaler, gedruckter Körper",
  "Subtracted on union/export": "Wird beim Vereinen/Export abgezogen",
  Dimensions: "Abmessungen",
  Position: "Position",
  "Bottom to Z = 0": "Unterkante auf Z = 0",
  "Drop to bed": "Aufs Bett",
  "Left edge (bounding box)": "Linke Kante (Bounding Box)",
  "Front edge (bounding box)": "Vordere Kante (Bounding Box)",
  "Bottom edge (bounding box)": "Unterkante (Bounding Box)",
  "Overall size: {x} × {y} × {z}": "Größe gesamt: {x} × {y} × {z}",
  Rotation: "Drehung",
  "Lay a face flat…": "Fläche aufs Bett legen…",
  Edits: "Bearbeitungen",
  "Edges & Faces": "Kanten & Flächen",
  "None yet. Press {key} (or double-click the body) to fillet or chamfer edges and to move or tilt faces.":
    "Noch keine. Mit {key} (oder Doppelklick auf den Körper) Kanten runden/fasen sowie Flächen verschieben oder neigen.",
  "Positive = outward, negative = inward": "Positiv = nach außen, negativ = nach innen",
  Remove: "Entfernen",
  Actions: "Aktionen",
  Duplicate: "Duplizieren",
  Delete: "Löschen",
  Ungroup: "Gruppe trennen",

  // centering and rotating
  Center: "Zentrieren",
  "Center on the print bed (X and Y, the height stays), in whole grid steps so everything stays on the grid (M)":
    "Mittig aufs Druckbett (X und Y, die Höhe bleibt), in ganzen Rasterschritten, damit alles im Raster bleibt (M)",
  "Exactly centered, even if it is then no longer exactly on the grid (Shift+M)":
    "Exakt mittig, auch wenn es dann nicht mehr genau im Raster liegt (Shift+M)",
  exactly: "exakt",
  "-90° around {axis}": "-90° um {axis}",
  "+90° around {axis}": "+90° um {axis}",

  // shape parameters
  W: "B",
  D: "T",
  H: "H",
  Width: "Breite",
  Depth: "Tiefe",
  Height: "Höhe",
  "Width (X)": "Breite (X)",
  "Depth (Y)": "Tiefe (Y)",
  "Height (Z)": "Höhe (Z)",
  "Depth / ramp length (Y)": "Tiefe / Länge der Rampe (Y)",
  "Height at the high end (Z)": "Höhe am hohen Ende (Z)",
  Angle: "Winkel",
  "Angle changes the height, depth stays": "Winkel ändert die Höhe, Tiefe bleibt",
  Diameter: "Durchmesser",
  "Bottom diameter": "Durchmesser unten",
  "Top diameter": "Durchmesser oben",
  "Outer diameter": "Außendurchmesser",
  "Wall thickness": "Wandstärke",

  // imported files
  "Resizes proportionally": "Ändert die Größe proportional",
  Factor: "Faktor",
  "File was in cm": "Datei war in cm",
  "File was in inches": "Datei war in Zoll",
  File: "Datei",
  'From "{name}" (STEP): exact CAD geometry.': "Aus „{name}“ (STEP): exakte CAD-Geometrie.",
  'From "{name}" as a mesh ({tris} triangles): move, rotate, lay flat and export. Convert to a CAD body for edges, faces, holes and union.':
    "Aus „{name}“ als Mesh ({tris} Dreiecke): verschieben, drehen, aufs Bett legen und exportieren. Für Kanten, Flächen, Löcher und Vereinen in einen CAD-Körper umwandeln.",
  'From "{name}" ({format}): flat faces were merged into CAD faces, curves stay faceted.':
    "Aus „{name}“ ({format}): ebene Flächen wurden zu CAD-Flächen zusammengefasst, Rundungen bleiben facettiert.",
  "Convert to CAD body": "In CAD-Körper umwandeln",
  "may take minutes": "kann Minuten dauern",

  // group size
  "{dim}: scales all parts in this direction": "{dim}: skaliert alle Teile in dieser Richtung",
  Scale: "Skalieren",
  "Scale everything proportionally (stays centered on the bed)": "Alles proportional skalieren (bleibt mittig auf dem Bett)",
  Apply: "Anwenden",
  "Dragging the handles scales too · with Shift proportionally.": "Ziehen an den Griffen skaliert ebenfalls · mit Shift proportional.",

  // group parts
  Base: "Basis",
  subtracted: "wird abgezogen",
  "Parts & Operation": "Teile & Verknüpfung",
  "Position inside the rotated body": "Position innerhalb des gedrehten Körpers",
  "Position (bottom / left / front edge)": "Position (Unterkante / linke / vordere Kante)",
  "This part becomes the base, everything else is subtracted from it": "Dieses Teil wird zur Basis, alles andere wird davon abgezogen",
  "Set as base": "Als Basis",
  "Set as solid": "Als Volumen",
  "Set as hole": "Als Loch",
  "Take out of the body, stays in place": "Aus dem Körper herauslösen, bleibt an seinem Platz",
  Extract: "Herauslösen",
  "Subtracted parts are invisible but still there: expand a part to edit it, it is shown in orange in the model.":
    "Die abgezogenen Teile sind unsichtbar, aber da: Teil aufklappen zum Ändern, es wird im Modell orange angezeigt.",
  "Only what all parts have in common remains.": "Übrig bleibt nur, was alle Teile gemeinsam haben.",
  "Parts stay separate solids and move together.": "Teile bleiben getrennte Volumen und bewegen sich gemeinsam.",
  "Parts are merged into one body; holes are subtracted.": "Teile sind zu einem Körper verschmolzen; Löcher werden abgezogen.",

  // multiple selection
  "{axis}: align start": "{axis}: Anfang bündig",
  "{axis}: align center": "{axis}: Mitte bündig",
  "{axis}: align end": "{axis}: Ende bündig",
  "{count} bodies selected": "{count} Körper ausgewählt",
  "Order matters when subtracting: {base} is the base.": "Reihenfolge zählt beim Abziehen: {base} ist die Basis.",
  "Order matters when subtracting: {base} is the base, {rest} is subtracted.":
    "Reihenfolge zählt beim Abziehen: {base} ist die Basis, {rest} wird abgezogen.",
  "Order matters when subtracting: {base} is the base, {rest} are subtracted.":
    "Reihenfolge zählt beim Abziehen: {base} ist die Basis, {rest} werden abgezogen.",
  "Nothing gets lost: all parts stay in the result and remain editable.":
    "Nichts geht verloren: alle Teile bleiben im Ergebnis erhalten und änderbar.",
  Align: "Ausrichten",
  "Position (together)": "Position (gemeinsam)",
  "Drop all to bed": "Alle aufs Bett",
  "Center together": "Gemeinsam zentrieren",
  "Rotate (together)": "Drehen (gemeinsam)",

  // sketch
  Rectangle: "Rechteck",
  Circle: "Kreis",
  Polygon: "Polygon",
  Left: "Links",
  Bottom: "Unten",
  "Left edge (in the sketch plane)": "Linke Kante (in der Skizzenebene)",
  "Front edge": "Vordere Kante",
  "Bottom edge (in the sketch plane)": "Untere Kante (in der Skizzenebene)",
  "Center: {x} / {y}": "Mitte: {x} / {y}",
  "Center {axis}": "Mitte {axis}",
  "{count} points · Area {area}": "{count} Punkte · Fläche {area}",
  "Plane {axis}": "Ebene {axis}",
  "Position of the sketch plane (can also be dragged in the plane preview at the top right)":
    "Lage der Skizzenebene (auch oben rechts in der Ebenen-Vorschau ziehbar)",
  "Extrude → 3D": "Extrudieren → 3D",
  Extrude: "Extrudieren",
  "As hole": "Als Loch",
  "Tip: in the 3D view you can also drag the arrow.": "Tipp: In der 3D-Ansicht kannst du auch am Pfeil ziehen.",
  "Or drag the arrow in the view.": "Oder am Pfeil in der Ansicht ziehen.",
  "A negative height extrudes in the opposite direction.": "Negative Höhe extrudiert in die Gegenrichtung.",
  "Delete sketch": "Skizze löschen",

  // project
  Project: "Projekt",
  "1 body · nothing selected": "1 Körper · nichts ausgewählt",
  "{count} bodies · nothing selected": "{count} Körper · nichts ausgewählt",
  "Grid & Units": "Raster & Einheit",
  "Everything snaps to this grid. Hold {key} while dragging for free values.":
    "Alles rastet auf dieses Raster. Beim Ziehen {key} halten für freie Werte.",
  "Print bed": "Druckbett",
  show: "anzeigen",
  "Show or hide the print bed in the model": "Druckbett im Modell ein- oder ausblenden",
  "Center all": "Alles zentrieren",
  "How it works": "So geht's",
  "Draw a sketch ({r}/{c}/{p}), adjust dimensions right in the panel or on the label.":
    "Skizze zeichnen ({r}/{c}/{p}), Maße direkt im Panel oder am Label anpassen.",
  "Extrude: enter a height or drag the arrow.": "Extrudieren: Höhe eingeben oder am Pfeil ziehen.",
  "Drag parts against each other, they snap to faces (pink lines).": "Teile aneinander ziehen, sie rasten an Flächen ein (pinke Linien).",
  "Select several and unite them ({ctrl}+{g}).": "Mehrere wählen und vereinen ({ctrl}+{g}).",
  Ctrl: "Strg",
  "Fillet edges ({key}): click an edge, drag the arrow.": "Kanten runden ({key}): Kante klicken, Pfeil ziehen.",
  "Export as 3MF or STL.": "Exportieren als 3MF oder STL.",
};

export default de;
