import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getApiBaseUrl } from "@/lib/api-routes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import Loader from "@/components/ui/Loader";
import { Store, LogOut, ShoppingCart, Minus, Plus, CheckCircle, AlertCircle } from "lucide-react";

interface PosDashboardProps {
  outletSlug: string;
  language: "en" | "fr";
}

interface Event {
  id: string;
  name: string;
  date: string;
  venue?: string;
}

interface Pass {
  id: string;
  name: string;
  price: number;
  remaining: number | null;
  sold_quantity: number;
}

export default function PosDashboard({ outletSlug, language }: PosDashboardProps) {
  const navigate = useNavigate();
  const [auth, setAuth] = useState<{ pos_user: { name: string }; outlet: { name: string } } | null>(null);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<Event[]>([]);
  const [passes, setPasses] = useState<Pass[]>([]);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [customer, setCustomer] = useState({ full_name: "", phone: "", email: "", city: "", ville: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    (async () => {
      const r = await fetch(`${getApiBaseUrl()}/api/pos/${outletSlug}/verify`, { credentials: "include" });
      if (!r.ok) { navigate(`/pos/${outletSlug}/login`, { replace: true }); return; }
      const d = await r.json();
      setAuth(d);
      // Fetch events before showing the form so we can pre-select the upcoming event
      const er = await fetch(`${getApiBaseUrl()}/api/pos/${outletSlug}/events`, { credentials: "include" });
      if (er.ok) {
        const list = (await er.json()) || [];
        const valid = (Array.isArray(list) ? list : []).filter((e: Event) => e?.id != null && String(e.id).trim() !== "");
        setEvents(valid);
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const upcoming = valid.find((e: Event) => e.date && new Date(e.date).getTime() >= todayStart.getTime()) || valid[0];
        if (upcoming?.id) setSelectedEvent(upcoming.id);
      } else setEvents([]);
      setLoading(false);
    })();
  }, [outletSlug, navigate]);

  useEffect(() => {
    if (!selectedEvent) { setPasses([]); setQuantities({}); return; }
    (async () => {
      const r = await fetch(`${getApiBaseUrl()}/api/pos/${outletSlug}/passes/${selectedEvent}`, { credentials: "include" });
      if (r.ok) {
        const list = await r.json();
        const valid = (Array.isArray(list) ? list : []).filter((p: Pass) => p?.id != null && String(p.id).trim() !== "");
        setPasses(valid);
        setQuantities(valid.reduce((a: Record<string, number>, p: Pass) => ({ ...a, [p.id]: 0 }), {}));
      } else setPasses([]);
    })();
  }, [outletSlug, selectedEvent]);

  const logout = async () => {
    await fetch(`${getApiBaseUrl()}/api/pos/${outletSlug}/logout`, { method: "POST", credentials: "include" });
    navigate(`/pos/${outletSlug}/login`, { replace: true });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccess("");
    const items = passes.filter(p => (quantities[p.id] || 0) > 0).map(p => ({ passId: p.id, passName: p.name, quantity: quantities[p.id], price: p.price }));
    if (items.length === 0) { setError(language === "en" ? "Select at least one pass" : "Sélectionnez au moins un pass"); return; }
    if (!customer.full_name?.trim() || !customer.phone?.trim() || !customer.email?.trim()) { setError(language === "en" ? "Full name, phone, email required" : "Nom, tél., email requis"); return; }
    setSubmitting(true);
    try {
      const r = await fetch(`${getApiBaseUrl()}/api/pos/${outletSlug}/orders/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          customerInfo: { full_name: customer.full_name.trim(), phone: customer.phone.trim(), email: customer.email.trim(), city: customer.city?.trim() || undefined, ville: customer.ville?.trim() || undefined },
          passes: items,
          eventId: selectedEvent,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.success) {
        setSuccess(language === "en" ? "Order created. Client will receive SMS and email." : "Commande créée. SMS et email envoyés.");
        setQuantities(passes.reduce((a, p) => ({ ...a, [p.id]: 0 }), {}));
        setCustomer({ full_name: "", phone: "", email: "", city: "", ville: "" });
        const list = await fetch(`${getApiBaseUrl()}/api/pos/${outletSlug}/passes/${selectedEvent}`, { credentials: "include" }).then(x => x.json()).catch(() => []);
        setPasses(list);
      } else setError(d.error || "Error");
    } finally {
      setSubmitting(false);
    }
  };

  const t = language === "en"
    ? { title: "Point de Vente", event: "Event", pass: "Pass", qty: "Qty", price: "Price", remaining: "Left", customer: "Customer", fullName: "Full name", phone: "Phone", email: "Email", city: "City", ville: "Ville", create: "Create order", logout: "Logout", successTitle: "Success", errorTitle: "Error", ok: "OK" }
    : { title: "Point de Vente", event: "Événement", pass: "Pass", qty: "Qté", price: "Prix", remaining: "Reste", customer: "Client", fullName: "Nom complet", phone: "Téléphone", email: "Email", city: "Ville", ville: "Quartier", create: "Créer la commande", logout: "Déconnexion", successTitle: "Succès", errorTitle: "Erreur", ok: "OK" };

  if (loading) return <div className="min-h-screen bg-[#1A1A1A] flex items-center justify-center"><Loader size="lg" className="[background:#E21836]" /></div>;

  return (
    <div className="min-h-screen bg-[#1A1A1A] p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-xl font-bold flex items-center gap-2 text-white"><Store className="w-6 h-6" style={{ color: "#E21836" }} />{auth?.outlet?.name} — {auth?.pos_user?.name}</h1>
          <Button variant="ghost" size="sm" className="text-[#B0B0B0]" onClick={logout}><LogOut className="w-4 h-4 mr-1" />{t.logout}</Button>
        </div>

        <Card className="bg-[#1F1F1F] border-[#2A2A2A] mb-6">
          <CardHeader><CardTitle className="text-white flex items-center gap-2"><ShoppingCart className="w-5 h-5" style={{ color: "#E21836" }} />{t.create}</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label className="text-[#B0B0B0]">{t.event}</Label>
                <Select value={selectedEvent} onValueChange={setSelectedEvent}>
                  <SelectTrigger className="mt-1 bg-[#252525] border-[#2A2A2A] text-white"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {events
                      .filter((e) => e?.id != null && String(e.id).trim() !== "")
                      .map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.name} {e.date ? new Date(e.date).toLocaleDateString() : ""}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              {passes.length > 0 && (
                <div>
                  <Label className="text-[#B0B0B0]">{t.pass}</Label>
                  <div className="mt-2 space-y-2">
                    {passes.map(p => {
                      const maxQ = Math.min(p.remaining != null ? p.remaining : 50, 50);
                      const q = quantities[p.id] ?? 0;
                      return (
                        <div key={p.id} className="flex items-center gap-3 flex-wrap">
                          <span className="text-white flex-1 min-w-[120px]">{p.name} — {p.price} DT</span>
                          <span className="text-[#888] text-sm">({t.remaining}: {p.remaining ?? "∞"})</span>
                          <div className="flex items-center gap-1">
                            <Button type="button" size="icon" variant="outline" className="h-9 w-9 rounded-lg bg-[#252525] border-[#2A2A2A] text-white hover:bg-[#2A2A2A] hover:border-[#3A3A3A]" onClick={() => setQuantities(x => ({ ...x, [p.id]: Math.max(0, (x[p.id] ?? 0) - 1) }))} disabled={q <= 0}>
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="flex h-9 min-w-[2.5rem] items-center justify-center rounded-lg bg-[#252525] border border-[#2A2A2A] px-2 text-white text-sm font-medium">{q}</span>
                            <Button type="button" size="icon" variant="outline" className="h-9 w-9 rounded-lg bg-[#252525] border-[#2A2A2A] text-white hover:bg-[#2A2A2A] hover:border-[#3A3A3A]" onClick={() => setQuantities(x => ({ ...x, [p.id]: Math.min(maxQ, (x[p.id] ?? 0) + 1) }))} disabled={q >= maxQ}>
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><Label className="text-[#B0B0B0]">{t.fullName} *</Label><Input className="mt-1 bg-[#252525] border-[#2A2A2A] text-white" value={customer.full_name} onChange={e => setCustomer(c => ({ ...c, full_name: e.target.value }))} required /></div>
                <div><Label className="text-[#B0B0B0]">{t.phone} *</Label><Input className="mt-1 bg-[#252525] border-[#2A2A2A] text-white" value={customer.phone} onChange={e => setCustomer(c => ({ ...c, phone: e.target.value }))} required /></div>
                <div><Label className="text-[#B0B0B0]">{t.email} *</Label><Input type="email" className="mt-1 bg-[#252525] border-[#2A2A2A] text-white" value={customer.email} onChange={e => setCustomer(c => ({ ...c, email: e.target.value }))} required /></div>
                <div><Label className="text-[#B0B0B0]">{t.city}</Label><Input className="mt-1 bg-[#252525] border-[#2A2A2A] text-white" value={customer.city} onChange={e => setCustomer(c => ({ ...c, city: e.target.value }))} /></div>
                <div><Label className="text-[#B0B0B0]">{t.ville}</Label><Input className="mt-1 bg-[#252525] border-[#2A2A2A] text-white" value={customer.ville} onChange={e => setCustomer(c => ({ ...c, ville: e.target.value }))} /></div>
              </div>
              <Button type="submit" disabled={submitting || !selectedEvent} className="w-full bg-[#E21836] hover:bg-[#c4142e]">{submitting ? <Loader size="sm" className="[background:white] shrink-0" /> : t.create}</Button>
            </form>
          </CardContent>
        </Card>

        <Dialog open={!!(success || error)} onOpenChange={(open) => { if (!open) { setSuccess(""); setError(""); } }}>
          <DialogContent className="bg-[#1F1F1F] border-[#2A2A2A] text-white">
            <DialogHeader>
              <DialogTitle className={success ? "text-[#10B981]" : "text-[#EF4444]"}>
                {success ? t.successTitle : t.errorTitle}
              </DialogTitle>
            </DialogHeader>
            <div className="flex items-center gap-2 py-2">
              {success ? (
                <CheckCircle className="h-5 w-5 shrink-0 text-[#10B981]" />
              ) : (
                <AlertCircle className="h-5 w-5 shrink-0 text-[#EF4444]" />
              )}
              <p className={success ? "text-[#10B981]" : "text-[#EF4444]"}>{success || error}</p>
            </div>
            <DialogFooter>
              <Button className="bg-[#E21836] hover:bg-[#c4142e]" onClick={() => { setSuccess(""); setError(""); }}>{t.ok}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
