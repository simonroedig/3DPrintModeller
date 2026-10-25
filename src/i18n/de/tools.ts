/** German texts for patterns (src/lib/pattern.ts and its panel) and the line tool */
const de: Record<string, string> = {
  // patterns: store and toasts
  "Select one body to repeat. To repeat several, combine them first":
    "Wähle einen Körper zum Wiederholen. Um mehrere zu wiederholen, kombiniere sie vorher",
  "Mesh bodies (large STL/3MF/OBJ) cannot be repeated. Convert them to a CAD body in the panel first":
    "Netzkörper (große STL/3MF/OBJ) lassen sich nicht wiederholen. Wandle sie vorher im Panel in einen CAD-Körper um",
  "name|Pattern": "Muster",
  "Pattern created. Set the count and spacing in the panel on the right": "Muster erstellt. Anzahl und Abstand stellst du rechts im Panel ein",

  // patterns: tool rail and context bar
  Pattern: "Muster",
  "Select one body first": "Erst einen Körper auswählen",
  "Linear pattern: repeat the selected body in a row or grid, with a set spacing":
    "Lineares Muster: den gewählten Körper in einer Reihe oder als Raster wiederholen, mit festem Abstand",
  "Circular pattern: repeat the selected body around a center": "Kreismuster: den gewählten Körper um einen Mittelpunkt wiederholen",
  "Pattern · {count}": "Muster · {count}",
  "Switch between a row and a circle. Count and spacing are in the panel on the right":
    "Zwischen Reihe und Kreis wechseln. Anzahl und Abstand stehen rechts im Panel",
  "Repeat this body: in a row, as a grid or around a center": "Diesen Körper wiederholen: in einer Reihe, als Raster oder im Kreis",
  Linear: "Linear",
  Circular: "Kreis",
  "In a row or as a grid, with a set spacing": "In einer Reihe oder als Raster, mit festem Abstand",
  "Around a center, like holes on a flange": "Um einen Mittelpunkt, wie Löcher auf einem Flansch",
  "Linear pattern": "Lineares Muster",
  "Circular pattern": "Kreismuster",

  // patterns: panel
  "Repeat this body in a row or grid, with a set spacing": "Diesen Körper in einer Reihe oder als Raster wiederholen, mit festem Abstand",
  "Repeat this body around a center": "Diesen Körper um einen Mittelpunkt wiederholen",
  "Every copy becomes a body of its own (the pattern values are gone then)": "Jede Kopie wird ein eigener Körper (die Musterwerte gehen dabei verloren)",
  "Split into single bodies": "In einzelne Körper auflösen",
  Count: "Anzahl",
  "Number of parts, the original included": "Anzahl der Teile, das Original mitgezählt",
  Direction: "Richtung",
  "The copies are lined up along this axis": "Die Kopien reihen sich entlang dieser Achse auf",
  Measure: "Maß",
  "Center to center": "Mitte zu Mitte",
  "Distance from the middle of one part to the middle of the next": "Abstand von der Mitte eines Teils zur Mitte des nächsten",
  Gap: "Lücke",
  "Free space between two parts": "Freier Raum zwischen zwei Teilen",
  Spacing: "Abstand",
  "Distance from the middle of one part to the middle of the next (negative: the other way)":
    "Abstand von der Mitte eines Teils zur Mitte des nächsten (negativ: in die andere Richtung)",
  Grid: "Raster",
  "second direction": "zweite Richtung",
  "Repeat the whole row once more in a second direction, for a grid": "Die ganze Reihe noch einmal in eine zweite Richtung wiederholen, für ein Raster",
  Rows: "Reihen",
  "Number of rows, the first included": "Anzahl der Reihen, die erste mitgezählt",
  "The rows are lined up along this axis": "Die Reihen liegen entlang dieser Achse",
  "Free space between two rows": "Freier Raum zwischen zwei Reihen",
  "Distance between the middles of two rows": "Abstand zwischen den Mitten zweier Reihen",
  "From the center of the circle to the middle of each part": "Vom Mittelpunkt des Kreises bis zur Mitte jedes Teils",
  "Center to center distance between neighbours; changes the radius": "Abstand Mitte zu Mitte zwischen Nachbarn; ändert den Radius",
  Angle: "Winkel",
  "360° spreads the parts evenly around the circle, less gives an arc": "360° verteilt die Teile gleichmäßig im Kreis, weniger ergibt einen Bogen",
  Axis: "Achse",
  "The parts turn around this axis (Z: flat on the bed)": "Die Teile drehen sich um diese Achse (Z: flach auf dem Bett)",
  Orientation: "Ausrichtung",
  "turn with the circle": "mit dem Kreis drehen",
  "On: every copy turns like a spoke. Off: all copies keep the direction of the original":
    "An: jede Kopie dreht sich wie eine Speiche. Aus: alle Kopien behalten die Richtung des Originals",
  "{n} parts, {cc} apart (center to center).": "{n} Teile, {cc} Abstand (Mitte zu Mitte).",
  "{n} parts on a circle of {d} diameter.": "{n} Teile auf einem Kreis mit {d} Durchmesser.",
  "Changes to the original below apply to every copy.": "Änderungen am Original unten gelten für jede Kopie.",
  "Center the pattern": "Muster zentrieren",
  "Center the circle": "Kreis zentrieren",
  Original: "Original",
  "orange in the model": "orange im Modell",

  // line tool
  "Line: click points and close the shape, for any outline": "Linie: Punkte klicken und die Form schließen, für beliebige Umrisse",
  "Sketch · Line": "Skizze · Linie",
  "Click points · type a length + Enter for an exact segment · click the start point to close":
    "Punkte klicken · Länge tippen + Enter für ein genaues Stück · Klick auf den Startpunkt schließt",
  "Click to place points · Type a length + Enter (30<45: at 45°) · Shift: 15° steps · Click the start point / Enter: close · Backspace: undo point":
    "Klicken setzt Punkte · Länge tippen + Enter (30<45: unter 45°) · Shift: 15°-Schritte · Klick auf den Startpunkt / Enter: schließen · Rücktaste: Punkt zurück",
  "A closed shape needs at least 3 points": "Eine geschlossene Form braucht mindestens 3 Punkte",
  "The lines must not cross each other": "Die Linien dürfen sich nicht kreuzen",
  "Type a length, for example 20, or 30<45 for 30 at 45°": "Tippe eine Länge, zum Beispiel 20, oder 30<45 für 30 unter 45°",
  "Close shape": "Form schließen",
  "Line shape": "Linienform",
  "Sketch a rectangle / circle / line shape in the plane of the current view (3D: ground plane)":
    "Rechteck / Kreis / Linienform in der Ebene der aktuellen Ansicht skizzieren (3D: Bodenebene)",
  "Line tool: type a number": "Linie: Zahl tippen",
  "Exact length of the next segment, Enter places it (30<45: 30 at 45°)": "Genaue Länge des nächsten Stücks, Enter setzt es (30<45: 30 unter 45°)",
};

export default de;
