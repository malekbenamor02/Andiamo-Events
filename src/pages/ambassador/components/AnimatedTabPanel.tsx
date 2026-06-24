import { useRef } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

const TAB_ORDER = ["new-orders", "history", "performance", "profile"] as const;

export type AmbassadorTabValue = (typeof TAB_ORDER)[number];

function getDirection(from: string, to: string): number {
  const fromIndex = TAB_ORDER.indexOf(from as AmbassadorTabValue);
  const toIndex = TAB_ORDER.indexOf(to as AmbassadorTabValue);
  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return 0;
  return toIndex > fromIndex ? 1 : -1;
}

export function AmbassadorTabIndicator({ active }: { active: boolean }) {
  const reducedMotion = useReducedMotion();

  if (!active) return null;

  return (
    <motion.div
      layoutId="ambassador-dashboard-tab"
      className="absolute inset-0 rounded-md border border-border/60 bg-background shadow-sm"
      transition={
        reducedMotion
          ? { duration: 0 }
          : { type: "spring", stiffness: 420, damping: 36, mass: 0.85 }
      }
    />
  );
}

export function AmbassadorTabPanel({
  activeTab,
  children,
}: {
  activeTab: string;
  children: ReactNode;
}) {
  const reducedMotion = useReducedMotion();
  const previousTabRef = useRef(activeTab);
  const directionRef = useRef(0);

  if (activeTab !== previousTabRef.current) {
    directionRef.current = getDirection(previousTabRef.current, activeTab);
    previousTabRef.current = activeTab;
  }

  const direction = directionRef.current;
  const offset = direction === 0 ? 0 : direction > 0 ? 10 : -10;
  const exitOffset = direction === 0 ? 0 : direction > 0 ? -6 : 6;

  if (reducedMotion) {
    return <div className="mt-6">{children}</div>;
  }

  return (
    <div className="mt-6 overflow-x-hidden">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: offset }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: exitOffset }}
          transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export { LayoutGroup as AmbassadorTabLayoutGroup };
