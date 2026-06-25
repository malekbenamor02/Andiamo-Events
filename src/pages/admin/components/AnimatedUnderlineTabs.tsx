import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { TabsList } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

/** Smooth ease-out — quick start, gentle settle (not bouncy). */
const UNDERLINE_TRANSITION =
  "transition-[left,width] duration-[280ms] ease-[cubic-bezier(0.32,0.72,0,1)]";

export const ADMIN_UNDERLINE_TAB_LIST_CLASS =
  "relative h-auto w-full justify-start gap-0 rounded-none border-b border-border/60 bg-transparent p-0";

export const ADMIN_UNDERLINE_TAB_LIST_SCROLLABLE_CLASS =
  "relative h-auto w-max min-w-full justify-start gap-0 rounded-none border-b border-border/60 bg-transparent p-0";

export const ADMIN_UNDERLINE_TAB_TRIGGER_CLASS = cn(
  "relative z-10 shrink-0 rounded-none border-b-2 border-transparent px-2 py-2 text-xs shadow-none sm:px-3 sm:text-sm",
  "text-muted-foreground transition-colors duration-200",
  "data-[state=active]:bg-transparent data-[state=active]:font-medium",
  "data-[state=active]:text-foreground data-[state=active]:shadow-none"
);

export const ADMIN_UNDERLINE_TAB_TRIGGER_COMPACT_CLASS = cn(
  "relative z-10 shrink-0 gap-1.5 rounded-none border-0 border-b-2 border-transparent bg-transparent px-3 py-2.5 text-xs shadow-none transition-colors sm:px-4 sm:text-sm",
  "data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
);

export const ADMIN_UNDERLINE_BUTTON_CLASS = (active: boolean) =>
  cn(
    "relative z-10 -mb-px border-b-2 border-transparent px-3 py-2 text-sm transition-colors duration-200",
    active
      ? "font-medium text-foreground"
      : "text-muted-foreground hover:text-foreground"
  );

type IndicatorState = { left: number; width: number; ready: boolean };

function useAnimatedUnderline(
  listRef: React.RefObject<HTMLElement | null>,
  activeValue?: string
) {
  const [indicator, setIndicator] = useState<IndicatorState>({
    left: 0,
    width: 0,
    ready: false,
  });

  const updateIndicator = useCallback(() => {
    const list = listRef.current;
    if (!list) return;

    const active =
      (activeValue
        ? list.querySelector<HTMLElement>(`[data-nav-value="${activeValue}"]`)
        : null) ??
      list.querySelector<HTMLElement>('[data-state="active"]');

    if (!active) return;

    setIndicator({
      left: active.offsetLeft,
      width: active.offsetWidth,
      ready: true,
    });
  }, [activeValue, listRef]);

  useLayoutEffect(() => {
    updateIndicator();
  }, [activeValue, updateIndicator]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const resizeObserver = new ResizeObserver(() => updateIndicator());
    resizeObserver.observe(list);
    window.addEventListener("resize", updateIndicator);

    const mutationObserver = new MutationObserver(() => updateIndicator());
    mutationObserver.observe(list, {
      attributes: true,
      subtree: true,
      attributeFilter: ["data-state"],
    });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("resize", updateIndicator);
    };
  }, [listRef, updateIndicator]);

  return indicator;
}

function UnderlineIndicator({
  indicator,
  className,
}: {
  indicator: IndicatorState;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute bottom-0 z-20 h-0.5 rounded-full bg-primary",
        UNDERLINE_TRANSITION,
        !indicator.ready && "opacity-0",
        className
      )}
      style={{ left: indicator.left, width: indicator.width }}
    />
  );
}

export function AnimatedUnderlineTabsList({
  activeValue,
  className,
  children,
  scrollable = false,
}: {
  activeValue?: string;
  className?: string;
  children: ReactNode;
  /** Horizontal scroll so all triggers stay tappable on narrow screens (e.g. Academy subtabs). */
  scrollable?: boolean;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const indicator = useAnimatedUnderline(listRef, activeValue);

  useEffect(() => {
    if (!scrollable) return;
    const list = listRef.current;
    if (!list) return;
    const active =
      (activeValue
        ? list.querySelector<HTMLElement>(`[data-state="active"]`)
        : null) ?? list.querySelector<HTMLElement>('[data-state="active"]');
    active?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [activeValue, scrollable]);

  const tabsList = (
    <TabsList
      ref={listRef}
      className={cn(
        scrollable ? ADMIN_UNDERLINE_TAB_LIST_SCROLLABLE_CLASS : ADMIN_UNDERLINE_TAB_LIST_CLASS,
        className
      )}
    >
      <UnderlineIndicator indicator={indicator} />
      {children}
    </TabsList>
  );

  if (!scrollable) return tabsList;

  return (
    <div className="scrollbar-hide -mx-1 overflow-x-auto overscroll-x-contain px-1 touch-pan-x">
      {tabsList}
    </div>
  );
}

export function AnimatedUnderlineButtonNav({
  activeValue,
  className,
  children,
}: {
  activeValue: string;
  className?: string;
  children: ReactNode;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const indicator = useAnimatedUnderline(listRef, activeValue);

  return (
    <div
      ref={listRef}
      className={cn(
        "relative flex gap-1 border-b border-border/60",
        className
      )}
    >
      <UnderlineIndicator indicator={indicator} />
      {children}
    </div>
  );
}
