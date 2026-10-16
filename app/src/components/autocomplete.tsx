"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AnchoredMenu } from "./anchored-menu";
import { autocompleteKey, autocompleteSuggestions, completeSuggestion } from "./autocomplete-values";
import { Icon } from "./icons";
import "./autocomplete.css";

type Props = {
  value: string; onChange: (value: string) => void; options: string[];
  label?: string; "aria-label"?: string; id?: string; placeholder?: string; name?: string;
  className?: string; autoFocus?: boolean; commaSeparated?: boolean; icon?: string;
};

/** An editable combobox: picking a suggestion is optional and never restricts a custom value. */
export function Autocomplete({ value, onChange, options, label, "aria-label": ariaLabel, id, placeholder, name, className = "in", autoFocus, commaSeparated = name === "tags", icon = "search" }: Props) {
  const generated = useId(), listId = generated + "-suggestions";
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false), [active, setActive] = useState(-1), [caret, setCaret] = useState(value.length);
  const matches = useMemo(() => autocompleteSuggestions(options, value, caret, commaSeparated), [options, value, caret, commaSeparated]);
  const activeId = active >= 0 && active < matches.length ? listId + "-" + active : undefined;
  useEffect(() => {
    if (open && activeId) document.getElementById(activeId)?.scrollIntoView({ block: "nearest" });
  }, [open, activeId]);
  const choose = (suggestion: string) => {
    const next = completeSuggestion(value, input.current?.selectionStart ?? caret, suggestion, commaSeparated);
    onChange(next.value); setCaret(next.caret); setOpen(false); setActive(-1);
    input.current?.dispatchEvent(new Event("rx-draft-change", { bubbles: true }));
    requestAnimationFrame(() => { input.current?.focus(); input.current?.setSelectionRange(next.caret, next.caret); });
  };
  return <div className="autocomplete-field">
    <input ref={input} id={id} className={className} name={name} value={value} placeholder={placeholder} autoFocus={autoFocus} autoComplete="off"
      role="combobox" aria-label={ariaLabel ?? label} aria-autocomplete="list" aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined} aria-activedescendant={open ? activeId : undefined}
      onFocus={event => { setCaret(event.currentTarget.selectionStart ?? value.length); setOpen(true); setActive(-1); }}
      onClick={event => { setCaret(event.currentTarget.selectionStart ?? value.length); setOpen(true); }}
      onSelect={event => { const next = event.currentTarget.selectionStart ?? value.length; if (next !== caret) setActive(-1); setCaret(next); }}
      onBlur={() => { setOpen(false); setActive(-1); }}
      onChange={event => { onChange(event.currentTarget.value); setCaret(event.currentTarget.selectionStart ?? event.currentTarget.value.length); setOpen(true); setActive(-1); }}
      onKeyDown={event => {
        if (event.nativeEvent.isComposing) return;
        const action = autocompleteKey(event.key, active, matches.length, open);
        if (action?.kind === "move") { event.preventDefault(); setOpen(true); setActive(action.index); }
        else if (action?.kind === "choose") { event.preventDefault(); choose(matches[action.index]); }
        else if (action?.kind === "close") {
          if (action.prevent) { event.preventDefault(); event.stopPropagation(); }
          setOpen(false); setActive(-1);
        }
      }} />
    {open && <AnchoredMenu anchor={input.current} onClose={() => { setOpen(false); setActive(-1); }} role="listbox" id={listId} ariaLabel={(ariaLabel ?? label ?? name ?? "Field") + " suggestions"} className="autocomplete-menu">
      {matches.length ? matches.map((option, index) => <div key={option} id={listId + "-" + index} role="option" aria-selected={index === active}
        className={"autocomplete-option" + (index === active ? " is-active" : "")}
        onPointerDown={event => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => choose(option)}><Icon name={icon} /><span>{option}</span></div>)
        : <div className="autocomplete-empty">No matching suggestions. You can keep what you typed.</div>}
    </AnchoredMenu>}
  </div>;
}
