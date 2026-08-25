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
  group?: string;
  icon?: ReactNode;
};

function extractLabel(children: ReactNode): string {
  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }
  if (Array.isArray(children)) {
    return children.map(extractLabel).join("");
  }
  if (isValidElement(children)) {
    return extractLabel((children.props as any).children);
  }
  return "";
}

function normalizeChildren(children: SelectHTMLAttributes<HTMLSelectElement>["children"]): SelectOption[] {
  const result: SelectOption[] = [];

  const processNode = (node: ReactNode, groupName?: string) => {
    Children.forEach(node, (child) => {
      if (!isValidElement(child)) return;

      const props = child.props as any;
      if (child.type === "optgroup" || (props.label !== undefined && props.children && typeof props.children === "object")) {
        processNode(props.children, props.label);
      } else if (child.type === "option" || props.value !== undefined) {
        result.push({
          value: String(props.value ?? ""),
          label: extractLabel(props.children) || String(props.value ?? ""),
          disabled: props.disabled,
          group: groupName,
          icon: props.icon,
        });
      }
    });
  };

  processNode(children);
  return result;
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
            "glass-control flex h-10 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm text-slate-800 dark:text-white dark:bg-[#202024] dark:border-neutral-700/80 outline-none ring-slate-900 transition-[border-color,box-shadow,transform] focus:ring-2 disabled:cursor-not-allowed disabled:opacity-55",
            className
          )}
        >
          <span className="min-w-0 truncate flex items-center gap-2">
            {selectedOption?.icon}
            <span className="truncate">{selectedOption?.label ?? ""}</span>
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-slate-500 dark:text-neutral-300 transition-transform",
              open ? "rotate-180" : ""
            )}
          />
        </button>

        {open && typeof document !== "undefined"
          ? createPortal(
              <div
                ref={menuRef}
                className="z-[120] min-w-[180px] overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl dark:border-[#333333] dark:bg-[#252526] dark:text-[#E0E0E0]"
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
                  {options.map((option, idx) => {
                    const isActive = option.value === selectedValue;
                    const prevOption = options[idx - 1];
                    const isNewGroup = option.group && (!prevOption || prevOption.group !== option.group);

                    return (
                      <div key={`opt-${idx}-${option.value}`}>
                        {isNewGroup && (
                          <div className="px-3 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-400 select-none">
                            {option.group}
                          </div>
                        )}
                        <button
                          type="button"
                          disabled={option.disabled}
                          onClick={() => {
                            if (option.disabled) return;
                            emitChange(option.value);
                            setOpen(false);
                          }}
                          className={cn(
                            "flex w-full items-center rounded-xl px-3 py-2 text-left text-sm transition-colors",
                            option.disabled
                              ? "cursor-not-allowed text-slate-400 dark:text-[#6E6E6E]"
                              : isActive
                                ? "bg-slate-900 text-white shadow-xs dark:bg-[#37373D] dark:text-white dark:font-semibold"
                                : "text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-[#CCCCCC] dark:hover:bg-[#2D2D30] dark:hover:text-white font-medium"
                          )}
                        >
                          <span className="truncate flex items-center gap-2">
                            {option.icon}
                            <span className="truncate">{option.label}</span>
                          </span>
                        </button>
                      </div>
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
