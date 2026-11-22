import { create } from "zustand";

/** modifier keys held right now (so handles can show what a drag would do) */
export const useKeys = create<{ shift: boolean }>(() => ({ shift: false }));

const track = (e: KeyboardEvent | PointerEvent) => {
  if (e.shiftKey !== useKeys.getState().shift) useKeys.setState({ shift: e.shiftKey });
};
window.addEventListener("keydown", track, true);
window.addEventListener("keyup", track, true);
window.addEventListener("pointermove", track, true);
window.addEventListener("blur", () => useKeys.setState({ shift: false }));
