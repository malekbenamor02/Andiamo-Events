/**
 * Per-admin dashboard tab access editor (super_admin configuring regular admins).
 */

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AdminTabAccessState, AdminTabAccessSummary } from "../types";
import tabAccessPresets from "@shared/admin/tabAccessPresets.data.json";
import {
  ADMIN_TAB_REGISTRY,
  labelForTab,
  type AdminTabKey,
} from "../adminTabRegistry";

export function defaultAdminTabAccessState(): AdminTabAccessState {
  return { useRoleDefaults: true, allowedTabKeys: [], mobileTabKeys: [] };
}

export function tabAccessStateFromSummary(
  summary?: AdminTabAccessSummary | null
): AdminTabAccessState {
  if (!summary?.is_explicit) {
    return defaultAdminTabAccessState();
  }
  return {
    useRoleDefaults: false,
    allowedTabKeys: summary.allowed_tab_keys || [],
    mobileTabKeys: summary.mobile_tab_keys || [],
  };
}

export function tabAccessStateToApiPayload(
  state: AdminTabAccessState,
  role: string,
  mode: "create" | "update" = "update"
): { allowed_tab_keys?: string[] | null; mobile_tab_keys?: string[] } {
  if (role === "super_admin") {
    return mode === "update" ? { allowed_tab_keys: null, mobile_tab_keys: [] } : {};
  }
  if (state.useRoleDefaults) {
    return mode === "update" ? { allowed_tab_keys: null, mobile_tab_keys: [] } : {};
  }
  return {
    allowed_tab_keys: state.allowedTabKeys,
    mobile_tab_keys: state.mobileTabKeys,
  };
}

export interface AdminTabAccessEditorProps {
  language: "en" | "fr";
  role: string;
  value: AdminTabAccessState;
  onChange: (value: AdminTabAccessState) => void;
  labels: Record<string, string>;
}

const SENSITIVE_TAB_KEYS = tabAccessPresets.sensitiveTabKeys;
const TAB_ACCESS_PRESETS = tabAccessPresets.presets as Record<string, string[]>;
const PRESET_LABELS: Record<string, { en: string; fr: string }> = {
  standard_admin: { en: "Standard admin", fr: "Admin standard" },
  events_only: { en: "Events only", fr: "Événements uniquement" },
  sales_pos: { en: "Sales / POS", fr: "Ventes / PDV" },
  marketing_only: { en: "Marketing only", fr: "Marketing uniquement" },
};

export function AdminTabAccessEditor({
  language,
  role,
  value,
  onChange,
  labels,
}: AdminTabAccessEditorProps) {
  if (role === "super_admin") {
    return (
      <p className="text-sm text-muted-foreground rounded-md border border-border/60 bg-muted/30 px-3 py-2">
        {language === "en"
          ? "Super admins always have full dashboard access."
          : "Les super admins ont toujours un accès complet au tableau de bord."}
      </p>
    );
  }

  const toggleAllowed = (key: string, checked: boolean) => {
    const nextAllowed = checked
      ? [...new Set([...value.allowedTabKeys, key])]
      : value.allowedTabKeys.filter((k) => k !== key);
    const nextMobile = value.mobileTabKeys.filter((k) => nextAllowed.includes(k));
    onChange({
      ...value,
      useRoleDefaults: false,
      allowedTabKeys: nextAllowed,
      mobileTabKeys: nextMobile,
    });
  };

  const toggleMobile = (key: string, checked: boolean) => {
    const nextMobile = checked
      ? [...new Set([...value.mobileTabKeys, key])]
      : value.mobileTabKeys.filter((k) => k !== key);
    onChange({ ...value, useRoleDefaults: false, mobileTabKeys: nextMobile });
  };

  const applyPreset = (presetKey: keyof typeof TAB_ACCESS_PRESETS) => {
    const keys = TAB_ACCESS_PRESETS[presetKey];
    const mobileDefaults = ADMIN_TAB_REGISTRY.filter(
      (t) => t.showInMobileBottomNav && keys.includes(t.key)
    ).map((t) => t.key);
    onChange({
      useRoleDefaults: false,
      allowedTabKeys: [...keys],
      mobileTabKeys: mobileDefaults,
    });
  };

  return (
    <div className="space-y-4 rounded-lg border border-border/60 p-4">
      <div className="flex items-center gap-2">
        <Checkbox
          id="useRoleDefaults"
          checked={value.useRoleDefaults}
          onCheckedChange={(checked) => {
            if (checked === true) {
              onChange(defaultAdminTabAccessState());
            } else {
              onChange({
                useRoleDefaults: false,
                allowedTabKeys: [...TAB_ACCESS_PRESETS.standard_admin],
                mobileTabKeys: ADMIN_TAB_REGISTRY.filter(
                  (t) =>
                    t.showInMobileBottomNav &&
                    TAB_ACCESS_PRESETS.standard_admin.includes(t.key as AdminTabKey)
                ).map((t) => t.key),
              });
            }
          }}
        />
        <Label htmlFor="useRoleDefaults" className="text-sm font-medium cursor-pointer">
          {language === "en" ? "Use role defaults" : "Utiliser les défauts du rôle"}
        </Label>
      </div>

      {!value.useRoleDefaults && (
        <>
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {language === "en" ? "Preset" : "Préréglage"}
            </Label>
            <Select
              onValueChange={(v) => applyPreset(v as keyof typeof TAB_ACCESS_PRESETS)}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    language === "en" ? "Apply a preset…" : "Appliquer un préréglage…"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TAB_ACCESS_PRESETS) as Array<keyof typeof TAB_ACCESS_PRESETS>).map(
                  (key) => (
                    <SelectItem key={key} value={key}>
                      {PRESET_LABELS[key][language]}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {language === "en" ? "Allowed dashboard tabs" : "Onglets autorisés"}
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {ADMIN_TAB_REGISTRY.map((tab) => {
                const isSensitive = SENSITIVE_TAB_KEYS.includes(tab.key);
                return (
                  <label
                    key={tab.key}
                    className="flex items-center gap-2 text-sm cursor-pointer rounded-md px-2 py-1.5 hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={value.allowedTabKeys.includes(tab.key)}
                      onCheckedChange={(c) => toggleAllowed(tab.key, c === true)}
                    />
                    <span className="flex-1 min-w-0 truncate">
                      {labelForTab(tab, labels, language)}
                    </span>
                    {isSensitive && (
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {language === "en" ? "Sensitive" : "Sensible"}
                      </Badge>
                    )}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {language === "en" ? "Mobile bottom nav" : "Barre mobile"}
            </Label>
            {value.allowedTabKeys.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {language === "en"
                  ? "Select at least one allowed tab first."
                  : "Sélectionnez d'abord au moins un onglet autorisé."}
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                {value.allowedTabKeys.map((key) => {
                  const tab = ADMIN_TAB_REGISTRY.find((t) => t.key === key);
                  if (!tab) return null;
                  return (
                    <label
                      key={key}
                      className="flex items-center gap-2 text-sm cursor-pointer rounded-md px-2 py-1.5 hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={value.mobileTabKeys.includes(key)}
                        onCheckedChange={(c) => toggleMobile(key, c === true)}
                      />
                      <span className="truncate">{labelForTab(tab, labels, language)}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
