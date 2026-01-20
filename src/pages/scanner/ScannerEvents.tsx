import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getApiBaseUrl } from "@/lib/api-routes";
import { API_ROUTES } from "@/lib/api-routes";
import { format } from "date-fns";
import { QrCode, LogOut, History } from "lucide-react";

const STORAGE_KEY = "scanner_selected_event";

interface Evt {
  id: string;
  name: string;
  date: string;
  venue: string;
  city?: string;
}

export default function ScannerEvents() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<Evt[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const r = await fetch(`${getApiBaseUrl()}${API_ROUTES.SCANNER_EVENTS}`, { credentials: "include" });
        if (r.status === 401) {
          navigate("/scanner/login", { replace: true });
          return;
        }
        if (r.status === 503) {
          setErr("Scan system is not started");
          setEvents([]);
          return;
        }
        const d = await r.json().catch(() => ({}));
        setEvents(d.events || []);
      } catch {
        setErr("Network error");
        setEvents([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  const select = (e: Evt) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: e.id, name: e.name, date: e.date, venue: e.venue, city: e.city }));
    } catch {}
    navigate("/scanner/scan");
  };

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
          <h1 className="text-lg font-semibold text-white">Select Event</h1>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" className="text-[#B0B0B0]" onClick={() => navigate("/scanner/history")}><History className="w-5 h-5" /></Button>
            <Button variant="ghost" size="icon" className="text-[#B0B0B0]" onClick={logout}><LogOut className="w-5 h-5" /></Button>
          </div>
        </div>
        {err && <p className="text-[#EF4444] mb-3">{err}</p>}
        {loading ? <p className="text-[#B0B0B0]">Loading…</p> : events.length === 0 ? <p className="text-[#B0B0B0]">No upcoming events.</p> : (
          <div className="space-y-3">
            {events.map((e) => (
              <Card key={e.id} className="bg-[#1F1F1F] border-[#2A2A2A] cursor-pointer hover:border-[#E21836]/50 transition-colors" onClick={() => select(e)}>
                <CardContent className="p-4 flex items-center gap-3">
                  <QrCode className="w-8 h-8 text-[#E21836] shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-white truncate">{e.name}</p>
                    <p className="text-sm text-[#B0B0B0]">{e.date ? format(new Date(e.date), "PPp") : ""} · {e.venue || ""}</p>
                  </div>
                  <Button size="sm" className="bg-[#E21836] hover:bg-[#c4142e] shrink-0">Select</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
