import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { getApiBaseUrl } from "@/lib/api-routes";
import { API_ROUTES } from "@/lib/api-routes";
import { format } from "date-fns";
import { Plus, RefreshCw, Power, User } from "lucide-react";

interface ScannersTabProps {
  language: "en" | "fr";
  selectedEventId?: string;
}

interface Scanner {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
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
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [editPassword, setEditPassword] = useState("");
  const [toggleLoading, setToggleLoading] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);
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
    const r = await fetcher(API_ROUTES.ADMIN_SCANNERS, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: createName.trim(), email: createEmail.trim().toLowerCase(), password: createPassword }) });
    if (r.ok) { setCreateOpen(false); setCreateName(""); setCreateEmail(""); setCreatePassword(""); await loadScanners(); }
  };

  const onEdit = async () => {
    if (!editScanner) return;
    const body: Record<string, unknown> = {};
    if (editName.trim()) body.name = editName.trim();
    if (editEmail.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editEmail)) body.email = editEmail.trim().toLowerCase();
    body.is_active = editActive;
    if (editPassword.length >= 8) body.password = editPassword;
    if (Object.keys(body).length === 0) return;
    const r = await fetcher(API_ROUTES.ADMIN_SCANNER(editScanner.id), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (r.ok) { setEditOpen(false); setEditScanner(null); setEditPassword(""); await loadScanners(); await loadStats(); }
  };

  const onDeactivate = async (s: Scanner) => {
    const r = await fetcher(API_ROUTES.ADMIN_SCANNER(s.id), { method: "DELETE" });
    if (r.ok) await loadScanners();
  };

  const t = language === "en" ? { start: "Start Scan", stop: "Stop Scan", toggleScan: "Toggle Scan", status: "Status", on: "ON", off: "OFF", scanners: "Scanners", create: "Create Scanner", name: "Name", email: "Email", password: "Password", active: "Active", actions: "Actions", edit: "Edit", deactivate: "Deactivate", all: "All Scanners", total: "Total", valid: "Valid", invalid: "Invalid", alreadyScanned: "Already scanned", wrongEvent: "Wrong event", history: "History", time: "Time", result: "Result", buyer: "Buyer", pass: "Pass", ambassador: "Ambassador", event: "Event", scanner: "Scanner", noScans: "No scans", remainingValidPasses: "Remaining valid passes", scannerPerformance: "Scanner performance", selectEventHint: "Select an event to see remaining valid passes", processing: "Processing...", remainingVsStatus: "Remaining valid vs scan statuses" } : { start: "Démarrer le scan", stop: "Arrêter le scan", toggleScan: "Basculer le scan", status: "État", on: "ACTIF", off: "INACTIF", scanners: "Scanners", create: "Créer un scanner", name: "Nom", email: "Email", password: "Mot de passe", active: "Actif", actions: "Actions", edit: "Modifier", deactivate: "Désactiver", all: "Tous les scanners", total: "Total", valid: "Valide", invalid: "Invalide", alreadyScanned: "Déjà scanné", wrongEvent: "Mauvais événement", history: "Historique", time: "Heure", result: "Résultat", buyer: "Acheteur", pass: "Pass", ambassador: "Ambassadeur", event: "Événement", scanner: "Scanner", noScans: "Aucun scan", remainingValidPasses: "Pass valides restants", scannerPerformance: "Performance des scanners", selectEventHint: "Sélectionnez un événement pour voir les pass valides restants", processing: "Traitement...", remainingVsStatus: "Pass valides restants vs statuts de scan" };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">{t.scanners}</h2>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">{t.status} – {config?.enabled ? t.on : t.off}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            onClick={onToggleScan}
            disabled={configLoading || toggleLoading || !config}
            className={config?.enabled ? "bg-[#EF4444] hover:bg-[#dc2626] text-white" : "bg-[#10B981] hover:bg-[#0d9668] text-white"}
          >
            <Power className="w-4 h-4 mr-2" />
            {toggleLoading ? t.processing : config?.enabled ? t.stop : t.start}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { loadConfig(); loadScanners(); loadStats(); loadScans(); }}><RefreshCw className="w-4 h-4" /></Button>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-foreground">{t.scanners}</CardTitle>
          <Button onClick={() => setCreateOpen(true)} className="bg-[#E21836] hover:bg-[#c4142e]"><Plus className="w-4 h-4 mr-2" />{t.create}</Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="text-muted-foreground">{t.name}</TableHead>
                <TableHead className="text-muted-foreground">{t.email}</TableHead>
                <TableHead className="text-muted-foreground">{t.active}</TableHead>
                <TableHead className="text-muted-foreground">{t.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scanners.map((s) => (
                <TableRow key={s.id} className="border-border">
                  <TableCell className="text-foreground">{s.name}</TableCell>
                  <TableCell className="text-muted-foreground">{s.email}</TableCell>
                  <TableCell><span className={s.is_active ? "text-[#10B981]" : "text-[#EF4444]"}>{s.is_active ? "✓" : "✗"}</span></TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground mr-2" onClick={() => { setEditScanner(s); setEditName(s.name); setEditEmail(s.email); setEditActive(s.is_active); setEditPassword(""); setEditOpen(true); }}>{t.edit}</Button>
                    {s.is_active && <Button variant="ghost" size="sm" className="text-[#EF4444]" onClick={() => onDeactivate(s)}>{t.deactivate}</Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
              <div className="rounded-lg bg-muted/40 border border-border p-3">
                <p className="text-xs text-muted-foreground mb-1">{t.total}</p>
                <p className="text-lg font-bold" style={{ color: "#E21836" }}>{(stats.total ?? 0).toLocaleString()}</p>
              </div>
              <div className="rounded-lg bg-muted/40 border border-border p-3">
                <p className="text-xs text-muted-foreground mb-1">{t.valid}</p>
                <p className="text-lg font-bold" style={{ color: "#10B981" }}>{(stats.byStatus.valid ?? 0).toLocaleString()}</p>
              </div>
              <div className="rounded-lg bg-muted/40 border border-border p-3">
                <p className="text-xs text-muted-foreground mb-1">{t.alreadyScanned}</p>
                <p className="text-lg font-bold" style={{ color: "#F59E0B" }}>{(stats.byStatus.already_scanned ?? 0).toLocaleString()}</p>
              </div>
              <div className="rounded-lg bg-muted/40 border border-border p-3">
                <p className="text-xs text-muted-foreground mb-1">{t.invalid}</p>
                <p className="text-lg font-bold" style={{ color: "#EF4444" }}>{(stats.byStatus.invalid ?? 0).toLocaleString()}</p>
              </div>
              <div className="rounded-lg bg-muted/40 border border-border p-3">
                <p className="text-xs text-muted-foreground mb-1">{t.wrongEvent}</p>
                <p className="text-lg font-bold" style={{ color: "#EF4444" }}>{(stats.byStatus.wrong_event ?? 0).toLocaleString()}</p>
              </div>
            </div>
            <div className="rounded-lg bg-muted/40 border border-border p-3">
              <p className="text-xs text-muted-foreground mb-1">{t.remainingValidPasses}</p>
              <p className="text-lg font-bold" style={{ color: "#22C55E" }}>
                {validSelectedEventId
                  ? ((stats.remainingValidPasses ?? 0).toLocaleString())
                  : "—"}
              </p>
              {!validSelectedEventId && (
                <p className="text-xs text-muted-foreground/80 mt-1">{t.selectEventHint}</p>
              )}
            </div>
            {validSelectedEventId && (
              <div className="rounded-lg bg-muted/40 border border-border p-3">
                <p className="text-xs text-muted-foreground mb-2">{t.remainingVsStatus}</p>
                <p className="text-xs text-muted-foreground">{t.remainingValidPasses}: <span className="text-[#22C55E] font-semibold">{(stats.remainingValidPasses ?? 0).toLocaleString()}</span></p>
                <p className="text-xs text-muted-foreground">{t.valid}: <span className="text-[#10B981] font-semibold">{(stats.byStatus.valid ?? 0).toLocaleString()}</span></p>
                <p className="text-xs text-muted-foreground">{t.alreadyScanned}: <span className="text-[#F59E0B] font-semibold">{(stats.byStatus.already_scanned ?? 0).toLocaleString()}</span></p>
                <p className="text-xs text-muted-foreground">{t.invalid}: <span className="text-[#EF4444] font-semibold">{(stats.byStatus.invalid ?? 0).toLocaleString()}</span></p>
                <p className="text-xs text-muted-foreground">{t.wrongEvent}: <span className="text-[#EF4444] font-semibold">{(stats.byStatus.wrong_event ?? 0).toLocaleString()}</span></p>
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
                  <TableHead className="text-muted-foreground">{t.time}</TableHead>
                  <TableHead className="text-muted-foreground">{t.result}</TableHead>
                  <TableHead className="text-muted-foreground">{t.buyer}</TableHead>
                  <TableHead className="text-muted-foreground">{t.pass}</TableHead>
                  <TableHead className="text-muted-foreground">{t.ambassador}</TableHead>
                  <TableHead className="text-muted-foreground">{t.event}</TableHead>
                  {!selectedId && <TableHead className="text-muted-foreground">{t.scanner}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {scans.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">{t.noScans}</TableCell></TableRow>
                ) : scans.map((r) => (
                  <TableRow key={r.id} className="border-border">
                    <TableCell className="text-foreground">{r.scan_time ? format(new Date(r.scan_time), "PPp") : "—"}</TableCell>
                    <TableCell><span className={r.scan_result === "valid" ? "text-[#10B981]" : r.scan_result === "already_scanned" ? "text-[#F59E0B]" : "text-[#EF4444]"}>{r.scan_result}</span></TableCell>
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="text-foreground">{t.create}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label className="text-muted-foreground">{t.name}</Label>
            <Input value={createName} onChange={e => setCreateName(e.target.value)} />
            <Label className="text-muted-foreground">{t.email}</Label>
            <Input type="email" value={createEmail} onChange={e => setCreateEmail(e.target.value)} />
            <Label className="text-muted-foreground">{t.password} (min 8)</Label>
            <Input type="password" value={createPassword} onChange={e => setCreatePassword(e.target.value)} />
            <Button className="w-full bg-[#E21836] hover:bg-[#c4142e]" onClick={onCreate}>Create</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="text-foreground">{t.edit}</DialogTitle></DialogHeader>
          {editScanner && (
            <div className="space-y-3">
              <Label className="text-muted-foreground">{t.name}</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} />
              <Label className="text-muted-foreground">{t.email}</Label>
              <Input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} />
              <div className="flex items-center gap-2">
                <Switch checked={editActive} onCheckedChange={setEditActive} />
                <Label className="text-muted-foreground">{t.active}</Label>
              </div>
              <Label className="text-muted-foreground">{t.password} (leave blank to keep)</Label>
              <Input type="password" value={editPassword} onChange={e => setEditPassword(e.target.value)} placeholder="••••••••" />
              <Button className="w-full bg-[#E21836] hover:bg-[#c4142e]" onClick={onEdit}>Save</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
