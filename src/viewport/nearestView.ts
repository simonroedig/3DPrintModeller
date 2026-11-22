import { create } from "zustand";
import type { View } from "../store/store";

/**
 * While orbiting in 3D: the 2D view the camera is closest to, so the view switcher can point at the
 * button that snaps there (kept apart from the main store, it changes on every orbit frame).
 */
export const useNearestView = create<{ near: View | null }>(() => ({ near: null }));
