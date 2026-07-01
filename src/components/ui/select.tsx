"use client";

import {
  Children,
  forwardRef,
  isValidElement,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type SelectOption = {
  disabled?: boolean;
  label: string;
  value: string;
};

function normalizeChildren(children: SelectHTMLAttributes<HTMLSelectElement>["children"]) {
  return Children.toArray(children)
    .filter(isValidElement)
    .map((child) => child as ReactElement<{ value?: string | number; disabled?: boolean; children?: ReactNode }>)
    .map((child) => ({
      value: String(child.props.value ?? ""),
      label: Children.toArray(child.props.children).join(""),
      disabled: child.props.disabled,
    }));
}

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, value, defaultValue, onChange, disabled, name, ...props }, ref) => {
    const options = useMemo(() => normalizeChildren(children), [children]);
    const [open, setOpen] = useState(false);
    const [menuPosition, setMenuPosition] = useState({
      left: 0,
      top: 0,
      width: 180,
      maxHeight: 288,
    });
    const shellRef = useRef<HTMLDivElement | null>(null);
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const menuRef = useRef<HTMLDivElement | null>(null);
    const hiddenSelectRef = useRef<HTMLSelectElement | null>(null);

    const selectedValue = String(value ?? defaultValue ?? options[0]?.value ?? "");
    const selectedOption = options.find((option) => option.value === selectedValue) ?? options[0];

    const updateMenuPlacement = (actualHeight?: number) => {
      if (!triggerRef.current || typeof window === "undefined") return;

      const rect = triggerRef.current.getBoundingClientRect();
      const viewportPadding = 16;
      const gap = 10;
      const panelWidth = Math.max(rect.width, 180);
      const spaceBelow = window.innerHeight - rect.bottom - viewportPadding - gap;
      const spaceAbove = rect.top - viewportPadding - gap;
      const spaceRight = window.innerWidth - rect.right - viewportPadding - gap;
      const spaceLeft = rect.left - viewportPadding - gap;
      const openBeside = Math.max(spaceBelow, spaceAbove) < 180 && Math.max(spaceRight, spaceLeft) >= panelWidth;
      const openRight = openBeside && spaceRight >= panelWidth;
      const openLeft = openBeside && !openRight;
      const maxHeight = openBeside
        ? Math.max(window.innerHeight - viewportPadding * 2, 180)
        : Math.max(spaceBelow >= spaceAbove ? spaceBelow : spaceAbove, 180);
      const measuredHeight = actualHeight ?? Math.min(maxHeight, 320);
      const top = openBeside
        ? Math.min(
            Math.max(rect.top + rect.height / 2 - measuredHeight / 2, viewportPadding),
            window.innerHeight - viewportPadding - measuredHeight
          )
        : spaceBelow >= spaceAbove
          ? Math.min(rect.bottom + gap, window.innerHeight - viewportPadding - measuredHeight)
          : Math.max(rect.top - measuredHeight - gap, viewportPadding);
      const left = openRight
        ? rect.right + gap
        : openLeft
          ? rect.left - panelWidth - gap
          : Math.min(
              Math.max(rect.left, viewportPadding),
              Math.max(viewportPadding, window.innerWidth - viewportPadding - panelWidth)
            );

      setMenuPosition({
        left,
        top,
        width: panelWidth,
        maxHeight,
      });
    };

    useEffect(() => {
      if (!open) return;

      const handlePointerDown = (event: MouseEvent) => {
        const target = event.target as Node;
        if (
          !shellRef.current?.contains(target) &&
          !menuRef.current?.contains(target)
        ) {
          setOpen(false);
        }
      };

      const handleWindowChange = () => updateMenuPlacement(menuRef.current?.offsetHeight);

      document.addEventListener("mousedown", handlePointerDown);
      window.addEventListener("resize", handleWindowChange);
      window.addEventListener("scroll", handleWindowChange, true);
      return () => {
        document.removeEventListener("mousedown", handlePointerDown);
        window.removeEventListener("resize", handleWindowChange);
        window.removeEventListener("scroll", handleWindowChange, true);
      };
    }, [open, selectedValue, options.length]);

    useLayoutEffect(() => {
      if (!open) return;

      updateMenuPlacement();

      const frameId = window.requestAnimationFrame(() => {
        updateMenuPlacement(menuRef.current?.offsetHeight);
      });

      return () => window.cancelAnimationFrame(frameId);
    }, [open, selectedValue, options.length]);

    function emitChange(nextValue: string) {
      const selectEl = hiddenSelectRef.current;
      if (selectEl) {
        selectEl.value = nextValue;
        selectEl.dispatchEvent(new Event("change", { bubbles: true }));
        return;
      }

      if (onChange) {
        const syntheticEvent = {
          target: { value: nextValue, name } as EventTarget & HTMLSelectElement,
          currentTarget: { value: nextValue, name } as EventTarget & HTMLSelectElement,
        } as ChangeEvent<HTMLSelectElement>;

        onChange(syntheticEvent);
      }
    }

    return (
      <div ref={shellRef} className="relative">
        <select
          ref={(node) => {
            hiddenSelectRef.current = node;
            if (typeof ref === "function") {
              ref(node);
            } else if (ref) {
              ref.current = node;
            }
          }}
          value={selectedValue}
          onChange={onChange}
          disabled={disabled}
          name={name}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          {...props}
        >
          {children}
        </select>

        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          onClick={() => {
            if (disabled) return;
            updateMenuPlacement();
            setOpen((current) => !current);
          }}
          className={cn(
            "glass-control flex h-10 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm text-slate-800 outline-none ring-blue-500 transition-[border-color,box-shadow,transform] focus:ring-2 disabled:cursor-not-allowed disabled:opacity-55",
            className
          )}
        >
          <span className="min-w-0 truncate">{selectedOption?.label ?? ""}</span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-slate-500 transition-transform",
              open ? "rotate-180" : ""
            )}
          />
        </button>

        {open && typeof document !== "undefined"
          ? createPortal(
              <div
                ref={menuRef}
                className="month-picker-liquid month-picker-liquid-solid z-[120] min-w-[180px] overflow-hidden rounded-[20px] border border-white/50 p-2 shadow-2xl"
                style={{
                  position: "fixed",
                  width: menuPosition.width,
                  left: menuPosition.left,
                  top: menuPosition.top,
                }}
              >
                <div
                  className="hover-scrollbars relative z-10 overflow-y-auto"
                  style={{ maxHeight: menuPosition.maxHeight }}
                >
                  {options.map((option) => {
                    const isActive = option.value === selectedValue;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        disabled={option.disabled}
                        onClick={() => {
                          if (option.disabled) return;
                          emitChange(option.value);
                          setOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-center rounded-2xl px-3 py-2.5 text-left text-sm transition-colors",
                          option.disabled
                            ? "cursor-not-allowed text-slate-400"
                            : isActive
                              ? "bg-blue-600 text-white shadow-[0_12px_28px_rgba(37,99,235,0.24)]"
                              : "text-slate-700 hover:bg-white/60"
                        )}
                      >
                        <span className="truncate">{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>,
              document.body
            )
          : null}
      </div>
    );
  }
);

Select.displayName = "Select";
