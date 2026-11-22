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
  // centring, center lines, moving with the arrows
  "Centered on “{name}”": "Auf „{name}“ zentriert",
  "Exactly in the middle of the print bed (Shift+M: in whole grid steps)": "Exakt in die Mitte des Druckbetts (Shift+M: in ganzen Rasterschritten)",
  "All together exactly in the middle of the print bed (Shift+M: in whole grid steps)":
    "Alle zusammen exakt in die Mitte des Druckbetts (Shift+M: in ganzen Rasterschritten)",
  "Align centers": "Mitten ausrichten",
  "Align centers on {name}": "Mitten auf {name} ausrichten",
  "Put the middles of all on the middle of the body picked first (X and Y), e.g. to stack cylinders exactly":
    "Die Mitten aller auf die Mitte des zuerst gewählten Körpers legen (X und Y), z. B. um Zylinder genau übereinander zu stapeln",
  "Exactly in the middle of the print bed (X and Y, the height stays), even between grid lines (M)":
    "Exakt in die Mitte des Druckbetts (X und Y, die Höhe bleibt), auch zwischen den Rasterlinien (M)",
  "Only move in whole grid steps, so a part on the grid stays on it. The middle can then be half a step off (Shift+M)":
    "Nur in ganzen Rasterschritten verschieben, damit ein Teil auf dem Raster bleibt. Die Mitte kann dann einen halben Schritt daneben liegen (Shift+M)",
  "on grid": "auf Raster",
  "Center the selection (or everything, if nothing is selected) exactly on the bed / in whole grid steps":
    "Auswahl (oder alles, wenn nichts ausgewählt ist) exakt auf dem Bett zentrieren / in ganzen Rasterschritten",
  "Center lines": "Mittellinien",
  "Center lines: always show the middle of the bed, also through bodies, and mark the middle of the selection":
    "Mittellinien: die Mitte des Betts immer zeigen, auch durch Körper hindurch, und die Mitte der Auswahl markieren",
  "Move {axis}": "Verschieben {axis}",
  "{label} · Shift: move": "{label} · Shift: verschieben",
  "{label} · Shift: move · Ctrl: proportional": "{label} · Shift: verschieben · Strg: proportional",
  "Dragging the arrows scales too · with Ctrl proportionally · with Shift they move.":
    "Ziehen an den Pfeilen skaliert auch · mit Strg proportional · mit Shift verschieben sie.",
  "Shift + drag an arrow": "Shift + Pfeil ziehen",
  "Move the body along that arrow instead of changing its size": "Den Körper entlang des Pfeils verschieben, statt seine Größe zu ändern",
  "Ctrl + drag an arrow": "Strg + Pfeil ziehen",
  "Scale combined bodies proportionally": "Kombinierte Körper proportional skalieren",

  // circle segments
  Segment: "Segment",
  from: "ab",
  "{angle}° segment": "{angle}°-Segment",
  "Circle segment": "Kreissegment",
  "Only this part of the circle, e.g. 45° for a slice. 360° = the full circle":
    "Nur dieser Teil des Kreises, z. B. 45° für ein Tortenstück. 360° = der ganze Kreis",
  "Where the segment starts: 0° points along +X, angles go counter-clockwise seen from above":
    "Wo das Segment beginnt: 0° zeigt entlang +X, Winkel laufen von oben gesehen gegen den Uhrzeigersinn",
  "The full circle": "Der ganze Kreis",
  "1/{n} of the circle": "1/{n} des Kreises",
  Full: "Ganz",

  // copy and paste
  "Duplicate (exactly in the same place, in a new color)": "Duplizieren (genau an derselben Stelle, in neuer Farbe)",
  "Copy / Paste (exactly in the same place, in a new color)": "Kopieren / Einfügen (genau an derselben Stelle, in neuer Farbe)",
  "Copy in the same place, in a new color. Drag it where you want it":
    "Kopie an derselben Stelle, in neuer Farbe. Zieh sie dorthin, wo du sie haben willst",

  // centring buttons, X-ray
  "Center exactly": "Exakt zentrieren",
  "In grid steps": "In Rasterschritten",
  "X-ray": "Röntgen",
  "X-ray: see through all bodies, so parts inside or behind others stay visible":
    "Röntgenblick: durch alle Körper hindurchsehen, damit Teile innen oder dahinter sichtbar bleiben",
};

export default de;
