export type MenuAnchorRect = { left: number; right: number; top: number; bottom: number; width: number };
export type MenuViewport = { left: number; top: number; width: number; height: number };
export type MenuPosition = { left: number; top: number; width: number; maxHeight: number; placement: "above" | "below" };

/** Coordinates share getBoundingClientRect's layout-viewport coordinate space, including visual viewport offsets. */
export function computeMenuPosition(anchor: MenuAnchorRect, menu: { width: number; height: number }, viewport: MenuViewport,
  options: { matchWidth?: boolean; minWidth?: number; gap?: number; padding?: number; maxHeight?: number } = {}): MenuPosition {
  const gap = options.gap ?? 6, padding = options.padding ?? 8;
  const leftEdge = viewport.left + padding, topEdge = viewport.top + padding;
  const rightEdge = Math.max(leftEdge, viewport.left + viewport.width - padding);
  const bottomEdge = Math.max(topEdge, viewport.top + viewport.height - padding);
  const usableWidth = rightEdge - leftEdge, usableHeight = bottomEdge - topEdge;
  const desiredWidth = options.matchWidth === false ? menu.width : anchor.width;
  const width = Math.max(0, Math.min(usableWidth, Math.max(options.minWidth ?? 0, desiredWidth)));
  const desiredHeight = Math.max(0, Math.min(options.maxHeight ?? 320, menu.height));
  const below = Math.max(0, bottomEdge - anchor.bottom - gap), above = Math.max(0, anchor.top - gap - topEdge);
  const placement = desiredHeight <= below || below >= above ? "below" : "above";
  const maxHeight = Math.max(0, Math.min(options.maxHeight ?? 320, usableHeight, placement === "below" ? below : above));
  const height = Math.min(desiredHeight, maxHeight);
  const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(value, Math.max(low, high)));
  return { left: clamp(anchor.left, leftEdge, rightEdge - width),
    top: clamp(placement === "below" ? anchor.bottom + gap : anchor.top - gap - height, topEdge, bottomEdge - height),
    width, maxHeight, placement };
}
