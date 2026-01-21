import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getApiBaseUrl } from "@/lib/api-routes";
import { API_ROUTES } from "@/lib/api-routes";
import { format } from "date-fns";
import { LogOut, ArrowLeft } from "lucide-react";

interface Scan {
  id: string;
  scan_time: string;
  scan_result: string;
  buyer_name: string | null;
  pass_type: string | null;
  ambassador_name: string | null;
  event_name: string | null;
}

interface Stats {
  total: number;
  byStatus: Record<string, number>;
  byPass: Record<string, number>;
}

export default function ScannerHistory() {
  const navigate = useNavigate();
  const [scans, setScans] = useState<Scan[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [rScans, rStats] = await Promise.all([
          fetch(`${getApiBaseUrl()}${API_ROUTES.SCANNER_SCANS}`, { credentials: "include" }),
          fetch(`${getApiBaseUrl()}${API_ROUTES.SCANNER_STATISTICS}`, { credentials: "include" }),
        ]);
        if (rScans.status === 401 || rStats.status === 401) {
          navigate("/scanner/login", { replace: true });
          return;
        }
        const dScans = await rScans.json().catch(() => ({}));
        const dStats = await rStats.json().catch(() => ({}));
        setScans(dScans.scans || []);
        setStats({ total: dStats.total ?? 0, byStatus: dStats.byStatus || {}, byPass: dStats.byPass || {} });
      } catch {
        setScans([]);
        setStats(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  const logout = async () => {
    try {
      await fetch(`${getApiBaseUrl()}${API_ROUTES.SCANNER_LOGOUT}`, { method: "POST", credentials: "include" });
    } catch {}
    navigate("/scanner/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#1A1A1A] p-4 pb-24">
      <div className="max-w-lg mx-auto">
        <div className="flex justify-between items-center mb-4">
          <Button variant="ghost" size="icon" className="text-[#B0B0B0]" onClick={() => navigate("/scanner/events")}><ArrowLeft className="w-5 h-5" /></Button>
          <h1 className="text-lg font-semibold text-white">History</h1>
          <Button variant="ghost" size="icon" className="text-[#B0B0B0]" onClick={logout}><LogOut className="w-5 h-5" /></Button>
        </div>

        {stats && (
          <Card className="bg-[#1F1F1F] border-[#2A2A2A] mb-4">
            <CardContent className="p-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-[#252525] border border-[#2A2A2A] p-2">
                  <p className="text-[10px] text-[#B0B0B0] uppercase tracking-wide">Total</p>
                  <p className="text-base font-bold" style={{ color: "#E21836" }}>{(stats.total ?? 0).toLocaleString()}</p>
                </div>
                <div className="rounded-lg bg-[#252525] border border-[#2A2A2A] p-2">
                  <p className="text-[10px] text-[#B0B0B0] uppercase tracking-wide">Valid</p>
                  <p className="text-base font-bold" style={{ color: "#10B981" }}>{(stats.byStatus.valid ?? 0).toLocaleString()}</p>
                </div>
                <div className="rounded-lg bg-[#252525] border border-[#2A2A2A] p-2">
                  <p className="text-[10px] text-[#B0B0B0] uppercase tracking-wide">Already scanned</p>
                  <p className="text-base font-bold" style={{ color: "#F59E0B" }}>{(stats.byStatus.already_scanned ?? 0).toLocaleString()}</p>
                </div>
                <div className="rounded-lg bg-[#252525] border border-[#2A2A2A] p-2">
                  <p className="text-[10px] text-[#B0B0B0] uppercase tracking-wide">Invalid</p>
                  <p className="text-base font-bold" style={{ color: "#EF4444" }}>{(stats.byStatus.invalid ?? 0).toLocaleString()}</p>
                </div>
                <div className="rounded-lg bg-[#252525] border border-[#2A2A2A] p-2">
                  <p className="text-[10px] text-[#B0B0B0] uppercase tracking-wide">Wrong event</p>
                  <p className="text-base font-bold" style={{ color: "#EF4444" }}>{(stats.byStatus.wrong_event ?? 0).toLocaleString()}</p>
                </div>
              </div>
              {Object.keys(stats.byPass || {}).length > 0 && (
                <p className="text-xs text-[#B0B0B0] mt-3 pt-2 border-t border-[#2A2A2A]">By pass: {Object.entries(stats.byPass).map(([k, v]) => `${k}: ${v}`).join(", ")}</p>
              )}
            </CardContent>
          </Card>
        )}

        {loading ? <p className="text-[#B0B0B0]">Loading…</p> : scans.length === 0 ? <p className="text-[#B0B0B0]">No scans yet.</p> : (
          <div className="space-y-2">
            {scans.map((s) => (
              <Card key={s.id} className="bg-[#1F1F1F] border-[#2A2A2A]">
                <CardContent className="p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-white font-medium">{s.buyer_name || "—"}</p>
                      <p className="text-sm text-[#B0B0B0]">{s.pass_type || "—"} · {s.scan_result}</p>
                      <p className="text-xs text-[#B0B0B0]">{s.scan_time ? format(new Date(s.scan_time), "PPp") : ""}</p>
                    </div>
                    <span className={`text-xs font-medium ${s.scan_result === "valid" ? "text-[#10B981]" : s.scan_result === "already_scanned" ? "text-[#F59E0B]" : "text-[#EF4444]"}`}>{s.scan_result}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
