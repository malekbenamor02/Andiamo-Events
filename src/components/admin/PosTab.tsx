import React, { useState, useEffect, useRef } from "react";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
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
import { Plus, RefreshCw, Edit, Trash2, Copy, Check, X, Mail, Send, BarChart3, TrendingUp, Calendar as CalendarIcon, Building2, Users, Package, ShoppingCart, Activity } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { AdminOrderQrTicketsSection } from "@/pages/admin/components/AdminOrderQrTicketsSection";
import { PosOrderApproveConfirm } from "@/components/admin/PosOrderApproveConfirm";
import { PosOrderActionBar, type PosOrderActionBarOrder } from "@/components/admin/PosOrderActionBar";
import {
  AdminTabHeader,
  AdminMetricTile,
  AdminTabEmpty,
  AdminTabCard,
  AdminTabCardGrid,
  ADMIN_FILTERS_PANEL,
  ADMIN_FILTER_LABEL,
} from "@/pages/admin/components/AdminTabShell";
import {
  AnimatedUnderlineTabsList,
  ADMIN_UNDERLINE_TAB_TRIGGER_COMPACT_CLASS,
} from "@/pages/admin/components/AnimatedUnderlineTabs";

function fetcher(url: string, options?: RequestInit) {
  return fetch(`${getApiBaseUrl()}${url}`, { ...options, credentials: "include" });
}

const POS_TAB_TRIGGER = ADMIN_UNDERLINE_TAB_TRIGGER_COMPACT_CLASS;

function getPosOrderStatusDisplay(status: string, language: "en" | "fr") {
  switch (status) {
    case "PAID":
      return {
        dot: "bg-emerald-500",
        label: language === "en" ? "Paid" : "Payé",
        text: "text-emerald-600 dark:text-emerald-400",
      };
    case "PENDING_ADMIN_APPROVAL":
      return {
        dot: "bg-amber-500",
        label: language === "en" ? "Pending" : "En attente",
        text: "text-amber-600 dark:text-amber-400",
      };
    case "REJECTED":
      return {
        dot: "bg-destructive",
        label: language === "en" ? "Rejected" : "Rejeté",
        text: "text-destructive",
      };
    case "REMOVED_BY_ADMIN":
      return {
        dot: "bg-destructive",
        label: language === "en" ? "Removed" : "Supprimé",
        text: "text-destructive",
      };
    default:
      return {
        dot: "bg-muted-foreground",
        label: status,
        text: "text-muted-foreground",
      };
  }
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
  const [approveConfirmOrder, setApproveConfirmOrder] = useState<PosOrder | null>(null);
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
      if (r.ok) {
        loadOrders();
        setSelectedOrder((prev) => (prev?.id === o.id ? null : prev));
        toast({ title: "Approved", description: "Tickets & email sent" });
      } else {
        const e = await r.json();
        toast({ title: "Error", description: e.error, variant: "destructive" });
      }
    } finally {
      setOrderActionLoading(null);
    }
  };
  const resolveOrder = (o: PosOrderActionBarOrder): PosOrder | null => {
    if (selectedOrder?.id === o.id) return selectedOrder;
    return orders.find((x) => x.id === o.id) ?? null;
  };

  const requestApprove = (o: PosOrderActionBarOrder) => {
    const full = resolveOrder(o);
    if (full) setApproveConfirmOrder(full);
  };
  const onReject = (o: PosOrderActionBarOrder) => {
    const full = resolveOrder(o);
    if (full) {
      setRejectOrder(full);
      setReasonDialogOpen(true);
    }
  };
  const onRemove = (o: PosOrderActionBarOrder) => {
    const full = resolveOrder(o);
    if (full) {
      setConfirmTarget({ kind: "remove-order", o: full });
      setConfirmOpen(true);
    }
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
      if (r.ok) {
        loadOrders();
        setSelectedOrder((prev) => (prev?.id === order.id ? null : prev));
        toast({ title: "Rejected" });
        setReasonDialogOpen(false);
        setRejectOrder(null);
      } else { const e = await r.json().catch(() => ({})); toast({ title: "Error", description: (e as { error?: string }).error, variant: "destructive" }); }
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

  const orderActionLabels = {
    view: t.view,
    approve: t.approve,
    reject: t.reject,
    remove: t.remove,
  };

  const openOrderDetail = (o: PosOrder) => {
    setSelectedOrder(o);
    setOrderDetailEmail(o.user_email || "");
  };

  return (
    <div className="space-y-6">
      <AdminTabHeader title={t.title} />
      <Tabs value={subTab} onValueChange={setSubTab} className="w-full">
        <AnimatedUnderlineTabsList
          activeValue={subTab}
          className="flex h-auto w-full justify-start gap-0 overflow-x-auto scrollbar-hidden"
        >
          <TabsTrigger value="orders" className={POS_TAB_TRIGGER}>
            <ShoppingCart className="h-4 w-4 shrink-0" />
            {t.orders}
          </TabsTrigger>
          <TabsTrigger value="statistics" className={POS_TAB_TRIGGER}>
            <BarChart3 className="h-4 w-4 shrink-0" />
            {t.statistics}
          </TabsTrigger>
          <TabsTrigger value="outlets" className={POS_TAB_TRIGGER}>
            <Building2 className="h-4 w-4 shrink-0" />
            {t.outlets}
          </TabsTrigger>
          <TabsTrigger value="users" className={POS_TAB_TRIGGER}>
            <Users className="h-4 w-4 shrink-0" />
            {t.users}
          </TabsTrigger>
          <TabsTrigger value="audit" className={POS_TAB_TRIGGER}>
            <Activity className="h-4 w-4 shrink-0" />
            {t.audit}
          </TabsTrigger>
        </AnimatedUnderlineTabsList>

        <TabsContent value="outlets" className="mt-4">
          <Card className="border-border/60 bg-card">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-4">
              <CardTitle className="text-base font-semibold text-foreground">{t.outlets}</CardTitle>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={loadOutlets}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button size="sm" className="h-8 gap-1" onClick={() => { setCreateOutlet(true); setForm({ name: "" }); }}>
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">{t.add}</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {outlets.length === 0 ? (
                <AdminTabEmpty message={t.noOutlets} />
              ) : (
                <div className="-mx-1 overflow-x-auto px-1">
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
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => onDeleteOutlet(o)}>{t.delete}</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="mt-4">
          <Card className="border-border/60 bg-card">
            <CardHeader className="space-y-4 pb-4">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base font-semibold text-foreground">{t.users}</CardTitle>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={loadUsers}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button size="sm" className="h-8 gap-1" onClick={() => { setCreateUser(true); setForm({ pos_outlet_id: outletId || outlets[0]?.id || "", name: "", email: "", password: "" }); }}>
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">{t.add}</span>
                  </Button>
                </div>
              </div>
              <div className={ADMIN_FILTERS_PANEL}>
                <Label className={ADMIN_FILTER_LABEL}>{t.outlet}</Label>
                <Select value={outletFilter === "__none__" ? "__all__" : outletFilter} onValueChange={setOutletFilter}>
                  <SelectTrigger className="h-9 w-full bg-background sm:max-w-xs">
                    <SelectValue placeholder={t.outlet} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">{language === "en" ? "All" : "Tous"}</SelectItem>
                    {outlets.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {users.length === 0 ? (
                <AdminTabEmpty message={t.noUsers} />
              ) : (
                <div className="-mx-1 overflow-x-auto px-1">
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
                        <TableCell><span className={u.is_active && !u.is_paused ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}>{u.is_active && !u.is_paused ? "✓" : "✗"}</span></TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="mr-1" onClick={() => { setEditUser(u); setForm({ name: u.name, email: u.email, is_active: (u.is_active && !u.is_paused) ? "1" : "0", password: "" }); }}>{t.edit}</Button>
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => onDeleteUser(u)}>{t.delete}</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders" className="mt-4">
          <Card className="border-border/60 bg-card">
            <CardHeader className="space-y-4 pb-4">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base font-semibold text-foreground">{t.orders}</CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 shrink-0 gap-1.5"
                  onClick={loadOrders}
                  disabled={ordersLoading}
                >
                  <RefreshCw className={cn("h-4 w-4", ordersLoading && "animate-spin")} />
                  <span className="hidden sm:inline">
                    {language === "en" ? "Refresh" : "Actualiser"}
                  </span>
                </Button>
              </div>
              <div className={ADMIN_FILTERS_PANEL}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <Label className={ADMIN_FILTER_LABEL}>{t.outlet}</Label>
                    <Select
                      value={outletFilter === "__none__" ? "__all__" : outletFilter}
                      onValueChange={setOutletFilter}
                    >
                      <SelectTrigger className="h-9 w-full bg-background">
                        <SelectValue placeholder={t.name} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">{t.name}</SelectItem>
                        {outlets.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className={ADMIN_FILTER_LABEL}>{t.status}</Label>
                    <Select value={orderStatusFilter} onValueChange={setOrderStatusFilter}>
                      <SelectTrigger className="h-9 w-full bg-background">
                        <SelectValue placeholder={t.status} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">{t.status}</SelectItem>
                        <SelectItem value="PENDING_ADMIN_APPROVAL">PENDING_ADMIN_APPROVAL</SelectItem>
                        <SelectItem value="PAID">PAID</SelectItem>
                        <SelectItem value="REJECTED">REJECTED</SelectItem>
                        <SelectItem value="REMOVED_BY_ADMIN">REMOVED_BY_ADMIN</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-2 lg:col-span-1">
                    <Label className={ADMIN_FILTER_LABEL}>{t.event}</Label>
                    <Select value={orderEventFilter} onValueChange={setOrderEventFilter}>
                      <SelectTrigger className="h-9 w-full bg-background">
                        <SelectValue placeholder={t.event} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">
                          {language === "en" ? "All events" : "Tous"}
                        </SelectItem>
                        {selectedEventId && !eventsReady ? (
                          <SelectItem value={selectedEventId} disabled>
                            {language === "en" ? "Loading events…" : "Chargement des événements…"}
                          </SelectItem>
                        ) : null}
                        {events.map((ev) => (
                          <SelectItem key={ev.id} value={ev.id}>
                            {ev.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <Label className={ADMIN_FILTER_LABEL}>
                      {language === "en" ? "From" : "De"}
                    </Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "h-9 w-full justify-start text-left font-normal bg-background",
                            !orderFrom && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                          <span className="truncate">
                            {orderFrom
                              ? format(new Date(`${orderFrom}T00:00:00`), "dd/MM/yyyy")
                              : language === "en"
                                ? "Pick date"
                                : "Choisir"}
                          </span>
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
                          <div className="flex justify-end border-t border-border p-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => setOrderFrom("")}
                            >
                              <X className="mr-1 h-3 w-3" />
                              {language === "en" ? "Clear" : "Effacer"}
                            </Button>
                          </div>
                        )}
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label className={ADMIN_FILTER_LABEL}>
                      {language === "en" ? "To" : "À"}
                    </Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "h-9 w-full justify-start text-left font-normal bg-background",
                            !orderTo && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                          <span className="truncate">
                            {orderTo
                              ? format(new Date(`${orderTo}T00:00:00`), "dd/MM/yyyy")
                              : language === "en"
                                ? "Pick date"
                                : "Choisir"}
                          </span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={orderTo ? new Date(`${orderTo}T00:00:00`) : undefined}
                          onSelect={(date) => setOrderTo(date ? format(date, "yyyy-MM-dd") : "")}
                          disabled={
                            orderFrom ? { before: new Date(`${orderFrom}T00:00:00`) } : undefined
                          }
                          initialFocus
                        />
                        {orderTo && (
                          <div className="flex justify-end border-t border-border p-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => setOrderTo("")}
                            >
                              <X className="mr-1 h-3 w-3" />
                              {language === "en" ? "Clear" : "Effacer"}
                            </Button>
                          </div>
                        )}
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading && (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Loader size="sm" />
                  ...
                </p>
              )}
              {ordersLoading ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader size="sm" />
                  {language === "en" ? "Loading orders…" : "Chargement des commandes…"}
                </p>
              ) : orders.length === 0 ? (
                <AdminTabEmpty message={t.noOrders} />
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
                                const conf = getPosOrderStatusDisplay(o.status, language);
                                return (
                                  <span className="inline-flex items-center gap-1.5" title={o.status}>
                                    <span className={`h-2 w-2 shrink-0 rounded-full ${conf.dot}`} />
                                    <span className={cn("text-sm", conf.text)}>{conf.label}</span>
                                  </span>
                                );
                              })()}
                            </TableCell>
                            <TableCell className="text-muted-foreground">{(o.pos_outlets as { name?: string })?.name || "—"}</TableCell>
                            <TableCell>
                              <PosOrderActionBar
                                order={o}
                                labels={orderActionLabels}
                                layout="inline"
                                orderActionLoading={orderActionLoading}
                                onView={() => openOrderDetail(o)}
                                onRequestApprove={requestApprove}
                                onRequestReject={onReject}
                                onRequestRemove={onRemove}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Mobile: cards view */}
                  <AdminTabCardGrid className="md:hidden">
                  {orders.map((o) => {
                    const conf = getPosOrderStatusDisplay(o.status, language);

                    return (
                      <AdminTabCard key={o.id} className="gap-3 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs tabular-nums text-muted-foreground">
                                #{o.order_number ?? o.id.slice(0, 8)}
                              </p>
                              <p className="mt-0.5 text-sm font-medium text-foreground">
                                {o.user_name}
                              </p>
                              <p className="text-xs text-muted-foreground">{o.user_phone}</p>
                            </div>

                            <span className="inline-flex shrink-0 items-center gap-1.5" title={o.status}>
                              <span className={`h-2 w-2 shrink-0 rounded-full ${conf.dot}`} />
                              <span className={cn("text-xs font-medium", conf.text)}>{conf.label}</span>
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-3 border-t border-border/50 pt-3">
                            <div>
                              <p className={ADMIN_FILTER_LABEL}>{t.total}</p>
                              <p className="text-sm font-semibold tabular-nums text-primary">
                                {o.total_price} DT
                              </p>
                            </div>
                            <div className="min-w-0">
                              <p className={ADMIN_FILTER_LABEL}>{t.outlet}</p>
                              <p className="truncate text-sm text-muted-foreground">
                                {(o.pos_outlets as { name?: string })?.name || "—"}
                              </p>
                            </div>
                          </div>

                          <PosOrderActionBar
                            order={o}
                            labels={orderActionLabels}
                            layout="grid"
                            orderActionLoading={orderActionLoading}
                            onView={() => openOrderDetail(o)}
                            onRequestApprove={requestApprove}
                            onRequestReject={onReject}
                            onRequestRemove={onRemove}
                          />
                      </AdminTabCard>
                    );
                  })}
                </AdminTabCardGrid>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="statistics" className="mt-4">
          <Card className="border-border/60 bg-card">
            <CardHeader className="space-y-4 pb-4">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  {t.statistics}
                </CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 shrink-0"
                  onClick={loadStats}
                  disabled={statsLoading}
                >
                  {statsLoading ? (
                    <Loader size="sm" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <div className={ADMIN_FILTERS_PANEL}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="sm:col-span-3 lg:col-span-1">
                    <Label className={ADMIN_FILTER_LABEL}>{t.outlet}</Label>
                    <Select value={statsOutletFilter} onValueChange={setStatsOutletFilter}>
                      <SelectTrigger className="h-9 w-full bg-background">
                        <SelectValue placeholder={t.outlet} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">
                          {language === "en" ? "All outlets" : "Tous"}
                        </SelectItem>
                        {outlets.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className={ADMIN_FILTER_LABEL}>
                      {language === "en" ? "From" : "De"}
                    </Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "h-9 w-full justify-start bg-background text-left font-normal",
                            !statsFrom && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                          <span className="truncate">
                            {statsFrom
                              ? format(new Date(`${statsFrom}T00:00:00`), "dd/MM/yyyy")
                              : language === "en"
                                ? "Pick date"
                                : "Choisir"}
                          </span>
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
                          <div className="flex justify-end border-t border-border p-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => setStatsFrom("")}
                            >
                              <X className="mr-1 h-3 w-3" />
                              {language === "en" ? "Clear" : "Effacer"}
                            </Button>
                          </div>
                        )}
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label className={ADMIN_FILTER_LABEL}>
                      {language === "en" ? "To" : "À"}
                    </Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "h-9 w-full justify-start bg-background text-left font-normal",
                            !statsTo && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                          <span className="truncate">
                            {statsTo
                              ? format(new Date(`${statsTo}T00:00:00`), "dd/MM/yyyy")
                              : language === "en"
                                ? "Pick date"
                                : "Choisir"}
                          </span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={statsTo ? new Date(`${statsTo}T00:00:00`) : undefined}
                          onSelect={(date) => setStatsTo(date ? format(date, "yyyy-MM-dd") : "")}
                          disabled={
                            statsFrom ? { before: new Date(`${statsFrom}T00:00:00`) } : undefined
                          }
                          initialFocus
                        />
                        {statsTo && (
                          <div className="flex justify-end border-t border-border p-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => setStatsTo("")}
                            >
                              <X className="mr-1 h-3 w-3" />
                              {language === "en" ? "Clear" : "Effacer"}
                            </Button>
                          </div>
                        )}
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {statsLoading ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader size="sm" />
                  {language === "en" ? "Loading…" : "Chargement…"}
                </p>
              ) : stats ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <AdminMetricTile label={t.totalOrders} value={stats.totalOrders} />
                    <AdminMetricTile
                      label={`${t.totalRevenue} (${language === "en" ? "paid only" : "payé uniquement"})`}
                      value={`${(stats.totalRevenue ?? 0).toFixed(2)} DT`}
                      accent="primary"
                    />
                  </div>
                  <div>
                    <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {language === "en" ? "By status" : "Par statut"}
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <AdminMetricTile
                        label={t.paidOrders}
                        value={
                          <span>
                            {stats.paidOrders ?? 0}
                            <span className="mt-1 block text-sm font-normal text-muted-foreground">
                              {t.paidRevenue}: {(stats.paidRevenue ?? 0).toFixed(2)} DT
                            </span>
                          </span>
                        }
                        accent="emerald"
                      />
                      <AdminMetricTile
                        label={t.pendingOrders}
                        value={
                          <span>
                            {stats.pendingOrders ?? 0}
                            <span className="mt-1 block text-sm font-normal text-muted-foreground">
                              {t.pendingRevenue}: {(stats.pendingRevenue ?? 0).toFixed(2)} DT
                            </span>
                          </span>
                        }
                        accent="amber"
                      />
                      <AdminMetricTile
                        label={t.rejectedOrders}
                        value={stats.rejectedOrders ?? 0}
                        accent="destructive"
                      />
                      <AdminMetricTile
                        label={t.removedOrders}
                        value={stats.removedOrders ?? 0}
                      />
                    </div>
                  </div>
                  {stats.daily && stats.daily.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-foreground mb-2">{t.daily} ({language === "en" ? "paid only" : "payés uniquement"})</p>
                      <ResponsiveContainer width="100%" height={240}>
                        <LineChart data={stats.daily}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                          <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                          <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} labelStyle={{ color: "hsl(var(--foreground))" }} />
                          <Legend />
                          <Line type="monotone" dataKey="orders" stroke="hsl(var(--primary))" name={language === "en" ? "Paid orders" : "Commandes payées"} strokeWidth={2} />
                          <Line type="monotone" dataKey="revenue" stroke="hsl(142 76% 36%)" name={language === "en" ? "Paid revenue (DT)" : "Chiffre payé (DT)"} strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {stats.byOutlet && stats.byOutlet.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-foreground mb-2">{t.byOutlet} ({language === "en" ? "paid only" : "payés uniquement"})</p>
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
                              <TableCell className="text-primary font-medium tabular-nums">{x.total_revenue.toFixed(2)} DT</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                  {stats.byPassType && Object.keys(stats.byPassType).length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-foreground mb-2">{t.byPassType} ({language === "en" ? "paid tickets only" : "billets payés uniquement"})</p>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={Object.entries(stats.byPassType).map(([k, v]) => ({ name: k, count: v }))} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                          <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                          <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                          <Bar dataKey="count" fill="hsl(var(--primary))" name={language === "en" ? "Paid tickets" : "Billets payés"} radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {stats.byStatus && Object.keys(stats.byStatus).length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-foreground mb-2">{t.byStatus}</p>
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
          <Card className="border-border/60 bg-card">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-4">
              <CardTitle className="text-base font-semibold text-foreground">{t.audit}</CardTitle>
              <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={loadAudit}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {audit.length === 0 ? (
                <AdminTabEmpty message={t.noAudit} />
              ) : (
                <div className="-mx-1 overflow-x-auto px-1">
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
                </div>
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
            <Button className="w-full" onClick={onSaveOutlet}>{editOutlet ? "Save" : "Create"}</Button>
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
            <Button className="w-full" onClick={onSaveUser}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Order detail: client info, edit email, resend */}
      <Dialog open={!!selectedOrder} onOpenChange={(o) => { if (!o) setSelectedOrder(null); }}>
        <DialogContent className="max-h-[90vh] max-w-lg gap-0 overflow-hidden p-0">
          {selectedOrder && (
            <>
              <DialogHeader className="space-y-2 border-b border-border/50 px-5 py-4 sm:px-6">
                <div className="flex items-start justify-between gap-3">
                  <DialogTitle className="text-base font-semibold">
                    #{selectedOrder.order_number ?? selectedOrder.id.slice(0, 8)}
                  </DialogTitle>
                  {(() => {
                    const conf = getPosOrderStatusDisplay(selectedOrder.status, language);
                    return (
                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border/60 bg-muted/30 px-2 py-1">
                        <span className={cn("h-2 w-2 rounded-full", conf.dot)} />
                        <span className={cn("text-xs font-medium", conf.text)}>{conf.label}</span>
                      </span>
                    );
                  })()}
                </div>
              </DialogHeader>

              <div className="max-h-[min(60vh,32rem)] space-y-4 overflow-y-auto px-5 py-4 sm:px-6">
                <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2">
                  <p className={ADMIN_FILTER_LABEL}>{t.clientInfo}</p>
                  <p className="text-sm font-medium">{selectedOrder.user_name}</p>
                  <p className="text-sm text-muted-foreground">{t.phone}: {selectedOrder.user_phone}</p>
                  <p className="text-sm text-muted-foreground">{t.email}: {selectedOrder.user_email || "—"}</p>
                  <p className="text-sm text-muted-foreground">{t.city}: {selectedOrder.city || "—"} · {t.ville}: {selectedOrder.ville || "—"}</p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <p className={ADMIN_FILTER_LABEL}>{t.outlet}</p>
                    <p className="text-sm text-foreground">{(selectedOrder.pos_outlets as { name?: string })?.name || "—"}</p>
                  </div>
                  {(selectedOrder.events as { name?: string })?.name && (
                    <div>
                      <p className={ADMIN_FILTER_LABEL}>{t.event}</p>
                      <p className="text-sm text-foreground">{(selectedOrder.events as { name?: string })?.name}</p>
                    </div>
                  )}
                </div>

                <div>
                  <p className={ADMIN_FILTER_LABEL}>{t.pass}</p>
                  <p className="text-sm text-muted-foreground">
                    {(selectedOrder.order_passes || [])
                      .map((p) => `${p.pass_type} ×${p.quantity} — ${(p.price * p.quantity).toFixed(2)} DT`)
                      .join(" · ") || "—"}
                  </p>
                </div>

                <p className="text-base font-semibold tabular-nums text-primary">
                  {t.total}: {selectedOrder.total_price} DT
                </p>

                {(selectedOrder.status === "PAID" && selectedOrder.approver) ||
                (selectedOrder.status === "REJECTED" &&
                  (selectedOrder.rejector || selectedOrder.cancellation_reason)) ||
                (selectedOrder.status === "REMOVED_BY_ADMIN" && selectedOrder.remover) ? (
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-sm text-muted-foreground">
                    {selectedOrder.status === "PAID" && selectedOrder.approver && (
                      <p>
                        {language === "en" ? "Approved by" : "Approuvé par"}:{" "}
                        {(selectedOrder.approver?.name && String(selectedOrder.approver.name).trim()) ||
                          selectedOrder.approver?.email ||
                          "—"}
                      </p>
                    )}
                    {selectedOrder.status === "REJECTED" && (
                      <>
                        {selectedOrder.rejector && (
                          <p>
                            {language === "en" ? "Rejected by" : "Rejeté par"}:{" "}
                            {(selectedOrder.rejector?.name && String(selectedOrder.rejector.name).trim()) ||
                              selectedOrder.rejector?.email ||
                              "—"}
                          </p>
                        )}
                        {selectedOrder.cancellation_reason && (
                          <p className="mt-1">
                            {language === "en" ? "Reason" : "Raison"}: {selectedOrder.cancellation_reason}
                          </p>
                        )}
                      </>
                    )}
                    {selectedOrder.status === "REMOVED_BY_ADMIN" && selectedOrder.remover && (
                      <p>
                        {language === "en" ? "Removed by" : "Supprimé par"}:{" "}
                        {(selectedOrder.remover?.name && String(selectedOrder.remover.name).trim()) ||
                          selectedOrder.remover?.email ||
                          "—"}
                      </p>
                    )}
                  </div>
                ) : null}

                <div>
                  <Label className={ADMIN_FILTER_LABEL}>{t.email}</Label>
                  <div className="mt-1 flex gap-2">
                    <Input
                      className="h-9 flex-1 bg-background"
                      type="email"
                      value={orderDetailEmail}
                      onChange={(e) => setOrderDetailEmail(e.target.value)}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 shrink-0"
                      onClick={onSaveOrderEmail}
                      disabled={orderDetailSaving}
                    >
                      {orderDetailSaving ? <Loader size="sm" className="shrink-0" /> : t.saveEmail}
                    </Button>
                  </div>
                </div>

                {selectedOrder.status === "PAID" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5"
                    onClick={onResendTickets}
                    disabled={orderDetailResendLoading || !selectedOrder.user_email}
                  >
                    {orderDetailResendLoading ? (
                      <Loader size="sm" className="shrink-0" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    {t.resendTickets}
                  </Button>
                )}

                <AdminOrderQrTicketsSection
                  orderId={selectedOrder.id}
                  open={!!selectedOrder}
                  language={language}
                  isSuperAdmin={isSuperAdmin}
                  theme="pos"
                />
              </div>

              {(selectedOrder.status === "PENDING_ADMIN_APPROVAL" ||
                selectedOrder.status === "PAID") && (
                <DialogFooter className="border-t border-border/50 px-5 py-4 sm:px-6">
                  <PosOrderActionBar
                    order={selectedOrder}
                    labels={orderActionLabels}
                    layout="grid"
                    showView={false}
                    orderActionLoading={orderActionLoading}
                    onRequestApprove={requestApprove}
                    onRequestReject={onReject}
                    onRequestRemove={onRemove}
                  />
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <PosOrderApproveConfirm
        open={!!approveConfirmOrder}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setApproveConfirmOrder(null);
        }}
        order={approveConfirmOrder}
        language={language}
        onConfirm={async () => {
          if (!approveConfirmOrder) return;
          await onApprove(approveConfirmOrder);
          setApproveConfirmOrder(null);
        }}
        isSubmitting={
          !!approveConfirmOrder &&
          orderActionLoading?.orderId === approveConfirmOrder.id &&
          orderActionLoading?.action === "approve"
        }
      />

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
