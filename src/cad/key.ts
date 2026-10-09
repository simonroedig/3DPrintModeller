import type { Feature, Shape } from "../types";

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

// feature ids do not influence geometry (so a preview and the applied feature share one mesh)
const geomFeatures = (features: Feature[]) => features.map(({ id: _id, ...rest }) => rest);

/** Key identifying the local geometry of a body (independent of its own placement). */
export function geometryKey(body: { shape: Shape; features: Feature[] }): string {
  return JSON.stringify([geomShape(body.shape), geomFeatures(body.features)]);
}
