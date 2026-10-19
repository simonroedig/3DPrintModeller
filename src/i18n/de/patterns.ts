/**
 * German versions of runtime messages with values in them (mostly from the CAD worker).
 * `$1`, `$2`… are the capture groups; each captured value is looked up in the dictionary first
 * ("Fillet" → "Rundung"), numbers stay as they are.
 */
export const patterns: [RegExp, string][] = [
  [/^(Fillet|Chamfer): edge no longer found$/, "$1: Kante nicht mehr gefunden"],
  [/^(Fillet|Chamfer) ([\d.]+) mm does not fit: radius too large for these edges$/, "$1 $2 mm passt nicht: Radius zu groß für diese Kante(n)"],
];
