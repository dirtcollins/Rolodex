"use client";
import { useEffect } from "react";

/** A date or time field opens its picker from a click anywhere on it, not only on the little calendar icon. */
export function OpenPickers() {
  useEffect(() => {
    const open = (e: MouseEvent) => {
      const el = e.target as HTMLInputElement | null;
      if (el?.matches?.("input[type=date],input[type=time],input[type=datetime-local],input[type=month]") && !el.disabled && !el.readOnly) {
        try { el.showPicker(); } catch { /* already open, or the browser can't */ }
      }
    };
    document.addEventListener("click", open);
    return () => document.removeEventListener("click", open);
  }, []);
  return null;
}
