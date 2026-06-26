import type { ElementType } from "react";
import { CheckCircle2, Copy, MapPinOff, XCircle } from "lucide-react";

export type ScanResultKind =
  | "valid"
  | "ok"
  | "already_scanned"
  | "wrong_event"
  | "invalid"
  | "error"
  | "disabled";

export interface StatusConfig {
  accent: string;
  accentBg: string;
  textClass: string;
  icon: ElementType;
  label: string;
  shortLabel: string;
}

export function normalizeResultKind(result: string): ScanResultKind {
  if (
    result === "valid" ||
    result === "ok" ||
    result === "already_scanned" ||
    result === "wrong_event" ||
    result === "invalid" ||
    result === "error" ||
    result === "disabled"
  ) {
    return result;
  }
  return "invalid";
}

export function getStatusConfig(result: string): StatusConfig {
  switch (normalizeResultKind(result)) {
    case "ok":
      return {
        accent: "#22C55E",
        accentBg: "bg-emerald-500/10",
        textClass: "text-emerald-500",
        icon: CheckCircle2,
        label: "Ticket info",
        shortLabel: "Info",
      };
    case "valid":
      return {
        accent: "#22C55E",
        accentBg: "bg-emerald-500/10",
        textClass: "text-emerald-500",
        icon: CheckCircle2,
        label: "Valid",
        shortLabel: "Valid",
      };
    case "already_scanned":
      return {
        accent: "#F59E0B",
        accentBg: "bg-amber-500/10",
        textClass: "text-amber-500",
        icon: Copy,
        label: "Already scanned",
        shortLabel: "Already",
      };
    case "wrong_event":
      return {
        accent: "#F59E0B",
        accentBg: "bg-amber-500/10",
        textClass: "text-amber-500",
        icon: MapPinOff,
        label: "Wrong event",
        shortLabel: "Wrong",
      };
    default:
      return {
        accent: "#EF4444",
        accentBg: "bg-red-500/10",
        textClass: "text-red-500",
        icon: XCircle,
        label: "Invalid",
        shortLabel: "Invalid",
      };
  }
}

export function getStatusEdgeColor(result: string): string {
  return getStatusConfig(result).accent;
}
