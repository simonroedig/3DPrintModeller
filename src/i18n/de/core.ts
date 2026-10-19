/** German texts of the store, lib, viewport and CAD modules (English text → German text) */
const de: Record<string, string> = {
  /* ---- body kinds (KIND_LABEL) and combine operations (OP_NAME) ---- */
  Box: "Quader",
  Wedge: "Keil",
  Cylinder: "Zylinder",
  Cone: "Kegel",
  Sphere: "Kugel",
  Tube: "Rohr",
  Prism: "Prisma",
  Group: "Gruppe",
  Imported: "Import",
  // names of combined bodies ("Vereinigung 1"); the buttons say "Vereinen" etc.
  "name|Union": "Vereinigung",
  "name|Difference": "Differenz",
  "name|Intersection": "Schnittmenge",
  "name|Group": "Gruppe",
  Difference: "Differenz",
  Intersection: "Schnittmenge",
  Sketch: "Skizze",
  "Hole {name}": "Loch {name}",

  /* ---- store: sketches and editing ---- */
  "This face is slanted. Sketches go on faces that point up, to the front/back or to the side":
    "Diese Fläche ist schräg. Skizzen gehen auf Flächen, die nach oben, vorne/hinten oder zur Seite zeigen",
  "The face is not parallel to this sketch": "Die Fläche liegt nicht parallel zu dieser Skizze",
  "Sketch plane set to the face ({axis} = {value})": "Skizzenebene auf Fläche gesetzt ({axis} = {value})",
  "The sketch is too small to extrude": "Die Skizze ist zu klein zum Extrudieren",
  "Already exactly centered": "Liegt schon exakt mittig",
  "Already centered (on the grid)": "Liegt schon mittig (im Raster)",
  "First select the body to subtract from, then Shift+click the parts that should go":
    "Erst den Körper wählen, von dem abgezogen wird, dann mit Shift+Klick die Teile, die weg sollen",
  "Select at least two bodies (Shift + click)": "Wähle mindestens zwei Körper (Shift + Klick)",
  "Mesh bodies (large STL/3MF/OBJ) cannot be combined. Convert them to a CAD body in the panel first":
    "Mesh-Körper (große STL/3MF/OBJ) können nicht kombiniert werden. Erst im Panel in einen CAD-Körper umwandeln",
  "Subtracted from “{name}”. The subtracted parts are kept and can be changed in the panel":
    "Von „{name}“ abgezogen. Die abgezogenen Teile bleiben erhalten und sind im Panel änderbar",
  "The group's fillets were removed when splitting": "Rundungen der Gruppe wurden beim Trennen entfernt",
  "Only flat faces can be pushed or tilted": "Nur ebene Flächen lassen sich verschieben oder neigen",

  /* ---- examples ---- */
  "Left wedge": "Keil links",
  "Right wedge": "Keil rechts",
  "Back bar": "Steg hinten",
  "Base plate": "Grundplatte",
  Backrest: "Lehne",
  Lip: "Lippe",
  "Cable slot": "Kabelschlitz",
  "Cable channel": "Kabelkanal",
  "Phone stand": "Handyständer",
  "Speaker wedge": "Lautsprecher-Keil",

  /* ---- import ---- */
  "“{file}”: format not supported (STEP, STL, 3MF or OBJ)": "„{file}“: Format nicht unterstützt (STEP, STL, 3MF oder OBJ)",
  "Importing “{file}”…": "Importiere „{file}“ …",
  "Importing “{file}”: converting {n} triangles into CAD faces…": "Importiere „{file}“: {n} Dreiecke werden in CAD-Flächen umgewandelt …",
  "no solids found": "keine Volumenkörper gefunden",
  "“{file}” imported: 1 body": "„{file}“ importiert: 1 Körper",
  "“{file}” imported: {n} bodies": "„{file}“ importiert: {n} Körper",
  "as a mesh ({n} triangles): move, rotate, export. For edges/faces/combining, export with less resolution or as STEP":
    "als Mesh ({n} Dreiecke): verschieben, drehen, exportieren. Für Kanten/Flächen/Vereinen mit weniger Auflösung oder als STEP exportieren",
  "very small: maybe exported in meters/inches → adjust the scale in the panel":
    "sehr klein: evtl. in Metern/Zoll exportiert → Skalierung im Panel anpassen",
  "“{file}” could not be imported: {error}": "„{file}“ konnte nicht importiert werden: {error}",
  "Converting {n} triangles into CAD faces… (can be canceled at the bottom right)":
    "Wandle {n} Dreiecke in CAD-Flächen um … (unten rechts abbrechbar)",
  "Converted to CAD bodies. Edges, faces and combining are now possible": "In CAD-Körper umgewandelt. Kanten, Flächen und Vereinen sind jetzt möglich",
  "Conversion failed: {error}": "Umwandlung fehlgeschlagen: {error}",

  /* ---- projects ---- */
  Project: "Projekt",
  "My project": "Mein Projekt",
  "{name} (copy)": "{name} (Kopie)",
  "“{name}” created": "„{name}“ angelegt",
  "Delete project “{name}” permanently?": "Projekt „{name}“ endgültig löschen?",
  "Saving in the browser failed (storage full?)": "Speichern im Browser fehlgeschlagen (Speicher voll?)",
  "The project could not be loaded": "Projekt konnte nicht geladen werden",

  /* ---- sketch planes (ORIENT_LABEL), snap targets, view eye ---- */
  "Floor (XY)": "Boden (XY)",
  "Bottom (XY)": "Unten (XY)",
  "Front (XZ)": "Vorne (XZ)",
  "Back (XZ)": "Hinten (XZ)",
  "Right (YZ)": "Rechts (YZ)",
  "Left (YZ)": "Links (YZ)",
  "Print bed": "Druckbett",
  Origin: "Ursprung",
  top: "oben",
  bottom: "unten",
  front: "vorne",
  back: "hinten",
  right: "rechts",
  left: "links",
  Top: "Oben",
  Bottom: "Unten",
  Front: "Vorne",
  Back: "Hinten",
  Right: "Rechts",
  Left: "Links",

  /* ---- handles and dimensions ---- */
  Width: "Breite",
  Depth: "Tiefe",
  Height: "Höhe",
  "Height (bottom)": "Höhe (unten)",
  Diameter: "Durchmesser",
  "Ø bottom": "Ø unten",
  "Ø top": "Ø oben",
  // initials in front of sketch dimensions: Width, Depth, Height
  W: "B",
  D: "T",
  H: "H",
  "{label} (Shift: proportional)": "{label} (Shift: proportional)",
  "Click to type · drag left/right to change": "Klicken zum Eintippen · links/rechts ziehen zum Ändern",
  "Only directly editable with 90° rotations": "Nur bei 90°-Drehungen direkt editierbar",
  "Drag to extrude": "Ziehen zum Extrudieren",
  "Can't drag in this view. Use the 3D view or the panel": "In dieser Ansicht nicht ziehbar. Nutze die 3D-Ansicht oder das Panel",
  "A polygon needs at least 3 points": "Ein Polygon braucht mindestens 3 Punkte",
  "The polygon must not intersect itself": "Das Polygon darf sich nicht selbst schneiden",
  "Please click a flat face": "Bitte eine ebene Fläche anklicken",

  /* ---- edit mode ---- */
  Fillet: "Rundung",
  Chamfer: "Fase",
  "Drag out: fillet · drag in: chamfer": "Raus ziehen: Rundung · rein ziehen: Fase",
  "Drag: push face": "Ziehen: Fläche verschieben",
  "Up: add wedge · down: remove wedge": "Hoch: Keil hinzufügen · runter: Keil wegnehmen",
  "Angle {angle}° · Height {height}": "Winkel {angle}° · Höhe {height}",

  /* ---- CAD kernel messages (shown via tMsg) ---- */
  "Imported file is missing": "Importierte Datei fehlt",
  "Mesh bodies cannot be edited with CAD operations": "Mesh-Körper können nicht mit CAD-Operationen bearbeitet werden",
  "The parts do not overlap, the intersection is empty": "Die Teile überschneiden sich nicht, die Schnittmenge ist leer",
  "Push face: face no longer found": "Fläche verschieben: Fläche nicht mehr gefunden",
  "Face could not be pushed": "Fläche konnte nicht verschoben werden",
  "Tilt face: face or hinge edge no longer found": "Neigen: Fläche oder Drehkante nicht mehr gefunden",
  "Face could not be tilted": "Fläche konnte nicht geneigt werden",
  "Mesh bodies (large STL/3MF/OBJ) cannot be exported as STEP": "Mesh-Körper (große STL/3MF/OBJ) lassen sich nicht als STEP exportieren",
  "Nothing to export": "Nichts zu exportieren",
  "No triangles": "Keine Dreiecke",
  "The mesh is not closed, so it is not a solid": "Das Netz ist nicht geschlossen, kein Volumenkörper",
  "The STEP file could not be read": "STEP-Datei konnte nicht gelesen werden",
  "No 3D data in the 3MF file": "Keine 3D-Daten in der 3MF-Datei",
  "The file contains no triangles": "Die Datei enthält keine Dreiecke",
  Canceled: "Abgebrochen",
  "Calculation canceled": "Berechnung abgebrochen",
  "Export failed": "Export fehlgeschlagen",
  "Import failed": "Import fehlgeschlagen",
};

export default de;
