import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { getApiBaseUrl } from "@/lib/api-routes";
import { API_ROUTES } from "@/lib/api-routes";
import { format } from "date-fns";
import { Plus, RefreshCw, Power, ChevronRight, Shield, ScanLine } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  AdminTabHeader,
  AdminMetricTile,
  ADMIN_TABLE_HEAD,
  ADMIN_TABLE_ROW,
  ADMIN_TABLE_WRAP,
  ADMIN_BTN_EDIT,
} from "@/pages/admin/components/AdminTabShell";

const MOBILE_SHEET_CLASS =
  "z-[60] flex max-h-[92dvh] flex-col rounded-t-[1.25rem] border-border/50 shadow-[0_-12px_48px_rgba(0,0,0,0.45)]";

interface ScannersTabProps {
  language: "en" | "fr";
  selectedEventId?: string;
}

interface Scanner {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  role?: string;
  created_by: string | null;
  created_at: string;
  created_by_name?: string | null;
}

interface ScanConfig {
  enabled: boolean;
  updated_at: string | null;
  updated_by: string | null;
  updated_by_name: string | null;
}

interface Stats {
  total: number;
  byStatus: Record<string, number>;
  byPass: Record<string, number>;
  byScanner?: Record<string, number>;
  byScannerStatus?: Record<string, { total: number; valid: number; invalid: number; already_scanned: number; wrong_event: number }>;
  scannerNames?: Record<string, string>;
  remainingValidPasses?: number | null;
}

interface ScanRow {
  id: string;
  scan_time: string;
  scan_result: string;
  buyer_name: string | null;
  pass_type: string | null;
  ambassador_name: string | null;
  event_name: string | null;
  scanner_name?: string | null;
}

function fetcher(url: string, options?: RequestInit) {
  return fetch(`${getApiBaseUrl()}${url}`, { ...options, credentials: "include" });
}

export function ScannersTab({ language, selectedEventId }: ScannersTabProps) {
  const isMobile = useIsMobile();
  const [config, setConfig] = useState<ScanConfig | null>(null);
  const [scanners, setScanners] = useState<Scanner[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [scans, setScans] = useState<ScanRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editScanner, setEditScanner] = useState<Scanner | null>(null);
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createRole, setCreateRole] = useState<"scanner" | "supervisor">("scanner");
  const [createError, setCreateError] = useState("");
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [editPassword, setEditPassword] = useState("");
  const [editRole, setEditRole] = useState<"scanner" | "supervisor">("scanner");
  const [toggleLoading, setToggleLoading] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);
  const [supervisorsOpen, setSupervisorsOpen] = useState(false);
  const [scannersOpen, setScannersOpen] = useState(false);
  const configReqRef = useRef(0);
  const validSelectedEventId = !!selectedEventId && /^[0-9a-f-]{36}$/i.test(selectedEventId);

  const loadConfig = async () => {
    const reqId = ++configReqRef.current;
    setConfigLoading(true);
    const r = await fetcher(API_ROUTES.ADMIN_SCAN_SYSTEM_CONFIG);
    if (reqId !== configReqRef.current) return;
    if (r.ok) {
      const d = await r.json();
      setConfig({ enabled: d.enabled, updated_at: d.updated_at, updated_by: d.updated_by, updated_by_name: d.updated_by_name ?? null });
    } else setConfig({ enabled: false, updated_at: null, updated_by: null, updated_by_name: null });
    setConfigLoading(false);
  };

  const loadScanners = async () => {
    const r = await fetcher(API_ROUTES.ADMIN_SCANNERS);
    if (r.ok) {
      const d = await r.json();
      setScanners(d.scanners || []);
    }
  };

  const loadStats = async () => {
    setLoading(true);
    try {
      const eventParam = validSelectedEventId ? `?event_id=${selectedEventId}` : "";
      if (selectedId) {
        const r = await fetcher(`${API_ROUTES.ADMIN_SCANNER_STATISTICS(selectedId)}${eventParam}`);
        if (r.ok) {
          const d = await r.json();
          setStats({
            total: d.total,
            byStatus: d.byStatus || {},
            byPass: d.byPass || {},
            remainingValidPasses: typeof d.remaining_valid_passes === "number" ? d.remaining_valid_passes : null,
          });
        }
      } else {
        const r = await fetcher(`${API_ROUTES.ADMIN_SCAN_STATISTICS}${eventParam}`);
        if (r.ok) {
          const d = await r.json();
          setStats({
            total: d.total,
            byStatus: d.byStatus || {},
            byPass: d.byPass || {},
            byScanner: d.byScanner,
            byScannerStatus: d.byScannerStatus || {},
            scannerNames: d.scannerNames || {},
            remainingValidPasses: typeof d.remaining_valid_passes === "number" ? d.remaining_valid_passes : null,
          });
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const loadScans = async () => {
    setLoading(true);
    try {
      const eventParam = validSelectedEventId ? `?event_id=${selectedEventId}` : "";
      const u = (selectedId ? `${API_ROUTES.ADMIN_SCANNER_SCANS(selectedId)}` : `${API_ROUTES.ADMIN_SCAN_HISTORY}`) + eventParam;
      const r = await fetcher(u);
      if (r.ok) {
        const d = await r.json();
        setScans(d.scans || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadConfig(); loadScanners(); }, []);
  useEffect(() => { loadStats(); loadScans(); }, [selectedId, selectedEventId]);

  const onToggleScan = async () => {
    if (toggleLoading || !config) return;
    const prev = config;
    const nextEnabled = !config.enabled;
    setToggleLoading(true);
    setConfig((c) => (c ? { ...c, enabled: nextEnabled } : c));
    try {
      const r = await fetcher(API_ROUTES.ADMIN_SCAN_SYSTEM_CONFIG, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scan_enabled: nextEnabled, enabled: nextEnabled }),
      });
      if (!r.ok) {
        setConfig(prev);
      } else {
        const d = await r.json().catch(() => null);
        const resolvedEnabled = typeof d?.enabled === "boolean" ? d.enabled : nextEnabled;
        setConfig((c) => (c ? { ...c, enabled: resolvedEnabled } : c));
        // Sync metadata shortly after optimistic update without blocking the button.
        window.setTimeout(() => {
          void loadConfig();
        }, 300);
      }
    } finally {
      setToggleLoading(false);
    }
  };

  const onCreate = async () => {
    if (!createName.trim() || !createEmail.trim() || createPassword.length < 8) return;
    setCreateError("");
    const r = await fetcher(API_ROUTES.ADMIN_SCANNERS, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: createName.trim(), email: createEmail.trim().toLowerCase(), password: createPassword, role: createRole }) });
    const d = await r.json().catch(() => ({}));
    if (r.ok) {
      setCreateOpen(false);
      setCreateName("");
      setCreateEmail("");
      setCreatePassword("");
      setCreateRole("scanner");
      await loadScanners();
      return;
    }
    setCreateError(typeof d.error === "string" ? d.error : `Request failed (${r.status})`);
  };

  const onEdit = async () => {
    if (!editScanner) return;
    const body: Record<string, unknown> = {};
    if (editName.trim()) body.name = editName.trim();
    if (editEmail.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editEmail)) body.email = editEmail.trim().toLowerCase();
    body.is_active = editActive;
    body.role = editRole;
    if (editPassword.length >= 8) body.password = editPassword;
    if (Object.keys(body).length === 0) return;
    const r = await fetcher(API_ROUTES.ADMIN_SCANNER(editScanner.id), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (r.ok) { setEditOpen(false); setEditScanner(null); setEditPassword(""); await loadScanners(); await loadStats(); }
  };

  const onDeactivate = async (s: Scanner) => {
    const r = await fetcher(API_ROUTES.ADMIN_SCANNER(s.id), { method: "DELETE" });
    if (r.ok) await loadScanners();
  };

  const openEdit = (s: Scanner) => {
    setEditScanner(s);
    setEditName(s.name);
    setEditEmail(s.email);
    setEditActive(s.is_active);
    setEditRole(s.role === "supervisor" ? "supervisor" : "scanner");
    setEditPassword("");
    setEditOpen(true);
  };

  const openCreate = () => {
    setCreateRole("scanner");
    setCreateError("");
    setCreateOpen(true);
  };

  const supervisors = scanners.filter((s) => s.role === "supervisor");
  const scannerUsers = scanners.filter((s) => s.role !== "supervisor");

  const t = language === "en" ? { start: "Start Scan", stop: "Stop Scan", toggleScan: "Toggle Scan", status: "Status", on: "ON", off: "OFF", scanners: "Scanners", create: "Create Scanner", createBtn: "Create", save: "Save", name: "Name", email: "Email", password: "Password", active: "Active", inactive: "Inactive", actions: "Actions", edit: "Edit", deactivate: "Deactivate", all: "All Scanners", total: "Total", valid: "Valid", invalid: "Invalid", alreadyScanned: "Already scanned", wrongEvent: "Wrong event", history: "History", time: "Time", result: "Result", buyer: "Buyer", pass: "Pass", ambassador: "Ambassador", event: "Event", scanner: "Scanner", noScans: "No scans", remainingValidPasses: "Remaining valid passes", scannerPerformance: "Scanner performance", selectEventHint: "Select an event to see remaining valid passes", processing: "Processing...", remainingVsStatus: "Remaining valid vs scan statuses", roleLabel: "Role", roleScanner: "Scanners", roleSupervisor: "Supervisors", noMembers: "No members yet", team: "Team" } : { start: "Démarrer le scan", stop: "Arrêter le scan", toggleScan: "Basculer le scan", status: "État", on: "ACTIF", off: "INACTIF", scanners: "Scanners", create: "Créer un scanner", createBtn: "Créer", save: "Enregistrer", name: "Nom", email: "Email", password: "Mot de passe", active: "Actif", inactive: "Inactif", actions: "Actions", edit: "Modifier", deactivate: "Désactiver", all: "Tous les scanners", total: "Total", valid: "Valide", invalid: "Invalide", alreadyScanned: "Déjà scanné", wrongEvent: "Mauvais événement", history: "Historique", time: "Heure", result: "Résultat", buyer: "Acheteur", pass: "Pass", ambassador: "Ambassadeur", event: "Événement", scanner: "Scanner", noScans: "Aucun scan", remainingValidPasses: "Pass valides restants", scannerPerformance: "Performance des scanners", selectEventHint: "Sélectionnez un événement pour voir les pass valides restants", processing: "Traitement...", remainingVsStatus: "Pass valides restants vs statuts de scan", roleLabel: "Rôle", roleScanner: "Scanners", roleSupervisor: "Superviseurs", noMembers: "Aucun membre", team: "Équipe" };

  const renderScannerRows = (items: Scanner[]) => {
    if (items.length === 0) {
      return (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">{t.noMembers}</p>
      );
    }

    if (isMobile) {
      return (
        <div className="divide-y divide-border/50">
          {items.map((s) => (
            <div key={s.id} className="flex items-start gap-3 px-4 py-3.5">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium text-foreground">{s.name}</p>
                  <Badge
                    variant="outline"
                    className={cn(
                      "border-transparent px-2 py-0 text-[10px] font-medium",
                      s.is_active
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {s.is_active ? t.active : t.inactive}
                  </Badge>
                </div>
                <p className="truncate text-xs text-muted-foreground">{s.email}</p>
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <Button variant="outline" size="sm" className={ADMIN_BTN_EDIT} onClick={() => openEdit(s)}>
                  {t.edit}
                </Button>
                {s.is_active && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2.5 text-xs text-destructive hover:bg-destructive/10"
                    onClick={() => onDeactivate(s)}
                  >
                    {t.deactivate}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className={ADMIN_TABLE_WRAP}>
        <Table>
          <TableHeader>
            <TableRow className="border-border/60">
              <TableHead className={ADMIN_TABLE_HEAD}>{t.name}</TableHead>
              <TableHead className={ADMIN_TABLE_HEAD}>{t.email}</TableHead>
              <TableHead className={ADMIN_TABLE_HEAD}>{t.active}</TableHead>
              <TableHead className={cn(ADMIN_TABLE_HEAD, "text-right")}>{t.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((s) => (
              <TableRow key={s.id} className={ADMIN_TABLE_ROW}>
                <TableCell className="font-medium text-foreground">{s.name}</TableCell>
                <TableCell className="text-muted-foreground">{s.email}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn(
                      "border-transparent font-normal",
                      s.is_active
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {s.is_active ? t.active : t.inactive}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" className={cn(ADMIN_BTN_EDIT, "mr-1.5")} onClick={() => openEdit(s)}>
                    {t.edit}
                  </Button>
                  {s.is_active && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2.5 text-xs text-destructive hover:bg-destructive/10"
                      onClick={() => onDeactivate(s)}
                    >
                      {t.deactivate}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  const renderRoleGroup = (
    title: string,
    icon: React.ReactNode,
    items: Scanner[],
    open: boolean,
    onOpenChange: (open: boolean) => void
  ) => (
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      className="overflow-hidden rounded-xl border border-border/60 bg-muted/10"
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRight
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
              open && "rotate-90"
            )}
            aria-hidden
          />
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background/80 text-muted-foreground">
            {icon}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-foreground">{title}</span>
            <span className="text-xs text-muted-foreground">
              {items.length} {items.length === 1 ? (language === "en" ? "member" : "membre") : (language === "en" ? "members" : "membres")}
            </span>
          </span>
          <Badge variant="secondary" className="shrink-0 font-normal tabular-nums">
            {items.filter((s) => s.is_active).length} {t.active.toLowerCase()}
          </Badge>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-border/50 bg-background/40">
        {renderScannerRows(items)}
      </CollapsibleContent>
    </Collapsible>
  );

  const createForm = (
    <div className="space-y-4">
      {createError && <p className="text-sm text-destructive">{createError}</p>}
      <div className="space-y-2">
        <Label className="text-muted-foreground">{t.name}</Label>
        <Input value={createName} onChange={(e) => setCreateName(e.target.value)} className="h-11" />
      </div>
      <div className="space-y-2">
        <Label className="text-muted-foreground">{t.email}</Label>
        <Input type="email" value={createEmail} onChange={(e) => setCreateEmail(e.target.value)} className="h-11" />
      </div>
      <div className="space-y-2">
        <Label className="text-muted-foreground">{t.password} (min 8)</Label>
        <Input type="password" value={createPassword} onChange={(e) => setCreatePassword(e.target.value)} className="h-11" />
      </div>
      <div className="space-y-2">
        <Label className="text-muted-foreground">{t.roleLabel}</Label>
        <Select value={createRole} onValueChange={(v) => setCreateRole(v === "supervisor" ? "supervisor" : "scanner")}>
          <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="scanner">{language === "en" ? "Scanner" : "Scanner"}</SelectItem>
            <SelectItem value="supervisor">{language === "en" ? "Supervisor" : "Superviseur"}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  const editForm = editScanner ? (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-muted-foreground">{t.name}</Label>
        <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-11" />
      </div>
      <div className="space-y-2">
        <Label className="text-muted-foreground">{t.email}</Label>
        <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="h-11" />
      </div>
      <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-3">
        <Switch checked={editActive} onCheckedChange={setEditActive} />
        <Label className="text-sm text-foreground">{t.active}</Label>
      </div>
      <div className="space-y-2">
        <Label className="text-muted-foreground">{t.roleLabel}</Label>
        <Select value={editRole} onValueChange={(v) => setEditRole(v === "supervisor" ? "supervisor" : "scanner")}>
          <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="scanner">{language === "en" ? "Scanner" : "Scanner"}</SelectItem>
            <SelectItem value="supervisor">{language === "en" ? "Supervisor" : "Superviseur"}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label className="text-muted-foreground">{t.password} ({language === "en" ? "leave blank to keep" : "laisser vide pour conserver"})</Label>
        <Input type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="••••••••" className="h-11" />
      </div>
    </div>
  ) : null;

  return (
    <div className="space-y-6">
      <AdminTabHeader title={t.scanners} />

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">{t.status} – {config?.enabled ? t.on : t.off}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            onClick={onToggleScan}
            disabled={configLoading || toggleLoading || !config}
            variant={config?.enabled ? "destructive" : "default"}
          >
            <Power className="w-4 h-4 mr-2" />
            {toggleLoading ? t.processing : config?.enabled ? t.stop : t.start}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { loadConfig(); loadScanners(); loadStats(); loadScans(); }}><RefreshCw className="w-4 h-4" /></Button>
        </CardContent>
      </Card>

      <Card className="bg-card border-border/60">
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-4">
          <CardTitle className="text-base font-semibold text-foreground">{t.team}</CardTitle>
          <Button size="sm" onClick={openCreate} className="shrink-0">
            <Plus className="w-4 h-4 mr-1.5" />
            {t.create}
          </Button>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          {renderRoleGroup(
            t.roleSupervisor,
            <Shield className="h-4 w-4" />,
            supervisors,
            supervisorsOpen,
            setSupervisorsOpen
          )}
          {renderRoleGroup(
            t.roleScanner,
            <ScanLine className="h-4 w-4" />,
            scannerUsers,
            scannersOpen,
            setScannersOpen
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <Label className="text-muted-foreground">{language === "en" ? "View" : "Vue"}:</Label>
        <Select value={selectedId ?? "all"} onValueChange={(v) => setSelectedId(v === "all" ? null : v)}>
          <SelectTrigger className="w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.all}</SelectItem>
            {scanners.filter(s => s.is_active).map(s => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>

      {stats && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground text-base">{language === "en" ? "Scan summary" : "Résumé des scans"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <AdminMetricTile label={t.total} value={(stats.total ?? 0).toLocaleString()} accent="primary" />
              <AdminMetricTile label={t.valid} value={(stats.byStatus.valid ?? 0).toLocaleString()} accent="emerald" />
              <AdminMetricTile label={t.alreadyScanned} value={(stats.byStatus.already_scanned ?? 0).toLocaleString()} accent="amber" />
              <AdminMetricTile label={t.invalid} value={(stats.byStatus.invalid ?? 0).toLocaleString()} accent="destructive" />
              <AdminMetricTile label={t.wrongEvent} value={(stats.byStatus.wrong_event ?? 0).toLocaleString()} accent="destructive" />
            </div>
            <AdminMetricTile
              label={t.remainingValidPasses}
              value={validSelectedEventId ? (stats.remainingValidPasses ?? 0).toLocaleString() : "—"}
              accent="emerald"
            />
            {!validSelectedEventId && (
              <p className="text-xs text-muted-foreground/80">{t.selectEventHint}</p>
            )}
            {validSelectedEventId && (
              <div className="rounded-lg bg-muted/40 border border-border p-3">
                <p className="text-xs text-muted-foreground mb-2">{t.remainingVsStatus}</p>
                <p className="text-xs text-muted-foreground">{t.remainingValidPasses}: <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{(stats.remainingValidPasses ?? 0).toLocaleString()}</span></p>
                <p className="text-xs text-muted-foreground">{t.valid}: <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{(stats.byStatus.valid ?? 0).toLocaleString()}</span></p>
                <p className="text-xs text-muted-foreground">{t.alreadyScanned}: <span className="text-amber-600 dark:text-amber-400 font-semibold">{(stats.byStatus.already_scanned ?? 0).toLocaleString()}</span></p>
                <p className="text-xs text-muted-foreground">{t.invalid}: <span className="text-destructive font-semibold">{(stats.byStatus.invalid ?? 0).toLocaleString()}</span></p>
                <p className="text-xs text-muted-foreground">{t.wrongEvent}: <span className="text-destructive font-semibold">{(stats.byStatus.wrong_event ?? 0).toLocaleString()}</span></p>
              </div>
            )}
            {Object.keys(stats.byPass || {}).length > 0 && (
              <p className="text-sm text-muted-foreground pt-1 border-t border-border">{language === "en" ? "By pass" : "Par pass"}: {Object.entries(stats.byPass).map(([k, v]) => `${k}: ${v}`).join(", ")}</p>
            )}
            {!selectedId && Object.keys(stats.byScannerStatus || {}).length > 0 && (
              <div className="pt-2 border-t border-border space-y-2">
                <p className="text-sm text-foreground font-medium">{t.scannerPerformance}</p>
                <div className="space-y-2">
                  {Object.entries(stats.byScannerStatus || {})
                    .sort((a, b) => (b[1]?.total || 0) - (a[1]?.total || 0))
                    .map(([scannerId, scannerStats]) => (
                      <div key={scannerId} className="rounded-lg bg-muted/40 border border-border p-3">
                        <p className="text-sm text-foreground mb-2">{stats.scannerNames?.[scannerId] || scanners.find((s) => s.id === scannerId)?.name || t.scanner}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.total}: {(scannerStats.total || 0).toLocaleString()} | {t.valid}: {(scannerStats.valid || 0).toLocaleString()} | {t.alreadyScanned}: {(scannerStats.already_scanned || 0).toLocaleString()} | {t.invalid}: {(scannerStats.invalid || 0).toLocaleString()} | {t.wrongEvent}: {(scannerStats.wrong_event || 0).toLocaleString()}
                        </p>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-foreground">{t.history}</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p className="text-muted-foreground">Loading…</p> : (
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className={ADMIN_TABLE_HEAD}>{t.time}</TableHead>
                  <TableHead className={ADMIN_TABLE_HEAD}>{t.result}</TableHead>
                  <TableHead className={ADMIN_TABLE_HEAD}>{t.buyer}</TableHead>
                  <TableHead className={ADMIN_TABLE_HEAD}>{t.pass}</TableHead>
                  <TableHead className={ADMIN_TABLE_HEAD}>{t.ambassador}</TableHead>
                  <TableHead className={ADMIN_TABLE_HEAD}>{t.event}</TableHead>
                  {!selectedId && <TableHead className={ADMIN_TABLE_HEAD}>{t.scanner}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {scans.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">{t.noScans}</TableCell></TableRow>
                ) : scans.map((r) => (
                  <TableRow key={r.id} className="border-border">
                    <TableCell className="text-foreground">{r.scan_time ? format(new Date(r.scan_time), "PPp") : "—"}</TableCell>
                    <TableCell><span className={r.scan_result === "valid" ? "text-emerald-600 dark:text-emerald-400" : r.scan_result === "already_scanned" ? "text-amber-600 dark:text-amber-400" : "text-destructive"}>{r.scan_result}</span></TableCell>
                    <TableCell className="text-muted-foreground">{r.buyer_name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{r.pass_type || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{r.ambassador_name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{r.event_name || "—"}</TableCell>
                    {!selectedId && <TableCell className="text-muted-foreground">{r.scanner_name || "—"}</TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {isMobile ? (
        <Drawer open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) setCreateError(""); }}>
          <DrawerContent className={MOBILE_SHEET_CLASS}>
            <DrawerHeader className="px-5 pb-2 pt-1 text-left">
              <DrawerTitle className="text-base font-semibold tracking-tight">{t.create}</DrawerTitle>
            </DrawerHeader>
            <div className="overflow-y-auto px-5 pb-2">{createForm}</div>
            <DrawerFooter className="border-t border-border/50 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
              <Button className="h-11 w-full" onClick={onCreate}>{t.createBtn}</Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) setCreateError(""); }}>
          <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[420px] duration-300 data-[state=closed]:duration-300">
            <DialogHeader className="space-y-1 border-b border-border/50 px-6 py-5 text-left">
              <DialogTitle className="text-base font-semibold">{t.create}</DialogTitle>
            </DialogHeader>
            <div className="px-6 py-5">{createForm}</div>
            <DialogFooter className="border-t border-border/50 px-6 py-4">
              <Button className="w-full sm:w-auto" onClick={onCreate}>{t.createBtn}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {isMobile ? (
        <Drawer open={editOpen} onOpenChange={setEditOpen}>
          <DrawerContent className={MOBILE_SHEET_CLASS}>
            <DrawerHeader className="px-5 pb-2 pt-1 text-left">
              <DrawerTitle className="text-base font-semibold tracking-tight">{t.edit}</DrawerTitle>
            </DrawerHeader>
            <div className="overflow-y-auto px-5 pb-2">{editForm}</div>
            <DrawerFooter className="border-t border-border/50 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
              <Button className="h-11 w-full" onClick={onEdit}>{t.save}</Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[420px] duration-300 data-[state=closed]:duration-300">
            <DialogHeader className="space-y-1 border-b border-border/50 px-6 py-5 text-left">
              <DialogTitle className="text-base font-semibold">{t.edit}</DialogTitle>
            </DialogHeader>
            <div className="px-6 py-5">{editForm}</div>
            <DialogFooter className="border-t border-border/50 px-6 py-4">
              <Button className="w-full sm:w-auto" onClick={onEdit}>{t.save}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
