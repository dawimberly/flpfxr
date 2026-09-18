import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/input";
import {
  suggestHouseAddresses,
  suggestionLabel,
  type AddressSuggestion,
} from "@/lib/roof-geocode";
import { cn } from "@/lib/utils";

const DEBOUNCE_MS = 280;

export function AddressSuggestField({
  id,
  value,
  onChange,
  onPick,
  disabled,
  placeholder,
  className,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onPick: (label: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const skipSuggest = useRef(false);
  const blurTimer = useRef<number>(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AddressSuggestion[]>([]);
  const [active, setActive] = useState(0);
  const [box, setBox] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    if (skipSuggest.current) {
      skipSuggest.current = false;
      return;
    }
    const q = value.trim();
    if (q.length < 5) {
      setItems([]);
      setOpen(false);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        const next = await suggestHouseAddresses(q);
        if (cancelled) return;
        setItems(next);
        setActive(0);
        setOpen(next.length > 0);
      })();
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const el = inputRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setBox({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, items.length]);

  function pick(text: string) {
    const label = suggestionLabel(text);
    skipSuggest.current = true;
    setOpen(false);
    setItems([]);
    onChange(label);
    onPick(label);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || !items.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((n) => (n + 1) % items.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((n) => (n - 1 + items.length) % items.length);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const row = items[active];
      if (row) pick(row.text);
    }
  }

  const list =
    open && items.length && box && typeof document !== "undefined"
      ? createPortal(
          <ul
            id={listId}
            role="listbox"
            className="fixed z-[100] max-h-64 overflow-auto rounded-lg bg-surface py-1 text-sm shadow-[var(--shadow-border)]"
            style={{ top: box.top, left: box.left, width: box.width }}
          >
            {items.map((row, index) => (
              <li key={row.magicKey || row.text} role="presentation">
                <button
                  id={`${listId}-${index}`}
                  type="button"
                  role="option"
                  aria-selected={index === active}
                  className={cn(
                    "block w-full px-3 py-2 text-left text-fg",
                    index === active ? "bg-bg" : "hover:bg-bg",
                  )}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => pick(row.text)}
                >
                  {suggestionLabel(row.text)}
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )
      : null;

  return (
    <div className={cn("relative z-50 min-w-0 flex-1", className)}>
      <Input
        ref={inputRef}
        id={id}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        aria-label={id ? undefined : "Street address"}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => {
          if (items.length) setOpen(true);
        }}
        onBlur={() => {
          window.clearTimeout(blurTimer.current);
          blurTimer.current = window.setTimeout(() => setOpen(false), 120);
        }}
      />
      {list}
    </div>
  );
}
