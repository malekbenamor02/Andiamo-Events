import React, { useState, useEffect, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ReasonDialog } from "@/components/ui/reason-dialog";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { getApiBaseUrl } from "@/lib/api-routes";
import { API_ROUTES } from "@/lib/api-routes";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import Loader from "@/components/ui/Loader";
import { Store, Building2, Users, Package, ShoppingCart, Activity, Plus, RefreshCw, Edit, Trash2, Copy, Check, X, Eye, Mail, Send, BarChart3, TrendingUp, Calendar as CalendarIcon } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { AdminOrderQrTicketsSection } from "@/pages/admin/components/AdminOrderQrTicketsSection";

function fetcher(url: string, options?: RequestInit) {
  return fetch(`${getApiBaseUrl()}${url}`, { ...options, credentials: "include" });
}

interface PosTabProps {
  language: "en" | "fr";
  selectedEventId?: string;
  /** Enables QR ticket preview in order detail (API is super_admin-only). */
  isSuperAdmin?: boolean;
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
  cancellation_reason?: string | null;
  pos_outlets?: { id: string; name: string; slug: string } | null;
  events?: { id: string; name: string; date?: string; venue?: string } | null;
  order_passes?: { pass_type: string; quantity: number; price: number }[];
  approver?: { name?: string | null; email?: string } | null;
  rejector?: { name?: string | null; email?: string } | null;
  remover?: { name?: string | null; email?: string } | null;
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

type ConfirmTarget = { kind: "delete-outlet"; o: Outlet } | { kind: "delete-user"; u: PosUser } | { kind: "remove-order"; o: PosOrder };

export function PosTab({ language, selectedEventId, isSuperAdmin = false }: PosTabProps) {
  const { toast } = useToast();
  const ordersFetchGenRef = useRef(0);
  const [subTab, setSubTab] = useState("orders");
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [users, setUsers] = useState<PosUser[]>([]);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [orders, setOrders] = useState<PosOrder[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  /** True after the first POS events list fetch finishes (ok or error). */
  const [eventsReady, setEventsReady] = useState(false);
  const [passesByEvent, setPassesByEvent] = useState<Record<string, EventPass[]>>({});
  const [loading, setLoading] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [outletFilter, setOutletFilter] = useState<string>("__all__");
  const [eventFilter, setEventFilter] = useState<string>(() => selectedEventId ?? "__all__");
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>("__all__");
  const [orderEventFilter, setOrderEventFilter] = useState<string>(() => selectedEventId ?? "__all__");
  const [orderFrom, setOrderFrom] = useState("");
  const [orderTo, setOrderTo] = useState("");
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
  const [stats, setStats] = useState<{ byOutlet: { outlet_id: string; outlet_name: string; total_orders: number; total_revenue: number; by_status: Record<string, number>; by_pass_type: Record<string, number> }[]; daily: { date: string; orders: number; revenue: number }[]; totalOrders: number; totalRevenue: number; paidOrders?: number; paidRevenue?: number; paidTickets?: number; pendingOrders?: number; pendingRevenue?: number; pendingTickets?: number; rejectedOrders?: number; rejectedTickets?: number; removedOrders?: number; removedTickets?: number; byPassType: Record<string, number>; byStatus: Record<string, number> } | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsOutletFilter, setStatsOutletFilter] = useState<string>("__all__");
  const [statsFrom, setStatsFrom] = useState("");
  const [statsTo, setStatsTo] = useState("");
  const [addStockExistingPassIds, setAddStockExistingPassIds] = useState<string[]>([]);
  const [togglingStockId, setTogglingStockId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rejectOrder, setRejectOrder] = useState<PosOrder | null>(null);
  const [reasonDialogOpen, setReasonDialogOpen] = useState(false);
  const [orderActionLoading, setOrderActionLoading] = useState<{ orderId: string; action: "approve" | "reject" | "remove" } | null>(null);

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
    const gen = ++ordersFetchGenRef.current;
    setOrdersLoading(true);
    try {
      const q = new URLSearchParams();
      if (orderStatusFilter && orderStatusFilter !== "__all__") q.set("status", orderStatusFilter);
      if (outletId) q.set("pos_outlet_id", outletId);
      if (orderEventFilter && orderEventFilter !== "__all__") q.set("event_id", orderEventFilter);
      if (orderFrom) q.set("from", orderFrom);
      if (orderTo) q.set("to", orderTo);
      const r = await fetcher(`${API_ROUTES.ADMIN_POS_ORDERS}?${q}`);
      if (gen !== ordersFetchGenRef.current) return;
      if (r.ok) setOrders(await r.json()); else setOrders([]);
    } finally {
      if (gen === ordersFetchGenRef.current) setOrdersLoading(false);
    }
  };
  const loadAudit = async () => {
    const r = await fetcher(API_ROUTES.ADMIN_POS_AUDIT_LOG);
    if (r.ok) setAudit(await r.json()); else setAudit([]);
  };
  const loadEvents = async () => {
    try {
      const r = await fetcher(API_ROUTES.ADMIN_POS_EVENTS);
      if (r.ok) setEvents(await r.json()); else setEvents([]);
    } finally {
      setEventsReady(true);
    }
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
  useEffect(() => { if (subTab === "orders") loadOrders(); }, [subTab, outletId, orderStatusFilter, orderEventFilter, orderFrom, orderTo]);
  useEffect(() => { if (subTab === "audit") loadAudit(); }, [subTab]);
  useEffect(() => { const e = form.event_id; if (e && String(e).length) loadPasses(String(e)); }, [form.event_id]);

  // Sync POS event filters with the main admin "Filter by Event" selection
  useEffect(() => {
    if (!selectedEventId) {
      setEventFilter("__all__");
      setOrderEventFilter("__all__");
      return;
    }
    // Until the POS events list has loaded, keep the dashboard event so the first orders fetch
    // is scoped (empty events[] previously forced "__all__" and caused a flash of all events' orders).
    if (!eventsReady) {
      setEventFilter(selectedEventId);
      setOrderEventFilter(selectedEventId);
      return;
    }
    if (events.some((ev) => ev.id === selectedEventId)) {
      setEventFilter(selectedEventId);
      setOrderEventFilter(selectedEventId);
    } else {
      setEventFilter("__all__");
      setOrderEventFilter("__all__");
    }
  }, [selectedEventId, events, eventsReady]);

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
  const onDeleteOutlet = (o: Outlet) => {
    setConfirmTarget({ kind: "delete-outlet", o });
    setConfirmOpen(true);
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
  const onDeleteUser = (u: PosUser) => {
    setConfirmTarget({ kind: "delete-user", u });
    setConfirmOpen(true);
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
    setOrderActionLoading({ orderId: o.id, action: "approve" });
    try {
      const r = await fetcher(API_ROUTES.ADMIN_POS_ORDER_APPROVE(o.id), { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (r.ok) { loadOrders(); toast({ title: "Approved", description: "Tickets & email sent" }); } else { const e = await r.json(); toast({ title: "Error", description: e.error, variant: "destructive" }); }
    } finally {
      setOrderActionLoading(null);
    }
  };
  const onReject = (o: PosOrder) => {
    setRejectOrder(o);
    setReasonDialogOpen(true);
  };
  const onRemove = (o: PosOrder) => {
    setConfirmTarget({ kind: "remove-order", o });
    setConfirmOpen(true);
  };

  const handleConfirmAction = async () => {
    if (!confirmTarget) return;
    if (confirmTarget.kind === "delete-outlet") {
      fetcher(API_ROUTES.ADMIN_POS_OUTLET(confirmTarget.o.id), { method: "DELETE" }).then(r => {
        if (r.ok) { loadOutlets(); setOutletFilter("__all__"); toast({ title: "Deleted" }); setConfirmOpen(false); setConfirmTarget(null); } else r.json().then((e: { error?: string }) => toast({ title: "Error", description: e.error, variant: "destructive" }));
      });
    } else if (confirmTarget.kind === "delete-user") {
      fetcher(API_ROUTES.ADMIN_POS_USER(confirmTarget.u.id), { method: "DELETE" }).then(r => {
        if (r.ok) { loadUsers(); toast({ title: "Deleted" }); setConfirmOpen(false); setConfirmTarget(null); } else r.json().then((e: { error?: string }) => toast({ title: "Error", description: e.error, variant: "destructive" }));
      });
    } else if (confirmTarget.kind === "remove-order") {
      setOrderActionLoading({ orderId: confirmTarget.o.id, action: "remove" });
      try {
        const r = await fetcher(API_ROUTES.ADMIN_POS_ORDER_REMOVE(confirmTarget.o.id), { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
        if (r.ok) { loadOrders(); setSelectedOrder(null); toast({ title: "Removed" }); setConfirmOpen(false); setConfirmTarget(null); } else { const e = await r.json(); toast({ title: "Error", description: e.error, variant: "destructive" }); }
      } finally {
        setOrderActionLoading(null);
      }
    }
  };

  const handleRejectWithReason = async (reason: string | undefined) => {
    const order = rejectOrder;
    if (!order) return;
    setOrderActionLoading({ orderId: order.id, action: "reject" });
    try {
      const r = await fetcher(API_ROUTES.ADMIN_POS_ORDER_REJECT(order.id), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) });
      if (r.ok) { loadOrders(); toast({ title: "Rejected" }); setReasonDialogOpen(false); setRejectOrder(null); } else { const e = await r.json().catch(() => ({})); toast({ title: "Error", description: (e as { error?: string }).error, variant: "destructive" }); }
    } finally {
      setOrderActionLoading(null);
    }
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
    ? { title: "Point de Vente (POS)", outlets: "Outlets", users: "Users", orders: "Orders", stock: "Stock", audit: "Audit", statistics: "Statistics", add: "Add", edit: "Edit", delete: "Delete", view: "View", name: "Name", email: "Email", password: "Password", slug: "Slug", active: "Active", paused: "Paused", link: "Link", copy: "Copy", outlet: "Outlet", event: "Event", pass: "Pass", maxQ: "Max", sold: "Sold", remaining: "Remaining", customer: "Customer", total: "Total", status: "Status", actions: "Actions", approve: "Approve", reject: "Reject", remove: "Remove", createOutlet: "Create outlet", createUser: "Create user", addStock: "Add stock", noOutlets: "No outlets", noUsers: "No users", noStock: "Select outlet and optionally event", noOrders: "No orders", noAudit: "No audit", clientInfo: "Client information", phone: "Phone", city: "City", ville: "Ville", saveEmail: "Save email", resendOrderReceived: "Resend order-received email", resendTickets: "Resend tickets email", totalOrders: "Total orders", totalRevenue: "Total revenue", byOutlet: "By outlet", byPassType: "By pass type", byStatus: "By status", daily: "Daily", confirm: "Confirm", cancel: "Cancel", rejectReason: "Reason (optional):", rejectTitle: "Reject order", paidOrders: "Paid orders", paidRevenue: "Paid revenue", paidTickets: "Paid tickets", pendingOrders: "Pending orders", pendingRevenue: "Pending revenue", pendingTickets: "Pending tickets", rejectedOrders: "Rejected orders", rejectedTickets: "Rejected tickets", removedOrders: "Removed orders", removedTickets: "Removed tickets" }
    : { title: "Point de Vente (POS)", outlets: "Points de vente", users: "Utilisateurs", orders: "Commandes", stock: "Stock", audit: "Audit", statistics: "Statistiques", add: "Ajouter", edit: "Modifier", delete: "Supprimer", view: "Voir", name: "Nom", email: "Email", password: "Mot de passe", slug: "Slug", active: "Actif", paused: "En pause", link: "Lien", copy: "Copier", outlet: "Point de vente", event: "Événement", pass: "Pass", maxQ: "Max", sold: "Vendu", remaining: "Reste", customer: "Client", total: "Total", status: "Statut", actions: "Actions", approve: "Approuver", reject: "Rejeter", remove: "Supprimer", createOutlet: "Créer un point de vente", createUser: "Créer un utilisateur", addStock: "Ajouter du stock", noOutlets: "Aucun point de vente", noUsers: "Aucun utilisateur", noStock: "Choisir un point de vente et optionnellement un événement", noOrders: "Aucune commande", noAudit: "Aucun audit", clientInfo: "Informations client", phone: "Téléphone", city: "Ville", ville: "Ville", saveEmail: "Enregistrer l'email", resendOrderReceived: "Renvoyer email « reçu »", resendTickets: "Renvoyer email billets", totalOrders: "Total commandes", totalRevenue: "Chiffre d'affaires", byOutlet: "Par point de vente", byPassType: "Par type de pass", byStatus: "Par statut", daily: "Journalier", confirm: "Confirmer", cancel: "Annuler", rejectReason: "Raison (optionnel) :", rejectTitle: "Rejeter la commande", paidOrders: "Commandes payées", paidRevenue: "Chiffre payé", pendingOrders: "Commandes en attente", pendingRevenue: "Chiffre en attente", rejectedOrders: "Commandes rejetées", rejectedTickets: "Billets rejetés", removedOrders: "Commandes supprimées", removedTickets: "Billets supprimés", paidTickets: "Billets payés", pendingTickets: "Billets en attente" };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: "#E21836" }}><Store className="w-7 h-7" />{t.title}</h2>
      </div>
      <Tabs value={subTab} onValueChange={setSubTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 gap-1 h-auto flex-wrap bg-card border border-border">
          <TabsTrigger value="orders" className="text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><ShoppingCart className="w-4 h-4 mr-1" /><span className="hidden sm:inline">{t.orders}</span></TabsTrigger>
          <TabsTrigger value="statistics" className="text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><BarChart3 className="w-4 h-4 mr-1" /><span className="hidden sm:inline">{t.statistics}</span></TabsTrigger>
          <TabsTrigger value="outlets" className="text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Building2 className="w-4 h-4 mr-1" /><span className="hidden sm:inline">{t.outlets}</span></TabsTrigger>
          <TabsTrigger value="users" className="text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Users className="w-4 h-4 mr-1" /><span className="hidden sm:inline">{t.users}</span></TabsTrigger>
          <TabsTrigger value="audit" className="text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Activity className="w-4 h-4 mr-1" /><span className="hidden sm:inline">{t.audit}</span></TabsTrigger>
        </TabsList>

        <TabsContent value="outlets" className="mt-4">
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row justify-between">
              <CardTitle style={{ color: "#E21836" }}>{t.outlets}</CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={loadOutlets}><RefreshCw className="w-4 h-4" /></Button>
                <Button size="sm" className="bg-[#E21836] hover:bg-[#c4142e]" onClick={() => { setCreateOutlet(true); setForm({ name: "" }); }}><Plus className="w-4 h-4 mr-1" />{t.add}</Button>
              </div>
            </CardHeader>
            <CardContent>
              {outlets.length === 0 ? <p className="text-muted-foreground">{t.noOutlets}</p> : (
                <Table>
                  <TableHeader><TableRow className="border-border">
                    <TableHead className="text-muted-foreground">{t.name}</TableHead>
                    <TableHead className="text-muted-foreground">{t.slug}</TableHead>
                    <TableHead className="text-muted-foreground">{t.link}</TableHead>
                    <TableHead className="text-muted-foreground">{t.actions}</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {outlets.map(o => (
                      <TableRow key={o.id} className="border-border">
                        <TableCell className="text-foreground">{o.name}</TableCell>
                        <TableCell className="text-muted-foreground">{o.slug}</TableCell>
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
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row justify-between flex-wrap gap-2">
              <CardTitle style={{ color: "#E21836" }}>{t.users}</CardTitle>
              <div className="flex gap-2 flex-wrap">
                <Select value={outletFilter === "__none__" ? "__all__" : outletFilter} onValueChange={setOutletFilter}>
                  <SelectTrigger className="w-[200px]"><SelectValue placeholder={t.outlet} /></SelectTrigger>
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
              {users.length === 0 ? <p className="text-muted-foreground">{t.noUsers}</p> : (
                <Table>
                  <TableHeader><TableRow className="border-border">
                    <TableHead className="text-muted-foreground">{t.name}</TableHead>
                    <TableHead className="text-muted-foreground">{t.email}</TableHead>
                    <TableHead className="text-muted-foreground">{t.active}</TableHead>
                    <TableHead className="text-muted-foreground">{t.actions}</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {users.map(u => (
                      <TableRow key={u.id} className="border-border">
                        <TableCell className="text-foreground">{u.name}</TableCell>
                        <TableCell className="text-muted-foreground">{u.email}</TableCell>
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

        <TabsContent value="orders" className="mt-4">
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row justify-between flex-wrap gap-2">
              <CardTitle style={{ color: "#E21836" }}>{t.orders}</CardTitle>
              <div className="flex gap-2 flex-wrap">
                <Select value={outletFilter === "__none__" ? "__all__" : outletFilter} onValueChange={setOutletFilter}>
                  <SelectTrigger className="w-[160px]"><SelectValue placeholder={t.name} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">{t.name}</SelectItem>
                    {outlets.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={orderStatusFilter} onValueChange={setOrderStatusFilter}>
                  <SelectTrigger className="w-[180px]"><SelectValue placeholder={t.status} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">{t.status}</SelectItem>
                    <SelectItem value="PENDING_ADMIN_APPROVAL">PENDING_ADMIN_APPROVAL</SelectItem>
                    <SelectItem value="PAID">PAID</SelectItem>
                    <SelectItem value="REJECTED">REJECTED</SelectItem>
                    <SelectItem value="REMOVED_BY_ADMIN">REMOVED_BY_ADMIN</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={orderEventFilter} onValueChange={setOrderEventFilter}>
                  <SelectTrigger className="w-[180px]"><SelectValue placeholder={t.event} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">{language === "en" ? "All events" : "Tous"}</SelectItem>
                    {selectedEventId && !eventsReady ? (
                      <SelectItem value={selectedEventId} disabled>
                        {language === "en" ? "Loading events…" : "Chargement des événements…"}
                      </SelectItem>
                    ) : null}
                    {events.map(ev => <SelectItem key={ev.id} value={ev.id}>{ev.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[160px] justify-start text-left font-normal",
                        !orderFrom && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {orderFrom
                        ? format(new Date(`${orderFrom}T00:00:00`), "dd/MM/yyyy")
                        : (language === "en" ? "From" : "De")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={orderFrom ? new Date(`${orderFrom}T00:00:00`) : undefined}
                      onSelect={(date) => setOrderFrom(date ? format(date, "yyyy-MM-dd") : "")}
                      initialFocus
                    />
                    {orderFrom && (
                      <div className="p-2 border-t border-border flex justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setOrderFrom("")}
                        >
                          <X className="w-3 h-3 mr-1" />
                          {language === "en" ? "Clear" : "Effacer"}
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[160px] justify-start text-left font-normal",
                        !orderTo && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {orderTo
                        ? format(new Date(`${orderTo}T00:00:00`), "dd/MM/yyyy")
                        : (language === "en" ? "To" : "À")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={orderTo ? new Date(`${orderTo}T00:00:00`) : undefined}
                      onSelect={(date) => setOrderTo(date ? format(date, "yyyy-MM-dd") : "")}
                      disabled={orderFrom ? { before: new Date(`${orderFrom}T00:00:00`) } : undefined}
                      initialFocus
                    />
                    {orderTo && (
                      <div className="p-2 border-t border-border flex justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setOrderTo("")}
                        >
                          <X className="w-3 h-3 mr-1" />
                          {language === "en" ? "Clear" : "Effacer"}
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
                <Button size="sm" variant="ghost" onClick={loadOrders}><RefreshCw className="w-4 h-4" /></Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading && <p className="text-muted-foreground flex items-center gap-2"><Loader size="sm" className="[background:#E21836]" />...</p>}
              {ordersLoading ? (
                <p className="text-muted-foreground flex items-center gap-2"><Loader size="sm" className="[background:#E21836]" />{language === "en" ? "Loading orders…" : "Chargement des commandes…"}</p>
              ) : orders.length === 0 ? (
                <p className="text-muted-foreground">{t.noOrders}</p>
              ) : (
                <>
                  {/* Desktop: keep original table view */}
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border">
                          <TableHead className="text-muted-foreground">#</TableHead>
                          <TableHead className="text-muted-foreground">{t.customer}</TableHead>
                          <TableHead className="text-muted-foreground">{t.total}</TableHead>
                          <TableHead className="text-muted-foreground">{t.status}</TableHead>
                          <TableHead className="text-muted-foreground">{t.outlet}</TableHead>
                          <TableHead className="text-muted-foreground">{t.actions}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orders.map((o) => (
                          <TableRow key={o.id} className="border-border">
                            <TableCell className="text-foreground">{o.order_number ?? o.id.slice(0, 8)}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {o.user_name} — {o.user_phone}
                            </TableCell>
                            <TableCell className="text-muted-foreground">{o.total_price} DT</TableCell>
                            <TableCell>
                              {(() => {
                                const s = o.status;
                                const conf =
                                  s === "PAID"
                                    ? { dot: "bg-[#10B981]", label: language === "en" ? "Paid" : "Payé" }
                                    : s === "PENDING_ADMIN_APPROVAL"
                                      ? { dot: "bg-[#F59E0B]", label: language === "en" ? "Pending" : "En attente" }
                                      : s === "REJECTED"
                                        ? { dot: "bg-[#EF4444]", label: language === "en" ? "Rejected" : "Rejeté" }
                                        : s === "REMOVED_BY_ADMIN"
                                          ? { dot: "bg-[#EF4444]", label: language === "en" ? "Removed" : "Supprimé" }
                                          : { dot: "bg-[#888]", label: s };

                                return (
                                  <span className="inline-flex items-center gap-1.5" title={s}>
                                    <span className={`w-2 h-2 rounded-full shrink-0 ${conf.dot}`} />
                                    <span className="text-muted-foreground">{conf.label}</span>
                                  </span>
                                );
                              })()}
                            </TableCell>
                            <TableCell className="text-muted-foreground">{(o.pos_outlets as { name?: string })?.name || "—"}</TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="mr-1"
                                onClick={() => {
                                  setSelectedOrder(o);
                                  setOrderDetailEmail(o.user_email || "");
                                }}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>

                              {o.status === "PENDING_ADMIN_APPROVAL" && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-[#10B981] mr-1"
                                    onClick={() => onApprove(o)}
                                    disabled={
                                      orderActionLoading?.orderId === o.id && orderActionLoading?.action === "approve"
                                    }
                                  >
                                    {orderActionLoading?.orderId === o.id &&
                                    orderActionLoading?.action === "approve" ? (
                                      <Loader size="sm" className="mr-1 shrink-0" />
                                    ) : null}
                                    {t.approve}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-[#F59E0B] mr-1"
                                    onClick={() => onReject(o)}
                                    disabled={
                                      orderActionLoading?.orderId === o.id && orderActionLoading?.action === "reject"
                                    }
                                  >
                                    {t.reject}
                                  </Button>
                                </>
                              )}

                              {(o.status === "PENDING_ADMIN_APPROVAL" || o.status === "PAID") && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-[#EF4444]"
                                  onClick={() => onRemove(o)}
                                  disabled={
                                    orderActionLoading?.orderId === o.id && orderActionLoading?.action === "remove"
                                  }
                                >
                                  {orderActionLoading?.orderId === o.id &&
                                  orderActionLoading?.action === "remove" ? (
                                    <Loader size="sm" className="mr-1 shrink-0" />
                                  ) : null}
                                  {t.remove}
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Mobile: cards view */}
                  <div className="md:hidden grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {orders.map((o) => {
                    const s = o.status;
                    const conf =
                      s === "PAID"
                        ? { dot: "bg-[#10B981]", label: language === "en" ? "Paid" : "Payé" }
                        : s === "PENDING_ADMIN_APPROVAL"
                          ? { dot: "bg-[#F59E0B]", label: language === "en" ? "Pending" : "En attente" }
                          : s === "REJECTED"
                            ? { dot: "bg-[#EF4444]", label: language === "en" ? "Rejected" : "Rejeté" }
                            : s === "REMOVED_BY_ADMIN"
                              ? { dot: "bg-[#EF4444]", label: language === "en" ? "Removed" : "Supprimé" }
                              : { dot: "bg-[#888]", label: s };

                    return (
                      <Card key={o.id} className="bg-card border-border">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs text-muted-foreground">
                                #{o.order_number ?? o.id.slice(0, 8)}
                              </p>
                              <p className="text-sm font-semibold text-foreground">
                                {o.user_name} <span className="font-normal text-muted-foreground">— {o.user_phone}</span>
                              </p>
                            </div>

                            <span
                              className="inline-flex items-center gap-1.5"
                              title={s}
                            >
                              <span className={`w-2 h-2 rounded-full shrink-0 ${conf.dot}`} />
                              <span className="text-muted-foreground">{conf.label}</span>
                            </span>
                          </div>

                          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <p className="text-xs text-muted-foreground">
                                {t.total}
                              </p>
                              <p className="text-sm font-semibold text-muted-foreground">
                                {o.total_price} DT
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">
                                {t.outlet}
                              </p>
                              <p className="text-sm font-semibold text-muted-foreground">
                                {(o.pos_outlets as { name?: string })?.name || "—"}
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2 items-center justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedOrder(o);
                                setOrderDetailEmail(o.user_email || "");
                              }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>

                            {o.status === "PENDING_ADMIN_APPROVAL" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-[#10B981]"
                                  onClick={() => onApprove(o)}
                                  disabled={
                                    orderActionLoading?.orderId === o.id &&
                                    orderActionLoading?.action === "approve"
                                  }
                                >
                                  {orderActionLoading?.orderId === o.id &&
                                  orderActionLoading?.action === "approve" ? (
                                    <Loader size="sm" className="mr-1 shrink-0" />
                                  ) : null}
                                  {t.approve}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-[#F59E0B]"
                                  onClick={() => onReject(o)}
                                  disabled={
                                    orderActionLoading?.orderId === o.id &&
                                    orderActionLoading?.action === "reject"
                                  }
                                >
                                  {t.reject}
                                </Button>
                              </>
                            )}

                            {(o.status === "PENDING_ADMIN_APPROVAL" || o.status === "PAID") && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-[#EF4444]"
                                onClick={() => onRemove(o)}
                                disabled={
                                  orderActionLoading?.orderId === o.id &&
                                  orderActionLoading?.action === "remove"
                                }
                              >
                                {orderActionLoading?.orderId === o.id &&
                                orderActionLoading?.action === "remove" ? (
                                  <Loader size="sm" className="mr-1 shrink-0" />
                                ) : null}
                                {t.remove}
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="statistics" className="mt-4">
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row justify-between flex-wrap gap-2">
              <CardTitle style={{ color: "#E21836" }} className="flex items-center gap-2"><BarChart3 className="w-5 h-5" />{t.statistics}</CardTitle>
              <div className="flex flex-wrap gap-2 items-center">
                <Select value={statsOutletFilter} onValueChange={setStatsOutletFilter}>
                  <SelectTrigger className="w-[180px]"><SelectValue placeholder={t.outlet} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">{language === "en" ? "All outlets" : "Tous"}</SelectItem>
                    {outlets.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[160px] justify-start text-left font-normal",
                        !statsFrom && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {statsFrom
                        ? format(new Date(`${statsFrom}T00:00:00`), "dd/MM/yyyy")
                        : (language === "en" ? "From" : "De")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={statsFrom ? new Date(`${statsFrom}T00:00:00`) : undefined}
                      onSelect={(date) => setStatsFrom(date ? format(date, "yyyy-MM-dd") : "")}
                      initialFocus
                    />
                    {statsFrom && (
                      <div className="p-2 border-t border-border flex justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setStatsFrom("")}
                        >
                          <X className="w-3 h-3 mr-1" />
                          {language === "en" ? "Clear" : "Effacer"}
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[160px] justify-start text-left font-normal",
                        !statsTo && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {statsTo
                        ? format(new Date(`${statsTo}T00:00:00`), "dd/MM/yyyy")
                        : (language === "en" ? "To" : "À")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={statsTo ? new Date(`${statsTo}T00:00:00`) : undefined}
                      onSelect={(date) => setStatsTo(date ? format(date, "yyyy-MM-dd") : "")}
                      disabled={statsFrom ? { before: new Date(`${statsFrom}T00:00:00`) } : undefined}
                      initialFocus
                    />
                    {statsTo && (
                      <div className="p-2 border-t border-border flex justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setStatsTo("")}
                        >
                          <X className="w-3 h-3 mr-1" />
                          {language === "en" ? "Clear" : "Effacer"}
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
                <Button size="sm" variant="ghost" onClick={loadStats} disabled={statsLoading}>{statsLoading ? <Loader size="sm" className="[background:#E21836]" /> : <RefreshCw className="w-4 h-4" />}</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {statsLoading ? <p className="text-muted-foreground flex items-center gap-2"><Loader size="sm" className="[background:#E21836]" />Loading…</p> : stats ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-muted/40 border border-border">
                      <p className="text-muted-foreground text-sm">{t.totalOrders}</p>
                      <p className="text-2xl font-bold text-foreground">{stats.totalOrders}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/40 border border-border">
                      <p className="text-muted-foreground text-sm">{t.totalRevenue} ({language === "en" ? "paid only" : "payé uniquement"})</p>
                      <p className="text-2xl font-bold text-[#E21836]">{(stats.totalRevenue ?? 0).toFixed(2)} DT</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-[#E21836] font-semibold mb-2">{language === "en" ? "By status" : "Par statut"}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="p-4 rounded-lg bg-muted/40 border border-border">
                        <p className="text-muted-foreground text-sm">{t.paidOrders}</p>
                        <p className="text-xl font-bold text-foreground">{stats.paidOrders ?? 0}</p>
                        <p className="text-muted-foreground text-sm mt-0.5">{t.paidTickets}</p>
                        <p className="text-lg font-bold text-foreground">{stats.paidTickets ?? 0}</p>
                        <p className="text-muted-foreground text-sm mt-0.5">{t.paidRevenue}</p>
                        <p className="text-lg font-bold text-[#10B981]">{(stats.paidRevenue ?? 0).toFixed(2)} DT</p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/40 border border-border">
                        <p className="text-muted-foreground text-sm">{t.pendingOrders}</p>
                        <p className="text-xl font-bold text-foreground">{stats.pendingOrders ?? 0}</p>
                        <p className="text-muted-foreground text-sm mt-0.5">{t.pendingTickets}</p>
                        <p className="text-lg font-bold text-foreground">{stats.pendingTickets ?? 0}</p>
                        <p className="text-muted-foreground text-sm mt-0.5">{t.pendingRevenue}</p>
                        <p className="text-lg font-bold text-[#F59E0B]">{(stats.pendingRevenue ?? 0).toFixed(2)} DT</p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/40 border border-border">
                        <p className="text-muted-foreground text-sm">{t.rejectedOrders}</p>
                        <p className="text-xl font-bold text-[#EF4444]">{stats.rejectedOrders ?? 0}</p>
                        <p className="text-muted-foreground text-sm mt-0.5">{t.rejectedTickets}</p>
                        <p className="text-lg font-bold text-[#EF4444]">{stats.rejectedTickets ?? 0}</p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/40 border border-border">
                        <p className="text-muted-foreground text-sm">{t.removedOrders}</p>
                        <p className="text-xl font-bold text-[#6B7280]">{stats.removedOrders ?? 0}</p>
                        <p className="text-muted-foreground text-sm mt-0.5">{t.removedTickets}</p>
                        <p className="text-lg font-bold text-[#6B7280]">{stats.removedTickets ?? 0}</p>
                      </div>
                    </div>
                  </div>
                  {stats.daily && stats.daily.length > 0 && (
                    <div>
                      <p className="text-[#E21836] font-semibold mb-2">{t.daily} ({language === "en" ? "paid only" : "payés uniquement"})</p>
                      <ResponsiveContainer width="100%" height={240}>
                        <LineChart data={stats.daily}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                          <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                          <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} labelStyle={{ color: "hsl(var(--foreground))" }} />
                          <Legend />
                          <Line type="monotone" dataKey="orders" stroke="#E21836" name={language === "en" ? "Paid orders" : "Commandes payées"} strokeWidth={2} />
                          <Line type="monotone" dataKey="revenue" stroke="#10B981" name={language === "en" ? "Paid revenue (DT)" : "Chiffre payé (DT)"} strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {stats.byOutlet && stats.byOutlet.length > 0 && (
                    <div>
                      <p className="text-[#E21836] font-semibold mb-2">{t.byOutlet} ({language === "en" ? "paid only" : "payés uniquement"})</p>
                      <Table>
                        <TableHeader><TableRow className="border-border">
                          <TableHead className="text-muted-foreground">{t.outlet}</TableHead>
                          <TableHead className="text-muted-foreground">{t.paidOrders}</TableHead>
                          <TableHead className="text-muted-foreground">{t.paidRevenue}</TableHead>
                        </TableRow></TableHeader>
                        <TableBody>
                          {stats.byOutlet.map((x: { outlet_id: string; outlet_name: string; total_orders: number; total_revenue: number }) => (
                            <TableRow key={x.outlet_id || x.outlet_name} className="border-border">
                              <TableCell className="text-foreground">{x.outlet_name}</TableCell>
                              <TableCell className="text-muted-foreground">{x.total_orders}</TableCell>
                              <TableCell className="text-[#E21836]">{x.total_revenue.toFixed(2)} DT</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                  {stats.byPassType && Object.keys(stats.byPassType).length > 0 && (
                    <div>
                      <p className="text-[#E21836] font-semibold mb-2">{t.byPassType} ({language === "en" ? "paid tickets only" : "billets payés uniquement"})</p>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={Object.entries(stats.byPassType).map(([k, v]) => ({ name: k, count: v }))} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                          <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                          <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                          <Bar dataKey="count" fill="#E21836" name={language === "en" ? "Paid tickets" : "Billets payés"} radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {stats.byStatus && Object.keys(stats.byStatus).length > 0 && (
                    <div>
                      <p className="text-[#E21836] font-semibold mb-2">{t.byStatus}</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(stats.byStatus).map(([k, v]) => (
                          <span key={k} className="px-3 py-1.5 rounded-lg bg-muted/40 border border-border text-muted-foreground text-sm">{k}: <strong className="text-foreground">{v}</strong></span>
                        ))}
                      </div>
                    </div>
                  )}
                  {!stats.daily?.length && !stats.byOutlet?.length && Object.keys(stats.byPassType || {}).length === 0 && Object.keys(stats.byStatus || {}).length === 0 && (
                    <p className="text-muted-foreground">{language === "en" ? "No data for the selected filters" : "Aucune donnée pour les filtres choisis"}</p>
                  )}
                </>
              ) : <p className="text-muted-foreground">—</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row justify-between">
              <CardTitle style={{ color: "#E21836" }}>{t.audit}</CardTitle>
              <Button size="sm" variant="ghost" onClick={loadAudit}><RefreshCw className="w-4 h-4" /></Button>
            </CardHeader>
            <CardContent>
              {audit.length === 0 ? <p className="text-muted-foreground">{t.noAudit}</p> : (
                <Table>
                  <TableHeader><TableRow className="border-border">
                    <TableHead className="text-muted-foreground">Time</TableHead>
                    <TableHead className="text-muted-foreground">Action</TableHead>
                    <TableHead className="text-muted-foreground">By</TableHead>
                    <TableHead className="text-muted-foreground">Target</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {audit.map(a => (
                      <TableRow key={a.id} className="border-border">
                        <TableCell className="text-muted-foreground">{format(new Date(a.created_at), "PPp")}</TableCell>
                        <TableCell className="text-foreground">{a.action}</TableCell>
                        <TableCell className="text-muted-foreground">{a.performed_by_email} ({a.performed_by_type})</TableCell>
                        <TableCell className="text-muted-foreground">{a.target_type} {a.target_id?.slice(0, 8)}</TableCell>
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
              {(selectedOrder.status === "PAID" && selectedOrder.approver) || (selectedOrder.status === "REJECTED" && (selectedOrder.rejector || selectedOrder.cancellation_reason)) || (selectedOrder.status === "REMOVED_BY_ADMIN" && selectedOrder.remover) ? (
                <div>
                  <p className="text-[#E21836] font-semibold mb-1">{language === "en" ? "Action by" : "Action par"}</p>
                  {selectedOrder.status === "PAID" && selectedOrder.approver && (
                    <p className="text-[#B0B0B0]">{(language === "en" ? "Approved by" : "Approuvé par")}: {(selectedOrder.approver?.name && String(selectedOrder.approver.name).trim()) || selectedOrder.approver?.email || "—"}</p>
                  )}
                  {selectedOrder.status === "REJECTED" && (
                    <>
                      {selectedOrder.rejector && <p className="text-[#B0B0B0]">{(language === "en" ? "Rejected by" : "Rejeté par")}: {(selectedOrder.rejector?.name && String(selectedOrder.rejector.name).trim()) || selectedOrder.rejector?.email || "—"}</p>}
                      {selectedOrder.cancellation_reason && <p className="text-[#B0B0B0] mt-0.5">{(language === "en" ? "Reason" : "Raison")}: {selectedOrder.cancellation_reason}</p>}
                    </>
                  )}
                  {selectedOrder.status === "REMOVED_BY_ADMIN" && selectedOrder.remover && (
                    <p className="text-[#B0B0B0]">{(language === "en" ? "Removed by" : "Supprimé par")}: {(selectedOrder.remover?.name && String(selectedOrder.remover.name).trim()) || selectedOrder.remover?.email || "—"}</p>
                  )}
                </div>
              ) : null}
              <div>
                <Label className="text-[#B0B0B0]">{t.email}</Label>
                <div className="flex gap-2 mt-1">
                  <Input className="bg-[#252525] border-[#2A2A2A] text-white flex-1" type="email" value={orderDetailEmail} onChange={e => setOrderDetailEmail(e.target.value)} />
                  <Button size="sm" className="bg-[#E21836] hover:bg-[#c4142e] shrink-0" onClick={onSaveOrderEmail} disabled={orderDetailSaving}>{orderDetailSaving ? <Loader size="sm" className="[background:white] shrink-0" /> : t.saveEmail}</Button>
                </div>
              </div>
              <DialogFooter className="flex flex-wrap gap-2 sm:justify-start">
                {selectedOrder.status === "PAID" && (
                  <Button size="sm" variant="outline" className="border-[#2A2A2A] text-[#B0B0B0]" onClick={onResendTickets} disabled={orderDetailResendLoading || !selectedOrder.user_email}>
                    {orderDetailResendLoading ? <Loader size="sm" className="[background:white] shrink-0 mr-1" /> : <Send className="w-4 h-4 mr-1" />}{t.resendTickets}
                  </Button>
                )}
              </DialogFooter>
              <AdminOrderQrTicketsSection
                orderId={selectedOrder.id}
                open={!!selectedOrder}
                language={language}
                isSuperAdmin={isSuperAdmin}
                theme="pos"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {confirmTarget && (
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={(open) => { setConfirmOpen(open); if (!open) setConfirmTarget(null); }}
          title={confirmTarget.kind === "delete-outlet" ? (language === "en" ? "Delete this outlet?" : "Supprimer ce point de vente ?") : confirmTarget.kind === "delete-user" ? (language === "en" ? "Delete this user?" : "Supprimer cet utilisateur ?") : (language === "en" ? "Remove this order?" : "Supprimer cette commande ?")}
          confirmLabel={t.confirm}
          cancelLabel={t.cancel}
          onConfirm={handleConfirmAction}
          variant="danger"
          confirmLoading={confirmTarget.kind === "remove-order" && orderActionLoading?.orderId === confirmTarget.o.id && orderActionLoading?.action === "remove"}
          closeOnConfirm={confirmTarget.kind !== "remove-order"}
        />
      )}

      <ReasonDialog
        open={reasonDialogOpen}
        onOpenChange={(open) => { setReasonDialogOpen(open); if (!open) setRejectOrder(null); }}
        title={t.rejectTitle}
        inputLabel={t.rejectReason}
        confirmLabel={t.confirm}
        cancelLabel={t.cancel}
        onConfirm={handleRejectWithReason}
        confirmLoading={!!(rejectOrder && orderActionLoading?.orderId === rejectOrder.id && orderActionLoading?.action === "reject")}
        closeOnConfirm={false}
      />
    </div>
  );
}
