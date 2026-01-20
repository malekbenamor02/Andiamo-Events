import React, { useState, useEffect } from "react";
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
import { Plus, RefreshCw, Play, Square, User } from "lucide-react";

interface ScannersTabProps {
  language: "en" | "fr";
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

export function ScannersTab({ language }: ScannersTabProps) {
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

  const loadConfig = async () => {
    const r = await fetcher(API_ROUTES.ADMIN_SCAN_SYSTEM_CONFIG);
    if (r.ok) {
      const d = await r.json();
      setConfig({ enabled: d.enabled, updated_at: d.updated_at, updated_by: d.updated_by, updated_by_name: d.updated_by_name ?? null });
    } else setConfig({ enabled: false, updated_at: null, updated_by: null, updated_by_name: null });
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
      if (selectedId) {
        const r = await fetcher(`${API_ROUTES.ADMIN_SCANNER_STATISTICS(selectedId)}`);
        if (r.ok) {
          const d = await r.json();
          setStats({ total: d.total, byStatus: d.byStatus || {}, byPass: d.byPass || {} });
        }
      } else {
        const r = await fetcher(API_ROUTES.ADMIN_SCAN_STATISTICS);
        if (r.ok) {
          const d = await r.json();
          setStats({ total: d.total, byStatus: d.byStatus || {}, byPass: d.byPass || {}, byScanner: d.byScanner });
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const loadScans = async () => {
    setLoading(true);
    try {
      const u = selectedId ? `${API_ROUTES.ADMIN_SCANNER_SCANS(selectedId)}` : `${API_ROUTES.ADMIN_SCAN_HISTORY}`;
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
  useEffect(() => { loadStats(); loadScans(); }, [selectedId]);

  const onStart = async () => {
    const r = await fetcher(API_ROUTES.ADMIN_SCAN_SYSTEM_CONFIG, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scan_enabled: true }) });
    if (r.ok) await loadConfig();
  };

  const onStop = async () => {
    const r = await fetcher(API_ROUTES.ADMIN_SCAN_SYSTEM_CONFIG, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scan_enabled: false }) });
    if (r.ok) await loadConfig();
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

  const t = language === "en" ? { start: "Start Scan", stop: "Stop Scan", status: "Status", on: "ON", off: "OFF", scanners: "Scanners", create: "Create Scanner", name: "Name", email: "Email", password: "Password", active: "Active", actions: "Actions", edit: "Edit", deactivate: "Deactivate", all: "All Scanners", total: "Total", valid: "Valid", invalid: "Invalid", alreadyScanned: "Already scanned", expired: "Expired", wrongEvent: "Wrong event", history: "History", time: "Time", result: "Result", buyer: "Buyer", pass: "Pass", ambassador: "Ambassador", event: "Event", scanner: "Scanner", noScans: "No scans" } : { start: "Démarrer le scan", stop: "Arrêter le scan", status: "État", on: "ACTIF", off: "INACTIF", scanners: "Scanners", create: "Créer un scanner", name: "Nom", email: "Email", password: "Mot de passe", active: "Actif", actions: "Actions", edit: "Modifier", deactivate: "Désactiver", all: "Tous les scanners", total: "Total", valid: "Valide", invalid: "Invalide", alreadyScanned: "Déjà scanné", expired: "Expiré", wrongEvent: "Mauvais événement", history: "Historique", time: "Heure", result: "Résultat", buyer: "Acheteur", pass: "Pass", ambassador: "Ambassadeur", event: "Événement", scanner: "Scanner", noScans: "Aucun scan" };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">{t.scanners}</h2>
      </div>

      <Card className="bg-[#1F1F1F] border-[#2A2A2A]">
        <CardHeader>
          <CardTitle className="text-white">{t.status} – {config?.enabled ? t.on : t.off}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button onClick={onStart} disabled={config?.enabled === true} className="bg-[#10B981] hover:bg-[#0d9668] text-white">
            <Play className="w-4 h-4 mr-2" />{t.start}
          </Button>
          <Button onClick={onStop} disabled={config?.enabled === false} variant="outline" className="border-[#EF4444] text-[#EF4444] hover:bg-[#EF4444]/10">
            <Square className="w-4 h-4 mr-2" />{t.stop}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { loadConfig(); loadScanners(); loadStats(); loadScans(); }}><RefreshCw className="w-4 h-4" /></Button>
        </CardContent>
      </Card>

      <Card className="bg-[#1F1F1F] border-[#2A2A2A]">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-white">{t.scanners}</CardTitle>
          <Button onClick={() => setCreateOpen(true)} className="bg-[#E21836] hover:bg-[#c4142e]"><Plus className="w-4 h-4 mr-2" />{t.create}</Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-[#2A2A2A]">
                <TableHead className="text-[#B0B0B0]">{t.name}</TableHead>
                <TableHead className="text-[#B0B0B0]">{t.email}</TableHead>
                <TableHead className="text-[#B0B0B0]">{t.active}</TableHead>
                <TableHead className="text-[#B0B0B0]">{t.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scanners.map((s) => (
                <TableRow key={s.id} className="border-[#2A2A2A]">
                  <TableCell className="text-white">{s.name}</TableCell>
                  <TableCell className="text-[#B0B0B0]">{s.email}</TableCell>
                  <TableCell><span className={s.is_active ? "text-[#10B981]" : "text-[#EF4444]"}>{s.is_active ? "✓" : "✗"}</span></TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" className="text-[#B0B0B0] hover:text-white mr-2" onClick={() => { setEditScanner(s); setEditName(s.name); setEditEmail(s.email); setEditActive(s.is_active); setEditPassword(""); setEditOpen(true); }}>{t.edit}</Button>
                    {s.is_active && <Button variant="ghost" size="sm" className="text-[#EF4444]" onClick={() => onDeactivate(s)}>{t.deactivate}</Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <Label className="text-[#B0B0B0]">{language === "en" ? "View" : "Vue"}:</Label>
        <Select value={selectedId ?? "all"} onValueChange={(v) => setSelectedId(v === "all" ? null : v)}>
          <SelectTrigger className="w-[220px] bg-[#252525] border-[#2A2A2A] text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.all}</SelectItem>
            {scanners.filter(s => s.is_active).map(s => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>

      {stats && (
        <Card className="bg-[#1F1F1F] border-[#2A2A2A]">
          <CardHeader><CardTitle className="text-white">{t.total}: {stats.total} | {t.valid}: {stats.byStatus.valid ?? 0} | {t.alreadyScanned}: {stats.byStatus.already_scanned ?? 0} | {t.invalid}: {stats.byStatus.invalid ?? 0} | {t.expired}: {stats.byStatus.expired ?? 0} | {t.wrongEvent}: {stats.byStatus.wrong_event ?? 0}</CardTitle></CardHeader>
          {Object.keys(stats.byPass || {}).length > 0 && (
            <CardContent className="text-[#B0B0B0]">By pass: {Object.entries(stats.byPass).map(([k, v]) => `${k}: ${v}`).join(", ")}</CardContent>
          )}
        </Card>
      )}

      <Card className="bg-[#1F1F1F] border-[#2A2A2A]">
        <CardHeader><CardTitle className="text-white">{t.history}</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p className="text-[#B0B0B0]">Loading…</p> : (
            <Table>
              <TableHeader>
                <TableRow className="border-[#2A2A2A]">
                  <TableHead className="text-[#B0B0B0]">{t.time}</TableHead>
                  <TableHead className="text-[#B0B0B0]">{t.result}</TableHead>
                  <TableHead className="text-[#B0B0B0]">{t.buyer}</TableHead>
                  <TableHead className="text-[#B0B0B0]">{t.pass}</TableHead>
                  <TableHead className="text-[#B0B0B0]">{t.ambassador}</TableHead>
                  <TableHead className="text-[#B0B0B0]">{t.event}</TableHead>
                  {!selectedId && <TableHead className="text-[#B0B0B0]">{t.scanner}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {scans.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-[#B0B0B0]">{t.noScans}</TableCell></TableRow>
                ) : scans.map((r) => (
                  <TableRow key={r.id} className="border-[#2A2A2A]">
                    <TableCell className="text-white">{r.scan_time ? format(new Date(r.scan_time), "PPp") : "—"}</TableCell>
                    <TableCell><span className={r.scan_result === "valid" ? "text-[#10B981]" : r.scan_result === "already_scanned" ? "text-[#F59E0B]" : "text-[#EF4444]"}>{r.scan_result}</span></TableCell>
                    <TableCell className="text-[#B0B0B0]">{r.buyer_name || "—"}</TableCell>
                    <TableCell className="text-[#B0B0B0]">{r.pass_type || "—"}</TableCell>
                    <TableCell className="text-[#B0B0B0]">{r.ambassador_name || "—"}</TableCell>
                    <TableCell className="text-[#B0B0B0]">{r.event_name || "—"}</TableCell>
                    {!selectedId && <TableCell className="text-[#B0B0B0]">{r.scanner_name || "—"}</TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-[#1F1F1F] border-[#2A2A2A]">
          <DialogHeader><DialogTitle className="text-white">{t.create}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label className="text-[#B0B0B0]">{t.name}</Label>
            <Input className="bg-[#252525] border-[#2A2A2A] text-white" value={createName} onChange={e => setCreateName(e.target.value)} />
            <Label className="text-[#B0B0B0]">{t.email}</Label>
            <Input className="bg-[#252525] border-[#2A2A2A] text-white" type="email" value={createEmail} onChange={e => setCreateEmail(e.target.value)} />
            <Label className="text-[#B0B0B0]">{t.password} (min 8)</Label>
            <Input className="bg-[#252525] border-[#2A2A2A] text-white" type="password" value={createPassword} onChange={e => setCreatePassword(e.target.value)} />
            <Button className="w-full bg-[#E21836] hover:bg-[#c4142e]" onClick={onCreate}>Create</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-[#1F1F1F] border-[#2A2A2A]">
          <DialogHeader><DialogTitle className="text-white">{t.edit}</DialogTitle></DialogHeader>
          {editScanner && (
            <div className="space-y-3">
              <Label className="text-[#B0B0B0]">{t.name}</Label>
              <Input className="bg-[#252525] border-[#2A2A2A] text-white" value={editName} onChange={e => setEditName(e.target.value)} />
              <Label className="text-[#B0B0B0]">{t.email}</Label>
              <Input className="bg-[#252525] border-[#2A2A2A] text-white" type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} />
              <div className="flex items-center gap-2">
                <Switch checked={editActive} onCheckedChange={setEditActive} />
                <Label className="text-[#B0B0B0]">{t.active}</Label>
              </div>
              <Label className="text-[#B0B0B0]">{t.password} (leave blank to keep)</Label>
              <Input className="bg-[#252525] border-[#2A2A2A] text-white" type="password" value={editPassword} onChange={e => setEditPassword(e.target.value)} placeholder="••••••••" />
              <Button className="w-full bg-[#E21836] hover:bg-[#c4142e]" onClick={onEdit}>Save</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
