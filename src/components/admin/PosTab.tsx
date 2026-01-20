import React, { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { getApiBaseUrl } from "@/lib/api-routes";
import { API_ROUTES } from "@/lib/api-routes";
import { format } from "date-fns";
import { Store, Building2, Users, Package, ShoppingCart, Activity, Plus, RefreshCw, Edit, Trash2, Copy, Check, X, Loader2, Eye, Mail, Send, BarChart3, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import { useToast } from "@/hooks/use-toast";

function fetcher(url: string, options?: RequestInit) {
  return fetch(`${getApiBaseUrl()}${url}`, { ...options, credentials: "include" });
}

interface PosTabProps {
  language: "en" | "fr";
}

interface Outlet {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
  link?: string;
}

interface PosUser {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  is_paused: boolean;
  pos_outlet_id: string;
  created_at: string;
}

interface StockRow {
  id: string;
  pos_outlet_id: string;
  event_id: string;
  pass_id: string;
  max_quantity: number | null;
  sold_quantity: number;
  remaining: number | null;
  is_active?: boolean;
  event_passes?: { id: string; name: string; price: number } | null;
}

interface PosOrder {
  id: string;
  order_number?: number | null;
  user_name: string;
  user_phone: string;
  user_email?: string | null;
  city?: string | null;
  ville?: string | null;
  total_price: number;
  status: string;
  created_at: string;
  pos_outlets?: { id: string; name: string; slug: string } | null;
  events?: { id: string; name: string; date?: string; venue?: string } | null;
  order_passes?: { pass_type: string; quantity: number; price: number }[];
}

interface AuditRow {
  id: string;
  action: string;
  performed_by_type: string;
  performed_by_email: string | null;
  pos_outlet_id: string | null;
  target_type: string;
  target_id: string;
  details?: unknown;
  created_at: string;
}

interface Event {
  id: string;
  name: string;
  date: string;
  venue?: string;
}

interface EventPass {
  id: string;
  name: string;
  price: number;
}

export function PosTab({ language }: PosTabProps) {
  const { toast } = useToast();
  const [subTab, setSubTab] = useState("outlets");
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [users, setUsers] = useState<PosUser[]>([]);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [orders, setOrders] = useState<PosOrder[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [passesByEvent, setPassesByEvent] = useState<Record<string, EventPass[]>>({});
  const [loading, setLoading] = useState(false);
  const [outletFilter, setOutletFilter] = useState<string>("__all__");
  const [eventFilter, setEventFilter] = useState<string>("__all__");
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>("__all__");
  const [createOutlet, setCreateOutlet] = useState(false);
  const [editOutlet, setEditOutlet] = useState<Outlet | null>(null);
  const [createUser, setCreateUser] = useState(false);
  const [editUser, setEditUser] = useState<PosUser | null>(null);
  const [addStock, setAddStock] = useState(false);
  const [editStock, setEditStock] = useState<StockRow | null>(null);
  const [form, setForm] = useState<Record<string, string | number>>({});
  const [selectedOrder, setSelectedOrder] = useState<PosOrder | null>(null);
  const [orderDetailEmail, setOrderDetailEmail] = useState("");
  const [orderDetailSaving, setOrderDetailSaving] = useState(false);
  const [orderDetailResendLoading, setOrderDetailResendLoading] = useState(false);
  const [stats, setStats] = useState<{ byOutlet: { outlet_id: string; outlet_name: string; total_orders: number; total_revenue: number; by_status: Record<string, number>; by_pass_type: Record<string, number> }[]; daily: { date: string; orders: number; revenue: number }[]; totalOrders: number; totalRevenue: number; byPassType: Record<string, number>; byStatus: Record<string, number> } | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsOutletFilter, setStatsOutletFilter] = useState<string>("__all__");
  const [statsFrom, setStatsFrom] = useState("");
  const [statsTo, setStatsTo] = useState("");
  const [addStockExistingPassIds, setAddStockExistingPassIds] = useState<string[]>([]);
  const [togglingStockId, setTogglingStockId] = useState<string | null>(null);

  const loadOutlets = async () => {
    const r = await fetcher(API_ROUTES.ADMIN_POS_OUTLETS);
    if (r.ok) setOutlets(await r.json()); else setOutlets([]);
  };
  const outletId = (outletFilter && outletFilter !== "__all__" && outletFilter !== "__none__") ? outletFilter : null;
  const loadUsers = async () => {
    const u = outletId ? `${API_ROUTES.ADMIN_POS_USERS}?pos_outlet_id=${outletId}` : API_ROUTES.ADMIN_POS_USERS;
    const r = await fetcher(u);
    if (r.ok) setUsers(await r.json()); else setUsers([]);
  };
  const loadStock = async () => {
    if (!outletId) { setStock([]); return; }
    const u = `${API_ROUTES.ADMIN_POS_STOCK}?pos_outlet_id=${outletId}${(eventFilter && eventFilter !== "__all__") ? `&event_id=${eventFilter}` : ""}`;
    const r = await fetcher(u);
    if (r.ok) setStock(await r.json()); else setStock([]);
  };
  const loadOrders = async () => {
    const q = new URLSearchParams();
    if (orderStatusFilter && orderStatusFilter !== "__all__") q.set("status", orderStatusFilter);
    if (outletId) q.set("pos_outlet_id", outletId);
    const r = await fetcher(`${API_ROUTES.ADMIN_POS_ORDERS}?${q}`);
    if (r.ok) setOrders(await r.json()); else setOrders([]);
  };
  const loadAudit = async () => {
    const r = await fetcher(API_ROUTES.ADMIN_POS_AUDIT_LOG);
    if (r.ok) setAudit(await r.json()); else setAudit([]);
  };
  const loadEvents = async () => {
    const r = await fetcher(API_ROUTES.ADMIN_POS_EVENTS);
    if (r.ok) setEvents(await r.json()); else setEvents([]);
  };
  const loadPasses = async (eventId: string) => {
    if (passesByEvent[eventId]) return;
    const r = await fetcher(`${getApiBaseUrl()}/api/admin/passes/${eventId}`);
    if (r.ok) {
      const d = await r.json();
      setPassesByEvent(prev => ({ ...prev, [eventId]: (d.passes || d)?.map((p: { id: string; name: string; price: number }) => ({ id: p.id, name: p.name, price: p.price })) || [] }));
    }
  };

  const loadStats = async () => {
    setStatsLoading(true);
    const q = new URLSearchParams();
    if (statsOutletFilter && statsOutletFilter !== "__all__") q.set("pos_outlet_id", statsOutletFilter);
    if (statsFrom) q.set("from", statsFrom);
    if (statsTo) q.set("to", statsTo);
    const r = await fetcher(`${API_ROUTES.ADMIN_POS_STATISTICS}?${q}`);
    setStatsLoading(false);
    if (r.ok) setStats(await r.json()); else setStats(null);
  };

  useEffect(() => { loadOutlets(); loadEvents(); }, []);
  useEffect(() => { if (subTab === "statistics") loadStats(); }, [subTab, statsOutletFilter, statsFrom, statsTo]);
  useEffect(() => {
    if (addStock && !editStock && form.pos_outlet_id && form.event_id) {
      (async () => {
        const r = await fetcher(`${API_ROUTES.ADMIN_POS_STOCK}?pos_outlet_id=${form.pos_outlet_id}&event_id=${form.event_id}`);
        if (r.ok) {
          const d = await r.json();
          const ids = (d || []).map((x: { pass_id: string }) => x.pass_id);
          setAddStockExistingPassIds(ids);
          setForm(f => (f.pass_id && ids.includes(String(f.pass_id)) ? { ...f, pass_id: "" } : f));
        } else setAddStockExistingPassIds([]);
      })();
    } else setAddStockExistingPassIds([]);
  }, [addStock, editStock, form.pos_outlet_id, form.event_id]);
  useEffect(() => { loadUsers(); }, [outletId]);
  useEffect(() => { loadStock(); }, [outletId, eventFilter]);
  useEffect(() => { loadOrders(); }, [outletId, orderStatusFilter]);
  useEffect(() => { if (subTab === "audit") loadAudit(); }, [subTab]);
  useEffect(() => { const e = form.event_id; if (e && String(e).length) loadPasses(String(e)); }, [form.event_id]);

  const copyLink = (slug: string) => {
    const u = typeof window !== "undefined" ? `${window.location.origin}/pos/${slug}` : `/pos/${slug}`;
    navigator.clipboard.writeText(u);
    toast({ title: "Copied", description: u });
  };

  const onSaveOutlet = async () => {
    const name = String(form.name || "").trim();
    if (!name) return;
    if (editOutlet) {
      const r = await fetcher(API_ROUTES.ADMIN_POS_OUTLET(editOutlet.id), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, slug: form.slug || undefined, is_active: form.is_active }) });
      if (r.ok) { setEditOutlet(null); setForm({}); loadOutlets(); toast({ title: "Updated" }); } else { const e = await r.json(); toast({ title: "Error", description: e.error, variant: "destructive" }); }
    } else {
      const r = await fetcher(API_ROUTES.ADMIN_POS_OUTLETS, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, slug: form.slug || undefined }) });
      if (r.ok) { setCreateOutlet(false); setForm({}); loadOutlets(); toast({ title: "Created" }); } else { const e = await r.json(); toast({ title: "Error", description: e.error, variant: "destructive" }); }
    }
  };
  const onDeleteOutlet = async (o: Outlet) => {
    if (!confirm(language === "en" ? "Delete this outlet?" : "Supprimer ce point de vente ?")) return;
    const r = await fetcher(API_ROUTES.ADMIN_POS_OUTLET(o.id), { method: "DELETE" });
    if (r.ok) { loadOutlets(); setOutletFilter("__all__"); toast({ title: "Deleted" }); } else { const e = await r.json(); toast({ title: "Error", description: e.error, variant: "destructive" }); }
  };

  const onSaveUser = async () => {
    const name = String(form.name || "").trim(), email = String(form.email || "").trim().toLowerCase(), password = String(form.password || "");
    const outletId = form.pos_outlet_id || editUser?.pos_outlet_id;
    if (!name || !email || !outletId) return;
    if (editUser) {
      const body: Record<string, unknown> = { name, email, is_active: form.is_active === "1", is_paused: form.is_active !== "1" };
      if (password.length >= 6) body.password = password;
      const r = await fetcher(API_ROUTES.ADMIN_POS_USER(editUser.id), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (r.ok) { setEditUser(null); setForm({}); loadUsers(); toast({ title: "Updated" }); } else { const e = await r.json(); toast({ title: "Error", description: e.error, variant: "destructive" }); }
    } else {
      if (password.length < 6) { toast({ title: "Error", description: "Password min 6", variant: "destructive" }); return; }
      const r = await fetcher(API_ROUTES.ADMIN_POS_USERS, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pos_outlet_id: outletId, name, email, password }) });
      if (r.ok) { setCreateUser(false); setForm({}); loadUsers(); toast({ title: "Created" }); } else { const e = await r.json(); toast({ title: "Error", description: e.error, variant: "destructive" }); }
    }
  };
  const onDeleteUser = async (u: PosUser) => {
    if (!confirm(language === "en" ? "Delete this user?" : "Supprimer cet utilisateur ?")) return;
    const r = await fetcher(API_ROUTES.ADMIN_POS_USER(u.id), { method: "DELETE" });
    if (r.ok) { loadUsers(); toast({ title: "Deleted" }); } else { const e = await r.json(); toast({ title: "Error", description: e.error, variant: "destructive" }); }
  };

  const onSaveStock = async () => {
    const outletId = form.pos_outlet_id || editStock?.pos_outlet_id, eventId = form.event_id || editStock?.event_id, passId = form.pass_id || editStock?.pass_id;
    const max = form.max_quantity === "" || form.max_quantity == null ? null : Number(form.max_quantity);
    const sold = Math.max(0, Number(form.sold_quantity) || 0);
    if (editStock) {
      const soldCount = editStock.sold_quantity ?? 0;
      if (max != null && max < soldCount) {
        toast({ title: "Error", description: language === "en" ? `Max cannot be less than sold (${soldCount})` : `Max ne peut pas être inférieur au vendu (${soldCount})`, variant: "destructive" });
        return;
      }
      const r = await fetcher(API_ROUTES.ADMIN_POS_STOCK_ITEM(editStock.id), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ max_quantity: max }) });
      if (r.ok) { setEditStock(null); setForm({}); loadStock(); toast({ title: "Updated" }); } else { const e = await r.json(); toast({ title: "Error", description: e.error, variant: "destructive" }); }
    } else {
      if (!outletId || !eventId || !passId) return;
      if (max != null && sold > max) {
        toast({ title: "Error", description: language === "en" ? "Sold cannot exceed max" : "Le vendu ne peut pas dépasser le max", variant: "destructive" });
        return;
      }
      const r = await fetcher(API_ROUTES.ADMIN_POS_STOCK, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pos_outlet_id: outletId, event_id: eventId, pass_id: passId, max_quantity: max, sold_quantity: sold }) });
      if (r.ok) { setAddStock(false); setForm({}); loadStock(); toast({ title: "Created" }); } else { const e = await r.json(); toast({ title: "Error", description: e.error, variant: "destructive" }); }
    }
  };

  const onToggleStockActive = async (s: StockRow, checked: boolean) => {
    const prevActive = s.is_active !== false;
    setStock(prev => prev.map(x => x.id === s.id ? { ...x, is_active: checked } : x));
    setTogglingStockId(s.id);
    const r = await fetcher(API_ROUTES.ADMIN_POS_STOCK_ITEM(s.id), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_active: checked }) });
    setTogglingStockId(null);
    if (r.ok) { loadStock(); toast({ title: checked ? (language === "en" ? "Activated" : "Activé") : (language === "en" ? "Deactivated" : "Désactivé") }); } else {
      setStock(prev => prev.map(x => x.id === s.id ? { ...x, is_active: prevActive } : x));
      const e = await r.json().catch(() => ({})); toast({ title: "Error", description: (e as { error?: string })?.error || "Request failed", variant: "destructive" });
    }
  };

  const onApprove = async (o: PosOrder) => {
    setLoading(true);
    const r = await fetcher(API_ROUTES.ADMIN_POS_ORDER_APPROVE(o.id), { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    setLoading(false);
    if (r.ok) { loadOrders(); toast({ title: "Approved", description: "Tickets & email sent" }); } else { const e = await r.json(); toast({ title: "Error", description: e.error, variant: "destructive" }); }
  };
  const onReject = async (o: PosOrder) => {
    const reason = prompt(language === "en" ? "Reason (optional):" : "Raison (optionnel) :") || undefined;
    setLoading(true);
    const r = await fetcher(API_ROUTES.ADMIN_POS_ORDER_REJECT(o.id), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) });
    setLoading(false);
    if (r.ok) { loadOrders(); toast({ title: "Rejected" }); } else { const e = await r.json(); toast({ title: "Error", description: e.error, variant: "destructive" }); }
  };
  const onRemove = async (o: PosOrder) => {
    if (!confirm(language === "en" ? "Remove this order?" : "Supprimer cette commande ?")) return;
    setLoading(true);
    const r = await fetcher(API_ROUTES.ADMIN_POS_ORDER_REMOVE(o.id), { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    setLoading(false);
    if (r.ok) { loadOrders(); setSelectedOrder(null); toast({ title: "Removed" }); } else { const e = await r.json(); toast({ title: "Error", description: e.error, variant: "destructive" }); }
  };

  useEffect(() => { if (selectedOrder) setOrderDetailEmail(selectedOrder.user_email || ""); }, [selectedOrder?.id, selectedOrder?.user_email]);

  const onSaveOrderEmail = async () => {
    if (!selectedOrder) return;
    setOrderDetailSaving(true);
    const r = await fetcher(API_ROUTES.ADMIN_POS_ORDER(selectedOrder.id), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_email: orderDetailEmail.trim() || null }) });
    setOrderDetailSaving(false);
    if (r.ok) { setSelectedOrder(prev => prev ? { ...prev, user_email: orderDetailEmail.trim() || null } : null); loadOrders(); toast({ title: "Email updated" }); } else { const e = await r.json(); toast({ title: "Error", description: e.error, variant: "destructive" }); }
  };

  const onResendOrderReceived = async () => {
    if (!selectedOrder) return;
    setOrderDetailResendLoading(true);
    const r = await fetcher(API_ROUTES.ADMIN_POS_ORDER_RESEND_RECEIVED(selectedOrder.id), { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    setOrderDetailResendLoading(false);
    if (r.ok) toast({ title: "Email sent", description: "Order-received email resent" }); else { const e = await r.json(); toast({ title: "Error", description: e.error, variant: "destructive" }); }
  };

  const onResendTickets = async () => {
    if (!selectedOrder) return;
    setOrderDetailResendLoading(true);
    const r = await fetcher(API_ROUTES.ADMIN_POS_ORDER_RESEND_TICKETS(selectedOrder.id), { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    setOrderDetailResendLoading(false);
    if (r.ok) toast({ title: "Email sent", description: "Tickets email resent" }); else { const e = await r.json(); toast({ title: "Error", description: e.error, variant: "destructive" }); }
  };

  const t = language === "en"
    ? { title: "Point de Vente (POS)", outlets: "Outlets", users: "Users", orders: "Orders", stock: "Stock", audit: "Audit", statistics: "Statistics", add: "Add", edit: "Edit", delete: "Delete", view: "View", name: "Name", email: "Email", password: "Password", slug: "Slug", active: "Active", paused: "Paused", link: "Link", copy: "Copy", outlet: "Outlet", event: "Event", pass: "Pass", maxQ: "Max", sold: "Sold", remaining: "Remaining", customer: "Customer", total: "Total", status: "Status", actions: "Actions", approve: "Approve", reject: "Reject", remove: "Remove", createOutlet: "Create outlet", createUser: "Create user", addStock: "Add stock", noOutlets: "No outlets", noUsers: "No users", noStock: "Select outlet and optionally event", noOrders: "No orders", noAudit: "No audit", clientInfo: "Client information", phone: "Phone", city: "City", ville: "Ville", saveEmail: "Save email", resendOrderReceived: "Resend order-received email", resendTickets: "Resend tickets email", totalOrders: "Total orders", totalRevenue: "Total revenue", byOutlet: "By outlet", byPassType: "By pass type", byStatus: "By status", daily: "Daily" }
    : { title: "Point de Vente (POS)", outlets: "Points de vente", users: "Utilisateurs", orders: "Commandes", stock: "Stock", audit: "Audit", statistics: "Statistiques", add: "Ajouter", edit: "Modifier", delete: "Supprimer", view: "Voir", name: "Nom", email: "Email", password: "Mot de passe", slug: "Slug", active: "Actif", paused: "En pause", link: "Lien", copy: "Copier", outlet: "Point de vente", event: "Événement", pass: "Pass", maxQ: "Max", sold: "Vendu", remaining: "Reste", customer: "Client", total: "Total", status: "Statut", actions: "Actions", approve: "Approuver", reject: "Rejeter", remove: "Supprimer", createOutlet: "Créer un point de vente", createUser: "Créer un utilisateur", addStock: "Ajouter du stock", noOutlets: "Aucun point de vente", noUsers: "Aucun utilisateur", noStock: "Choisir un point de vente et optionnellement un événement", noOrders: "Aucune commande", noAudit: "Aucun audit", clientInfo: "Informations client", phone: "Téléphone", city: "Ville", ville: "Ville", saveEmail: "Enregistrer l'email", resendOrderReceived: "Renvoyer email « reçu »", resendTickets: "Renvoyer email billets", totalOrders: "Total commandes", totalRevenue: "Chiffre d'affaires", byOutlet: "Par point de vente", byPassType: "Par type de pass", byStatus: "Par statut", daily: "Journalier" };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: "#E21836" }}><Store className="w-7 h-7" />{t.title}</h2>
      </div>
      <Tabs value={subTab} onValueChange={setSubTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-6 gap-1 h-auto flex-wrap bg-[#1F1F1F] border-[#2A2A2A]">
          <TabsTrigger value="outlets" className="data-[state=active]:bg-[#E21836] data-[state=active]:text-white"><Building2 className="w-4 h-4 mr-1" /><span className="hidden sm:inline">{t.outlets}</span></TabsTrigger>
          <TabsTrigger value="users" className="data-[state=active]:bg-[#E21836] data-[state=active]:text-white"><Users className="w-4 h-4 mr-1" /><span className="hidden sm:inline">{t.users}</span></TabsTrigger>
          <TabsTrigger value="orders" className="data-[state=active]:bg-[#E21836] data-[state=active]:text-white"><ShoppingCart className="w-4 h-4 mr-1" /><span className="hidden sm:inline">{t.orders}</span></TabsTrigger>
          <TabsTrigger value="stock" className="data-[state=active]:bg-[#E21836] data-[state=active]:text-white"><Package className="w-4 h-4 mr-1" /><span className="hidden sm:inline">{t.stock}</span></TabsTrigger>
          <TabsTrigger value="statistics" className="data-[state=active]:bg-[#E21836] data-[state=active]:text-white"><BarChart3 className="w-4 h-4 mr-1" /><span className="hidden sm:inline">{t.statistics}</span></TabsTrigger>
          <TabsTrigger value="audit" className="data-[state=active]:bg-[#E21836] data-[state=active]:text-white"><Activity className="w-4 h-4 mr-1" /><span className="hidden sm:inline">{t.audit}</span></TabsTrigger>
        </TabsList>

        <TabsContent value="outlets" className="mt-4">
          <Card className="bg-[#1F1F1F] border-[#2A2A2A]">
            <CardHeader className="flex flex-row justify-between">
              <CardTitle style={{ color: "#E21836" }}>{t.outlets}</CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={loadOutlets}><RefreshCw className="w-4 h-4" /></Button>
                <Button size="sm" className="bg-[#E21836] hover:bg-[#c4142e]" onClick={() => { setCreateOutlet(true); setForm({ name: "" }); }}><Plus className="w-4 h-4 mr-1" />{t.add}</Button>
              </div>
            </CardHeader>
            <CardContent>
              {outlets.length === 0 ? <p className="text-[#B0B0B0]">{t.noOutlets}</p> : (
                <Table>
                  <TableHeader><TableRow className="border-[#2A2A2A]">
                    <TableHead className="text-[#B0B0B0]">{t.name}</TableHead>
                    <TableHead className="text-[#B0B0B0]">{t.slug}</TableHead>
                    <TableHead className="text-[#B0B0B0]">{t.link}</TableHead>
                    <TableHead className="text-[#B0B0B0]">{t.actions}</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {outlets.map(o => (
                      <TableRow key={o.id} className="border-[#2A2A2A]">
                        <TableCell className="text-white">{o.name}</TableCell>
                        <TableCell className="text-[#B0B0B0]">{o.slug}</TableCell>
                        <TableCell><Button variant="ghost" size="sm" onClick={() => copyLink(o.slug)}><Copy className="w-4 h-4" /></Button></TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="mr-1" onClick={() => { setEditOutlet(o); setForm({ name: o.name, slug: o.slug, is_active: o.is_active }); }}>{t.edit}</Button>
                          <Button variant="ghost" size="sm" className="text-[#EF4444]" onClick={() => onDeleteOutlet(o)}>{t.delete}</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="mt-4">
          <Card className="bg-[#1F1F1F] border-[#2A2A2A]">
            <CardHeader className="flex flex-row justify-between flex-wrap gap-2">
              <CardTitle style={{ color: "#E21836" }}>{t.users}</CardTitle>
              <div className="flex gap-2 flex-wrap">
                <Select value={outletFilter === "__none__" ? "__all__" : outletFilter} onValueChange={setOutletFilter}>
                  <SelectTrigger className="w-[200px] bg-[#252525] border-[#2A2A2A] text-white"><SelectValue placeholder={t.outlet} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">{language === "en" ? "All" : "Tous"}</SelectItem>
                    {outlets.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="ghost" onClick={loadUsers}><RefreshCw className="w-4 h-4" /></Button>
                <Button size="sm" className="bg-[#E21836] hover:bg-[#c4142e]" onClick={() => { setCreateUser(true); setForm({ pos_outlet_id: outletId || outlets[0]?.id || "", name: "", email: "", password: "" }); }}><Plus className="w-4 h-4 mr-1" />{t.add}</Button>
              </div>
            </CardHeader>
            <CardContent>
              {users.length === 0 ? <p className="text-[#B0B0B0]">{t.noUsers}</p> : (
                <Table>
                  <TableHeader><TableRow className="border-[#2A2A2A]">
                    <TableHead className="text-[#B0B0B0]">{t.name}</TableHead>
                    <TableHead className="text-[#B0B0B0]">{t.email}</TableHead>
                    <TableHead className="text-[#B0B0B0]">{t.active}</TableHead>
                    <TableHead className="text-[#B0B0B0]">{t.actions}</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {users.map(u => (
                      <TableRow key={u.id} className="border-[#2A2A2A]">
                        <TableCell className="text-white">{u.name}</TableCell>
                        <TableCell className="text-[#B0B0B0]">{u.email}</TableCell>
                        <TableCell><span className={u.is_active && !u.is_paused ? "text-[#10B981]" : "text-[#EF4444]"}>{u.is_active && !u.is_paused ? "✓" : "✗"}</span></TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="mr-1" onClick={() => { setEditUser(u); setForm({ name: u.name, email: u.email, is_active: (u.is_active && !u.is_paused) ? "1" : "0", password: "" }); }}>{t.edit}</Button>
                          <Button variant="ghost" size="sm" className="text-[#EF4444]" onClick={() => onDeleteUser(u)}>{t.delete}</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stock" className="mt-4">
          <Card className="bg-[#1F1F1F] border-[#2A2A2A]">
            <CardHeader className="flex flex-row justify-between flex-wrap gap-2">
              <CardTitle style={{ color: "#E21836" }}>{t.stock}</CardTitle>
              <div className="flex gap-2 flex-wrap">
                <Select value={outletFilter === "__all__" ? "__none__" : outletFilter} onValueChange={v => { setOutletFilter(v); setEventFilter("__all__"); }}>
                  <SelectTrigger className="w-[180px] bg-[#252525] border-[#2A2A2A] text-white"><SelectValue placeholder={t.outlet} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {outlets.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={eventFilter} onValueChange={setEventFilter}>
                  <SelectTrigger className="w-[180px] bg-[#252525] border-[#2A2A2A] text-white"><SelectValue placeholder={t.event} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">{language === "en" ? "All" : "Tous"}</SelectItem>
                    {events.filter((e) => e?.id != null && String(e.id).trim() !== "").map(e => <SelectItem key={e.id} value={e.id}>{e.name} {e.date ? format(new Date(e.date), "dd/MM/yy") : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="ghost" onClick={loadStock}><RefreshCw className="w-4 h-4" /></Button>
                <Button size="sm" className="bg-[#E21836] hover:bg-[#c4142e]" disabled={!outletId} onClick={() => { setAddStock(true); setForm({ pos_outlet_id: outletId || outlets[0]?.id || "", event_id: (eventFilter && eventFilter !== "__all__") ? eventFilter : "", pass_id: "", max_quantity: "", sold_quantity: 0 }); }}><Plus className="w-4 h-4 mr-1" />{t.addStock}</Button>
              </div>
            </CardHeader>
            <CardContent>
              {!outletId ? <p className="text-[#B0B0B0]">{t.noStock}</p> : stock.length === 0 ? <p className="text-[#B0B0B0]">{t.noStock}</p> : (
                <Table>
                  <TableHeader><TableRow className="border-[#2A2A2A]">
                    <TableHead className="text-[#B0B0B0]">{t.pass}</TableHead>
                    <TableHead className="text-[#B0B0B0]">{t.maxQ}</TableHead>
                    <TableHead className="text-[#B0B0B0]">{t.sold}</TableHead>
                    <TableHead className="text-[#B0B0B0]">{t.remaining}</TableHead>
                    <TableHead className="text-[#B0B0B0]">{t.active}</TableHead>
                    <TableHead className="text-[#B0B0B0]">{t.actions}</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {stock.map(s => (
                      <TableRow key={s.id} className={`border-[#2A2A2A] ${s.is_active === false ? "opacity-70" : ""}`}>
                        <TableCell className="text-white">{(s.event_passes as { name?: string })?.name || s.pass_id}</TableCell>
                        <TableCell className="text-[#B0B0B0]">{s.max_quantity ?? "∞"}</TableCell>
                        <TableCell className="text-[#B0B0B0]">{s.sold_quantity}</TableCell>
                        <TableCell className="text-[#B0B0B0]">{s.remaining ?? "∞"}</TableCell>
                        <TableCell>
                          <Switch checked={s.is_active !== false} onCheckedChange={v => onToggleStockActive(s, v)} disabled={togglingStockId === s.id} className="data-[state=checked]:bg-[#E21836]" />
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => { setEditStock(s); setForm({ max_quantity: s.max_quantity ?? "", sold_quantity: s.sold_quantity }); }}>{t.edit}</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders" className="mt-4">
          <Card className="bg-[#1F1F1F] border-[#2A2A2A]">
            <CardHeader className="flex flex-row justify-between flex-wrap gap-2">
              <CardTitle style={{ color: "#E21836" }}>{t.orders}</CardTitle>
              <div className="flex gap-2 flex-wrap">
                <Select value={outletFilter === "__none__" ? "__all__" : outletFilter} onValueChange={setOutletFilter}>
                  <SelectTrigger className="w-[160px] bg-[#252525] border-[#2A2A2A] text-white"><SelectValue placeholder={t.outlet} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">{language === "en" ? "All" : "Tous"}</SelectItem>
                    {outlets.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={orderStatusFilter} onValueChange={setOrderStatusFilter}>
                  <SelectTrigger className="w-[180px] bg-[#252525] border-[#2A2A2A] text-white"><SelectValue placeholder={t.status} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">{language === "en" ? "All" : "Tous"}</SelectItem>
                    <SelectItem value="PENDING_ADMIN_APPROVAL">PENDING_ADMIN_APPROVAL</SelectItem>
                    <SelectItem value="PAID">PAID</SelectItem>
                    <SelectItem value="REJECTED">REJECTED</SelectItem>
                    <SelectItem value="REMOVED_BY_ADMIN">REMOVED_BY_ADMIN</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" variant="ghost" onClick={loadOrders}><RefreshCw className="w-4 h-4" /></Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading && <p className="text-[#B0B0B0] flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />...</p>}
              {orders.length === 0 ? <p className="text-[#B0B0B0]">{t.noOrders}</p> : (
                <Table>
                  <TableHeader><TableRow className="border-[#2A2A2A]">
                    <TableHead className="text-[#B0B0B0]">#</TableHead>
                    <TableHead className="text-[#B0B0B0]">{t.customer}</TableHead>
                    <TableHead className="text-[#B0B0B0]">{t.total}</TableHead>
                    <TableHead className="text-[#B0B0B0]">{t.status}</TableHead>
                    <TableHead className="text-[#B0B0B0]">{t.outlet}</TableHead>
                    <TableHead className="text-[#B0B0B0]">{t.actions}</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {orders.map(o => (
                      <TableRow key={o.id} className="border-[#2A2A2A]">
                        <TableCell className="text-white">{o.order_number ?? o.id.slice(0, 8)}</TableCell>
                        <TableCell className="text-[#B0B0B0]">{o.user_name} — {o.user_phone}</TableCell>
                        <TableCell className="text-[#B0B0B0]">{o.total_price} DT</TableCell>
                        <TableCell>
                          {(() => {
                            const s = o.status;
                            const conf = s === "PAID" ? { dot: "bg-[#10B981]", label: language === "en" ? "Paid" : "Payé" } : s === "PENDING_ADMIN_APPROVAL" ? { dot: "bg-[#F59E0B]", label: language === "en" ? "Pending" : "En attente" } : s === "REJECTED" ? { dot: "bg-[#EF4444]", label: language === "en" ? "Rejected" : "Rejeté" } : s === "REMOVED_BY_ADMIN" ? { dot: "bg-[#EF4444]", label: language === "en" ? "Removed" : "Supprimé" } : { dot: "bg-[#888]", label: s };
                            return <span className="inline-flex items-center gap-1.5" title={s}><span className={`w-2 h-2 rounded-full shrink-0 ${conf.dot}`} /><span className="text-[#B0B0B0]">{conf.label}</span></span>;
                          })()}
                        </TableCell>
                        <TableCell className="text-[#B0B0B0]">{(o.pos_outlets as { name?: string })?.name || "—"}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="mr-1" onClick={() => { setSelectedOrder(o); setOrderDetailEmail(o.user_email || ""); }}><Eye className="w-4 h-4" /></Button>
                          {o.status === "PENDING_ADMIN_APPROVAL" && (
                            <>
                              <Button variant="ghost" size="sm" className="text-[#10B981] mr-1" onClick={() => onApprove(o)}>{t.approve}</Button>
                              <Button variant="ghost" size="sm" className="text-[#F59E0B] mr-1" onClick={() => onReject(o)}>{t.reject}</Button>
                            </>
                          )}
                          {(o.status === "PENDING_ADMIN_APPROVAL" || o.status === "PAID") && (
                            <Button variant="ghost" size="sm" className="text-[#EF4444]" onClick={() => onRemove(o)}>{t.remove}</Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="statistics" className="mt-4">
          <Card className="bg-[#1F1F1F] border-[#2A2A2A]">
            <CardHeader className="flex flex-row justify-between flex-wrap gap-2">
              <CardTitle style={{ color: "#E21836" }} className="flex items-center gap-2"><BarChart3 className="w-5 h-5" />{t.statistics}</CardTitle>
              <div className="flex flex-wrap gap-2 items-center">
                <Select value={statsOutletFilter} onValueChange={setStatsOutletFilter}>
                  <SelectTrigger className="w-[180px] bg-[#252525] border-[#2A2A2A] text-white"><SelectValue placeholder={t.outlet} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">{language === "en" ? "All outlets" : "Tous"}</SelectItem>
                    {outlets.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input type="date" className="w-[140px] bg-[#252525] border-[#2A2A2A] text-white" value={statsFrom} onChange={e => setStatsFrom(e.target.value)} placeholder="From" />
                <Input type="date" className="w-[140px] bg-[#252525] border-[#2A2A2A] text-white" value={statsTo} onChange={e => setStatsTo(e.target.value)} placeholder="To" />
                <Button size="sm" variant="ghost" onClick={loadStats} disabled={statsLoading}><RefreshCw className={`w-4 h-4 ${statsLoading ? "animate-spin" : ""}`} /></Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {statsLoading ? <p className="text-[#B0B0B0] flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Loading…</p> : stats ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-[#252525] border border-[#2A2A2A]">
                      <p className="text-[#B0B0B0] text-sm">{t.totalOrders}</p>
                      <p className="text-2xl font-bold text-white">{stats.totalOrders}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-[#252525] border border-[#2A2A2A]">
                      <p className="text-[#B0B0B0] text-sm">{t.totalRevenue}</p>
                      <p className="text-2xl font-bold text-[#E21836]">{stats.totalRevenue.toFixed(2)} DT</p>
                    </div>
                  </div>
                  {stats.daily && stats.daily.length > 0 && (
                    <div>
                      <p className="text-[#E21836] font-semibold mb-2">{t.daily}</p>
                      <ResponsiveContainer width="100%" height={240}>
                        <LineChart data={stats.daily}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                          <XAxis dataKey="date" stroke="#B0B0B0" tick={{ fill: "#B0B0B0" }} />
                          <YAxis stroke="#B0B0B0" tick={{ fill: "#B0B0B0" }} />
                          <Tooltip contentStyle={{ background: "#1F1F1F", border: "1px solid #2A2A2A" }} labelStyle={{ color: "#fff" }} />
                          <Legend />
                          <Line type="monotone" dataKey="orders" stroke="#E21836" name="Orders" strokeWidth={2} />
                          <Line type="monotone" dataKey="revenue" stroke="#10B981" name="Revenue (DT)" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {stats.byOutlet && stats.byOutlet.length > 0 && (
                    <div>
                      <p className="text-[#E21836] font-semibold mb-2">{t.byOutlet}</p>
                      <Table>
                        <TableHeader><TableRow className="border-[#2A2A2A]">
                          <TableHead className="text-[#B0B0B0]">{t.outlet}</TableHead>
                          <TableHead className="text-[#B0B0B0]">{t.totalOrders}</TableHead>
                          <TableHead className="text-[#B0B0B0]">{t.totalRevenue}</TableHead>
                        </TableRow></TableHeader>
                        <TableBody>
                          {stats.byOutlet.map((x: { outlet_id: string; outlet_name: string; total_orders: number; total_revenue: number }) => (
                            <TableRow key={x.outlet_id || x.outlet_name} className="border-[#2A2A2A]">
                              <TableCell className="text-white">{x.outlet_name}</TableCell>
                              <TableCell className="text-[#B0B0B0]">{x.total_orders}</TableCell>
                              <TableCell className="text-[#E21836]">{x.total_revenue.toFixed(2)} DT</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                  {stats.byPassType && Object.keys(stats.byPassType).length > 0 && (
                    <div>
                      <p className="text-[#E21836] font-semibold mb-2">{t.byPassType}</p>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={Object.entries(stats.byPassType).map(([k, v]) => ({ name: k, count: v }))} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                          <XAxis dataKey="name" stroke="#B0B0B0" tick={{ fill: "#B0B0B0" }} />
                          <YAxis stroke="#B0B0B0" tick={{ fill: "#B0B0B0" }} />
                          <Tooltip contentStyle={{ background: "#1F1F1F", border: "1px solid #2A2A2A" }} />
                          <Bar dataKey="count" fill="#E21836" name="Tickets" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {stats.byStatus && Object.keys(stats.byStatus).length > 0 && (
                    <div>
                      <p className="text-[#E21836] font-semibold mb-2">{t.byStatus}</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(stats.byStatus).map(([k, v]) => (
                          <span key={k} className="px-3 py-1.5 rounded-lg bg-[#252525] border border-[#2A2A2A] text-[#B0B0B0] text-sm">{k}: <strong className="text-white">{v}</strong></span>
                        ))}
                      </div>
                    </div>
                  )}
                  {!stats.daily?.length && !stats.byOutlet?.length && Object.keys(stats.byPassType || {}).length === 0 && Object.keys(stats.byStatus || {}).length === 0 && (
                    <p className="text-[#B0B0B0]">{language === "en" ? "No data for the selected filters" : "Aucune donnée pour les filtres choisis"}</p>
                  )}
                </>
              ) : <p className="text-[#B0B0B0]">—</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <Card className="bg-[#1F1F1F] border-[#2A2A2A]">
            <CardHeader className="flex flex-row justify-between">
              <CardTitle style={{ color: "#E21836" }}>{t.audit}</CardTitle>
              <Button size="sm" variant="ghost" onClick={loadAudit}><RefreshCw className="w-4 h-4" /></Button>
            </CardHeader>
            <CardContent>
              {audit.length === 0 ? <p className="text-[#B0B0B0]">{t.noAudit}</p> : (
                <Table>
                  <TableHeader><TableRow className="border-[#2A2A2A]">
                    <TableHead className="text-[#B0B0B0]">Time</TableHead>
                    <TableHead className="text-[#B0B0B0]">Action</TableHead>
                    <TableHead className="text-[#B0B0B0]">By</TableHead>
                    <TableHead className="text-[#B0B0B0]">Target</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {audit.map(a => (
                      <TableRow key={a.id} className="border-[#2A2A2A]">
                        <TableCell className="text-[#B0B0B0]">{format(new Date(a.created_at), "PPp")}</TableCell>
                        <TableCell className="text-white">{a.action}</TableCell>
                        <TableCell className="text-[#B0B0B0]">{a.performed_by_email} ({a.performed_by_type})</TableCell>
                        <TableCell className="text-[#B0B0B0]">{a.target_type} {a.target_id?.slice(0, 8)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Outlet create/edit */}
      <Dialog open={createOutlet || !!editOutlet} onOpenChange={o => { if (!o) { setCreateOutlet(false); setEditOutlet(null); setForm({}); } }}>
        <DialogContent className="bg-[#1F1F1F] border-[#2A2A2A]">
          <DialogHeader><DialogTitle className="text-white">{editOutlet ? t.edit : t.createOutlet}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label className="text-[#B0B0B0]">{t.name}</Label>
            <Input className="bg-[#252525] border-[#2A2A2A] text-white" value={String(form.name || "")} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <Label className="text-[#B0B0B0]">{t.slug} {editOutlet ? "" : "(optional)"}</Label>
            <Input className="bg-[#252525] border-[#2A2A2A] text-white" value={String(form.slug || "")} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} placeholder="paris-store" />
            {editOutlet && <div className="flex items-center gap-2"><Switch checked={form.is_active !== false} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} /><Label className="text-[#B0B0B0]">{t.active}</Label></div>}
            <Button className="w-full bg-[#E21836] hover:bg-[#c4142e]" onClick={onSaveOutlet}>{editOutlet ? "Save" : "Create"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* User create/edit */}
      <Dialog open={createUser || !!editUser} onOpenChange={o => { if (!o) { setCreateUser(false); setEditUser(null); setForm({}); } }}>
        <DialogContent className="bg-[#1F1F1F] border-[#2A2A2A]">
          <DialogHeader><DialogTitle className="text-white">{editUser ? t.edit : t.createUser}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {!editUser && <><Label className="text-[#B0B0B0]">{t.outlet}</Label><Select value={String(form.pos_outlet_id || "")} onValueChange={v => setForm(f => ({ ...f, pos_outlet_id: v }))}><SelectTrigger className="bg-[#252525] border-[#2A2A2A] text-white"><SelectValue /></SelectTrigger><SelectContent>{outlets.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent></Select></>}
            <Label className="text-[#B0B0B0]">{t.name}</Label>
            <Input className="bg-[#252525] border-[#2A2A2A] text-white" value={String(form.name || "")} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <Label className="text-[#B0B0B0]">{t.email}</Label>
            <Input className="bg-[#252525] border-[#2A2A2A] text-white" type="email" value={String(form.email || "")} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            <Label className="text-[#B0B0B0]">{t.password} {editUser ? "(leave blank to keep)" : "(min 6)"}</Label>
            <Input className="bg-[#252525] border-[#2A2A2A] text-white" type="password" value={String(form.password || "")} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
            {editUser && <div className="flex items-center gap-2"><Switch checked={form.is_active === "1"} onCheckedChange={v => setForm(f => ({ ...f, is_active: v ? "1" : "0" }))} /><Label className="text-[#B0B0B0]">{t.active}</Label></div>}
            <Button className="w-full bg-[#E21836] hover:bg-[#c4142e]" onClick={onSaveUser}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Stock add/edit */}
      <Dialog open={addStock || !!editStock} onOpenChange={o => { if (!o) { setAddStock(false); setEditStock(null); setForm({}); } }}>
        <DialogContent className="bg-[#1F1F1F] border-[#2A2A2A]">
          <DialogHeader><DialogTitle className="text-white">{editStock ? t.edit : t.addStock}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {!editStock && (
              <>
                <Label className="text-[#B0B0B0]">{t.outlet}</Label>
                <Select value={String(form.pos_outlet_id || "")} onValueChange={v => setForm(f => ({ ...f, pos_outlet_id: v }))}><SelectTrigger className="bg-[#252525] border-[#2A2A2A] text-white"><SelectValue /></SelectTrigger><SelectContent>{outlets.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent></Select>
                <Label className="text-[#B0B0B0]">{t.event}</Label>
                <Select value={String(form.event_id || "")} onValueChange={v => setForm(f => ({ ...f, event_id: v, pass_id: "" }))}><SelectTrigger className="bg-[#252525] border-[#2A2A2A] text-white"><SelectValue /></SelectTrigger><SelectContent>{events.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent></Select>
                <Label className="text-[#B0B0B0]">{t.pass}</Label>
                {(() => {
                  const all = passesByEvent[String(form.event_id)] || [];
                  const available = all.filter((p: { id: string }) => !addStockExistingPassIds.includes(p.id));
                  return (
                    <>
                      <Select value={form.pass_id && !addStockExistingPassIds.includes(String(form.pass_id)) ? String(form.pass_id) : ""} onValueChange={v => setForm(f => ({ ...f, pass_id: v }))}><SelectTrigger className="bg-[#252525] border-[#2A2A2A] text-white"><SelectValue placeholder={available.length === 0 && all.length > 0 ? (language === "en" ? "All passes already have stock" : "Tous les passes ont déjà du stock") : "—"} /></SelectTrigger><SelectContent>{available.map((p: { id: string; name: string; price: number }) => <SelectItem key={p.id} value={p.id}>{p.name} — {p.price} DT</SelectItem>)}</SelectContent></Select>
                      {available.length === 0 && all.length > 0 && <p className="text-[#F59E0B] text-sm mt-1">{language === "en" ? "Use Edit in the Stock table to update." : "Utilisez Modifier dans le tableau Stock."}</p>}
                    </>
                  );
                })()}
              </>
            )}
            <Label className="text-[#B0B0B0]">{t.maxQ} (empty = unlimited){editStock ? ` — ${language === "en" ? "min" : "min"} ${editStock.sold_quantity ?? 0}` : ""}</Label>
            <Input className="bg-[#252525] border-[#2A2A2A] text-white" type="number" min={editStock ? (editStock.sold_quantity ?? 0) : 0} value={String(form.max_quantity ?? "")} onChange={e => setForm(f => ({ ...f, max_quantity: e.target.value }))} placeholder="∞" />
            {editStock ? (
              <>
                <Label className="text-[#B0B0B0]">{t.sold} ({language === "en" ? "from orders, read-only" : "issu des commandes, lecture seule"})</Label>
                <div className="py-2 px-3 rounded-lg bg-[#252525] border border-[#2A2A2A] text-[#B0B0B0]">{editStock.sold_quantity ?? 0}</div>
                <Label className="text-[#B0B0B0]">{t.remaining}</Label>
                <div className="py-2 px-3 rounded-lg bg-[#252525] border border-[#2A2A2A] text-[#B0B0B0]">{editStock.remaining != null ? editStock.remaining : (editStock.max_quantity == null ? "∞" : Math.max(0, (editStock.max_quantity || 0) - (editStock.sold_quantity || 0)))}</div>
              </>
            ) : (
              <>
                <Label className="text-[#B0B0B0]">{t.sold}</Label>
                <Input className="bg-[#252525] border-[#2A2A2A] text-white" type="number" min={0} value={String(form.sold_quantity ?? 0)} onChange={e => setForm(f => ({ ...f, sold_quantity: e.target.value }))} />
              </>
            )}
            <Button className="w-full bg-[#E21836] hover:bg-[#c4142e]" onClick={onSaveStock}>{editStock ? "Save" : "Create"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Order detail: client info, edit email, resend */}
      <Dialog open={!!selectedOrder} onOpenChange={o => { if (!o) setSelectedOrder(null); }}>
        <DialogContent className="bg-[#1F1F1F] border-[#2A2A2A] text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-white">#{selectedOrder?.order_number ?? selectedOrder?.id?.slice(0, 8)} — {selectedOrder?.status}</DialogTitle></DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div>
                <p className="text-[#E21836] font-semibold mb-1">{t.clientInfo}</p>
                <p className="text-[#F5F5F5]">{selectedOrder.user_name}</p>
                <p className="text-[#B0B0B0]">{t.phone}: {selectedOrder.user_phone}</p>
                <p className="text-[#B0B0B0]">{t.email}: {selectedOrder.user_email || "—"}</p>
                <p className="text-[#B0B0B0]">{t.city}: {selectedOrder.city || "—"}</p>
                <p className="text-[#B0B0B0]">{t.ville}: {selectedOrder.ville || "—"}</p>
              </div>
              <div>
                <p className="text-[#E21836] font-semibold mb-1">{t.outlet}</p>
                <p className="text-[#B0B0B0]">{(selectedOrder.pos_outlets as { name?: string })?.name || "—"}</p>
              </div>
              {(selectedOrder.events as { name?: string })?.name && (
                <div>
                  <p className="text-[#E21836] font-semibold mb-1">{t.event}</p>
                  <p className="text-[#B0B0B0]">{(selectedOrder.events as { name?: string })?.name}</p>
                </div>
              )}
              <div>
                <p className="text-[#E21836] font-semibold mb-1">{t.pass}</p>
                <div className="text-[#B0B0B0]">{(selectedOrder.order_passes || []).map(p => `${p.pass_type} x${p.quantity} — ${(p.price * p.quantity).toFixed(2)} DT`).join(" | ") || "—"}</div>
              </div>
              <p className="text-white font-semibold">{t.total}: {selectedOrder.total_price} DT</p>
              <div>
                <Label className="text-[#B0B0B0]">{t.email}</Label>
                <div className="flex gap-2 mt-1">
                  <Input className="bg-[#252525] border-[#2A2A2A] text-white flex-1" type="email" value={orderDetailEmail} onChange={e => setOrderDetailEmail(e.target.value)} />
                  <Button size="sm" className="bg-[#E21836] hover:bg-[#c4142e] shrink-0" onClick={onSaveOrderEmail} disabled={orderDetailSaving}>{orderDetailSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : t.saveEmail}</Button>
                </div>
              </div>
              <DialogFooter className="flex flex-wrap gap-2 sm:justify-start">
                {selectedOrder.status === "PAID" && (
                  <Button size="sm" variant="outline" className="border-[#2A2A2A] text-[#B0B0B0]" onClick={onResendTickets} disabled={orderDetailResendLoading || !selectedOrder.user_email}>
                    {orderDetailResendLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}{t.resendTickets}
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
