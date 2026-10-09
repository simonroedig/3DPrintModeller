import type { EdgeFeature, Shape } from "../types";

/** Strips everything from a shape that does not influence its geometry. */
function geomShape(shape: Shape): unknown {
  if (shape.kind !== "group") return shape;
  return {
    kind: "group",
    children: shape.children.map((c) => ({
      s: geomShape(c.shape),
      f: geomFeatures(c.features),
      p: c.position,
      q: c.quaternion,
      h: c.hole,
    })),
  };
}

const geomFeatures = (features: EdgeFeature[]) => features.map((f) => [f.type, f.radius, f.edges]);

/** Key identifying the local geometry of a body (independent of its own placement). */
export function geometryKey(body: { shape: Shape; features: EdgeFeature[] }): string {
  return JSON.stringify([geomShape(body.shape), geomFeatures(body.features)]);
}
