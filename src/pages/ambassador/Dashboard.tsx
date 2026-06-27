import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CancelOrderDialog } from "./components/CancelOrderDialog";
import { ConfirmOrderDialog } from "./components/ConfirmOrderDialog";
import { EditProfileDialog } from "./components/EditProfileDialog";
import { PaymentConfirmedSuccess } from "./components/PaymentConfirmedSuccess";
import { OrderCancelledSuccess } from "./components/OrderCancelledSuccess";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AmbassadorTabIndicator,
  AmbassadorTabLayoutGroup,
  AmbassadorTabPanel,
} from "./components/AnimatedTabPanel";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { LogOut, AlertCircle } from "lucide-react";
import { SalesClosedState } from "./components/SalesClosedState";
import LoadingScreen from "@/components/ui/LoadingScreen";
import { fetchSalesSettings, subscribeToSalesSettings } from "@/lib/salesSettings";
import { API_ROUTES, buildFullApiUrl, getApiBaseUrl } from "@/lib/api-routes";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";
import { filterAmbassadorDashboardEvents, formatDateDMY } from "@/lib/date-utils";
import { isLocalhostClient } from "@/lib/localhost";
import type {
  AmbassadorDashboardProps,
  Order,
  Ambassador,
  PerformanceData,
} from "./types";
import { NewOrdersTab } from "./components/NewOrdersTab";
import { HistoryTab } from "./components/HistoryTab";
import { PerformanceTab } from "./components/PerformanceTab";
import { ProfileTab } from "./components/ProfileTab";

const EMPTY_PERFORMANCE: PerformanceData = {
  total: 0,
  paid: 0,
  completed: 0,
  cancelled: 0,
  rejected: 0,
  ignored: 0,
  totalPassesSold: 0,
  baseCommission: 0,
  totalBonuses: 0,
  commission: 0,
  completionRate: "0",
  cancellationRate: "0",
  rejectionRate: "0",
  ignoreRate: "0",
  totalRevenue: 0,
  averageResponseTime: 0,
};

const AmbassadorDashboard = ({ language }: AmbassadorDashboardProps) => {
  const [ambassador, setAmbassador] = useState<Ambassador | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('new-orders');
  const [newOrders, setNewOrders] = useState<Order[]>([]); // PENDING_CASH orders
  const [historyOrders, setHistoryOrders] = useState<Order[]>([]); // PAID, COMPLETED orders
  const [performance, setPerformance] = useState<any>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [paymentSuccessOpen, setPaymentSuccessOpen] = useState(false);
  const [paymentSuccessSummary, setPaymentSuccessSummary] = useState<{
    customerName: string;
    amount: number;
  } | null>(null);
  const [cancelSuccessOpen, setCancelSuccessOpen] = useState(false);
  const [cancelSuccessSummary, setCancelSuccessSummary] = useState<{
    customerName: string;
    amount: number;
  } | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');

  const [profileForm, setProfileForm] = useState({
    password: '',
    confirmPassword: ''
  });

  const [salesEnabled, setSalesEnabled] = useState(true);
  const [filterableEvents, setFilterableEvents] = useState<
    Array<{
      id: string;
      name: string;
      date: string;
      event_type?: string | null;
      event_status?: string | null;
      is_test?: boolean | null;
    }>
  >([]);
  const [selectedEventFilter, setSelectedEventFilter] = useState<string>("");
  const [eventsFetchState, setEventsFetchState] = useState<"idle" | "loaded">(
    "idle"
  );

  const navigate = useNavigate();
  const { toast } = useToast();

  const t = language === 'en' ? {
    title: "Ambassador Dashboard",
    welcome: "Welcome",
    assignedOrders: "Assigned Orders",
    completedOrders: "Completed Orders",
    performance: "Performance",
    profile: "Profile",
    logout: "Logout",
    loading: "Loading your dashboard...",
    accept: "Accept",
    cancel: "Cancel",
    complete: "Complete",
    customerName: "Customer Name",
    phone: "Phone",
    email: "Email",
    city: "City",
    ville: "Ville",
    passType: "Pass Type",
    quantity: "Quantity",
    totalPrice: "Total Price",
    status: "Status",
    assignedAt: "Assigned At",
    actions: "Actions",
    noAssignedOrders: "No orders for this event.",
    noCompletedOrders: "No completed orders yet",
    event: "Event",
    selectEvent: "Select event",
    filterByEvent: "Filter by event",
    save: "Save",
    cancelOrder: "Cancel Order",
    cancelReason: "Cancellation Reason",
    confirmCancel: "Confirm cancellation",
    keepOrder: "Keep order",
    confirmOrder: "Confirm order",
    confirmPayment: "Confirm payment",
    goBack: "Go back",
    reasonRequired: "Please provide a cancellation reason",
    orderAccepted: "Order accepted successfully",
    orderCancelled: "Order cancelled",
    orderCompleted: "Order completed successfully",
    error: "Error",
    editProfile: "Edit Profile",
    currentPhone: "Current Phone",
    newPhone: "New Phone",
    newPassword: "New Password",
    confirmPassword: "Confirm Password",
    passwordMismatch: "Passwords do not match",
    profileUpdated: "Profile updated successfully",
    completionRate: "Completion Rate",
    cancellationRate: "Cancellation Rate",
    rejectionRate: "Rejection Rate",
    ignoreRate: "Ignore Rate",
    avgResponseTime: "Avg Response Time",
    totalOrders: "Total Orders",
    totalRevenue: "Total Revenue",
    commissionEarned: "Commission Earned",
    pending: "Pending",
    accepted: "Accepted",
    cancelled: "Cancelled",
    completed: "Completed",
    standard: "Standard",
    vip: "VIP",
    cod: "Cash on Delivery",
    online: "Online Payment",
    salesDisabled: "Sales are currently disabled",
    salesDisabledMessage:
      "Orders will show up here once sales go live. Check back soon — there's nothing to do for now.",
    salesDisabledTitle: "Sales haven't started yet",
    suspended: "Account Paused",
    suspendedMessage: "Your ambassador account has been temporarily paused. Please contact support for more information.",
    suspendedTitle: "Account Temporarily Paused",
    noUpcomingEvents: "No active ambassador events available."
  } : {
    title: "Tableau de Bord Ambassadeur",
    welcome: "Bienvenue",
    assignedOrders: "Commandes Assignées",
    completedOrders: "Commandes Terminées",
    performance: "Performance",
    profile: "Profil",
    logout: "Déconnexion",
    loading: "Chargement de votre tableau de bord...",
    accept: "Accepter",
    cancel: "Annuler",
    complete: "Terminer",
    customerName: "Nom du Client",
    phone: "Téléphone",
    email: "Email",
    city: "Ville",
    ville: "Quartier",
    passType: "Type de Pass",
    quantity: "Quantité",
    totalPrice: "Prix Total",
    status: "Statut",
    assignedAt: "Assigné Le",
    actions: "Actions",
    noAssignedOrders: "Aucune commande pour cet événement.",
    noCompletedOrders: "Aucune commande terminée",
    event: "Événement",
    selectEvent: "Sélectionner un événement",
    filterByEvent: "Filtrer par événement",
    noUpcomingEvents: "Aucun événement actif disponible pour les ambassadeurs",
    save: "Enregistrer",
    cancelOrder: "Annuler la Commande",
    cancelReason: "Raison d'Annulation",
    confirmCancel: "Confirmer l'annulation",
    keepOrder: "Garder la commande",
    confirmOrder: "Confirmer la commande",
    confirmPayment: "Confirmer le paiement",
    goBack: "Retour",
    reasonRequired: "Veuillez fournir une raison d'annulation",
    orderAccepted: "Commande acceptée avec succès",
    orderCancelled: "Commande annulée",
    orderCompleted: "Commande terminée avec succès",
    error: "Erreur",
    editProfile: "Modifier le Profil",
    currentPhone: "Téléphone Actuel",
    newPhone: "Nouveau Téléphone",
    newPassword: "Nouveau Mot de Passe",
    confirmPassword: "Confirmer le Mot de Passe",
    passwordMismatch: "Les mots de passe ne correspondent pas",
    profileUpdated: "Profil mis à jour avec succès",
    completionRate: "Taux de Réussite",
    cancellationRate: "Taux d'Annulation",
    rejectionRate: "Taux de Rejet",
    ignoreRate: "Taux d'Ignoré",
    avgResponseTime: "Temps de Réponse Moyen",
    totalOrders: "Total des Commandes",
    totalRevenue: "Revenu Total",
    commissionEarned: "Commission Gagnée",
    pending: "En Attente",
    accepted: "Accepté",
    cancelled: "Annulé",
    completed: "Terminé",
    standard: "Standard",
    vip: "VIP",
    cod: "Paiement à la Livraison",
    online: "Paiement en Ligne",
    salesDisabled: "Les ventes sont actuellement désactivées",
    salesDisabledMessage:
      "Les commandes apparaîtront ici dès l'ouverture des ventes. Revenez bientôt — rien à faire pour l'instant.",
    salesDisabledTitle: "Les ventes n'ont pas encore commencé",
    suspended: "Compte en Pause",
    suspendedMessage: "Votre compte d'ambassadeur a été temporairement mis en pause. Veuillez contacter le support pour plus d'informations.",
    suspendedTitle: "Compte Temporairement en Pause"
  };

  useEffect(() => {
    const loadAmbassadorData = async () => {
      try {
        const res = await fetch(
          `${getApiBaseUrl()}${API_ROUTES.AMBASSADOR_ME}`,
          { credentials: 'include' }
        );
        const data = await res.json().catch(() => ({}));

        if (!res.ok || !data?.ambassador) {
          navigate('/ambassador/auth');
          return;
        }

        setAmbassador(data.ambassador as Ambassador);

        if (data.ambassador.status === 'suspended') {
          setLoading(false);
        }
      } catch (error) {
        console.error('Error fetching ambassador session:', error);
        navigate('/ambassador/auth');
      }
    };
    
    loadAmbassadorData();
    setProfileForm({ password: '', confirmPassword: '' });
    
    // Fetch sales settings
    const loadSalesSettings = async () => {
      const settings = await fetchSalesSettings();
      setSalesEnabled(settings.enabled);
    };
    loadSalesSettings();
    
    // Subscribe to sales settings changes
    const unsubscribe = subscribeToSalesSettings((settings) => {
      setSalesEnabled(settings.enabled);
    });
    
    return () => {
      unsubscribe();
    };
  }, [navigate]);
  

  // Helper function to extract passes from order (order_passes, notes, or fallback)
  const getOrderPasses = (order: any): Array<{ pass_type: string; quantity: number; price: number }> => {
    // First try: use order_passes (new system)
    if (order.order_passes && order.order_passes.length > 0) {
      return order.order_passes.map((pass: any) => ({
        pass_type: pass.pass_type,
        quantity: pass.quantity || 0,
        price: pass.price || 0
      }));
    }
    
    // Second try: parse from notes (legacy system)
    if (order.notes) {
      try {
        const notesData = typeof order.notes === 'string' ? JSON.parse(order.notes) : order.notes;
        if (notesData?.all_passes && Array.isArray(notesData.all_passes)) {
          return notesData.all_passes.map((p: any) => ({
            pass_type: p.passName || p.pass_type || 'standard',
            quantity: p.quantity || 0,
            price: p.price || 0
          }));
        }
      } catch (e) {
        console.error('Error parsing order notes:', e);
      }
    }
    
    return [];
  };

  const fetchData = useCallback(
    async (options?: { silent?: boolean }) => {
      if (eventsFetchState !== "loaded") {
        return;
      }

      if (!selectedEventFilter) {
        setNewOrders([]);
        setHistoryOrders([]);
        setPerformance({ ...EMPTY_PERFORMANCE });
        if (!options?.silent) {
          setLoading(false);
        }
        return;
      }

      if (!options?.silent) {
        setLoading(true);
      }
      const eventQs = `&event_id=${encodeURIComponent(selectedEventFilter)}`;
      try {
        const apiBase = getApiBaseUrl();

        const newOrdersUrl =
          buildFullApiUrl(API_ROUTES.AMBASSADOR_ORDERS, apiBase) +
          `?status=PENDING_CASH${eventQs}`;
        const newOrdersResponse = await fetch(newOrdersUrl, {
          credentials: "include",
        });

        if (newOrdersResponse.status === 401) {
          navigate('/ambassador/auth');
          return;
        }

        if (!newOrdersResponse.ok) {
          throw new Error("Failed to fetch new orders");
        }

        const newOrdersResult = await newOrdersResponse.json();
        const newRows = (newOrdersResult.data || []) as Order[];
        setNewOrders(
          newRows.filter((o) => o.event_id === selectedEventFilter)
        );

        const historyUrl =
          buildFullApiUrl(API_ROUTES.AMBASSADOR_ORDERS, apiBase) +
          `?limit=100${eventQs}`;
        const historyResponse = await fetch(historyUrl, {
          credentials: "include",
        });

        if (!historyResponse.ok) {
          throw new Error("Failed to fetch history orders");
        }

        const historyResult = await historyResponse.json();
        const filteredHistory = (historyResult.data || [])
          .filter((order: Order) => order.status !== "PENDING_CASH")
          .filter((order: Order) => order.event_id === selectedEventFilter);
        setHistoryOrders(filteredHistory);

        try {
          const performanceUrl =
            buildFullApiUrl(API_ROUTES.AMBASSADOR_PERFORMANCE, apiBase) +
            `?${eventQs.slice(1)}`;
          const performanceResponse = await fetch(performanceUrl, {
            credentials: "include",
          });

          if (!performanceResponse.ok) {
            throw new Error("Failed to fetch performance data");
          }

          const performanceResult = await performanceResponse.json();

          if (!performanceResult.success) {
            throw new Error(
              performanceResult.error || "Failed to fetch performance data"
            );
          }

          const performanceData = performanceResult.data;

          const total = performanceData.total || 0;
          const paid = performanceData.paid || 0;
          const cancelled = performanceData.cancelled || 0;
          const rejected = performanceData.rejected || 0;
          const ignored = performanceData.ignored || 0;
          const totalPassesSold = performanceData.totalPassesSold || 0;
          const totalRevenue = performanceData.totalRevenue || 0;
          const avgResponseTime = performanceData.averageResponseTime || 0;

          let baseCommission = 0;
          if (totalPassesSold > 7) {
            const paidPasses = totalPassesSold - 7;
            baseCommission = paidPasses * 3;
          }

          let totalBonuses = 0;
          if (totalPassesSold >= 15) {
            totalBonuses += 15;
          }
          if (totalPassesSold >= 25) {
            totalBonuses += 20;
          }
          if (totalPassesSold >= 35) {
            totalBonuses += 20;
          }

          const totalCommission = baseCommission + totalBonuses;

          setPerformance({
            total,
            paid,
            completed: 0,
            cancelled,
            rejected,
            ignored,
            totalPassesSold,
            baseCommission,
            totalBonuses,
            commission: totalCommission,
            completionRate: total > 0 ? ((paid / total) * 100).toFixed(1) : "0",
            cancellationRate:
              total > 0 ? ((cancelled / total) * 100).toFixed(1) : "0",
            rejectionRate:
              total > 0 ? ((rejected / total) * 100).toFixed(1) : "0",
            ignoreRate:
              total > 0 ? ((ignored / total) * 100).toFixed(1) : "0",
            totalRevenue,
            averageResponseTime: Math.round(avgResponseTime * 10) / 10,
          });
        } catch (error) {
          console.error("Error fetching performance:", error);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        toast({
          title: t.error,
          description: "Failed to fetch data.",
          variant: "destructive",
        });
      } finally {
        if (!options?.silent) {
          setLoading(false);
        }
      }
    },
    [eventsFetchState, selectedEventFilter, t.error, toast, navigate]
  );

  useEffect(() => {
    if (!ambassador?.id || ambassador.status === "suspended") return;
    let cancelled = false;
    setEventsFetchState("idle");
    (async () => {
      try {
        const res = await fetch(
          `${getApiBaseUrl()}${API_ROUTES.AMBASSADOR_EVENTS}`,
          { credentials: "include" }
        );
        if (cancelled) return;
        if (res.status === 401) {
          navigate("/ambassador/auth");
          return;
        }
        const body = await res.json().catch(() => ({}));
        type FilterableEvent = {
          id: string;
          name: string;
          date: string;
          event_type?: string | null;
          event_status?: string | null;
          is_test?: boolean | null;
        };
        const rows: FilterableEvent[] =
          res.ok && Array.isArray(body.events) ? body.events : [];
        const filtered = filterAmbassadorDashboardEvents(rows, {
          showTest: isLocalhostClient(),
        });
        setFilterableEvents(filtered);
        setSelectedEventFilter((prev) => {
          if (filtered.length === 0) return "";
          if (prev && filtered.some((e) => e.id === prev)) return prev;
          return filtered[0].id;
        });
        setEventsFetchState("loaded");
      } catch (error) {
        console.error("Error fetching ambassador events:", error);
        if (!cancelled) {
          setFilterableEvents([]);
          setSelectedEventFilter("");
          setEventsFetchState("loaded");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ambassador?.id, ambassador?.status, navigate]);

  useEffect(() => {
    if (!ambassador?.id || ambassador.status === "suspended") return;
    if (eventsFetchState !== "loaded") return;
    void fetchData();
  }, [
    ambassador?.id,
    ambassador?.status,
    selectedEventFilter,
    eventsFetchState,
    fetchData,
  ]);

  const handleConfirmCash = async () => {
    if (!selectedOrder) return;

    const orderId = selectedOrder.id;
    // Check if sales are enabled
    if (!salesEnabled) {
      toast({
        title: t.salesDisabledTitle,
        description: t.salesDisabledMessage,
        variant: "destructive"
      });
      return;
    }

    try {
      const apiBase = getApiBaseUrl();
      const response = await fetch(
        buildFullApiUrl(API_ROUTES.AMBASSADOR_CONFIRM_CASH, apiBase),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ orderId }),
        }
      );

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || 'Failed to confirm cash payment.');
      }

      setIsConfirmDialogOpen(false);
      setPaymentSuccessSummary({
        customerName: selectedOrder.user_name,
        amount: selectedOrder.total_price,
      });
      setPaymentSuccessOpen(true);
      setSelectedOrder(null);

      void fetchData({ silent: true });
    } catch (error: any) {
      console.error('Error confirming cash:', error);
      const errorMessage = error?.message || error?.error?.message || 'Failed to confirm cash payment.';
      toast({
        title: t.error,
        description: errorMessage,
        variant: "destructive"
      });
    }
  };

  const handleCancelOrder = async () => {
    // Check if sales are enabled
    if (!salesEnabled) {
      toast({
        title: t.salesDisabledTitle,
        description: t.salesDisabledMessage,
        variant: "destructive"
      });
      return;
    }

    if (!selectedOrder || !cancellationReason.trim()) {
      toast({
        title: t.error,
        description: t.reasonRequired,
        variant: "destructive"
      });
      return;
    }

    // Validate order can be cancelled
    if (selectedOrder.status === 'CANCELLED' || selectedOrder.status === 'CANCELLED_BY_AMBASSADOR' || selectedOrder.status === 'CANCELLED_BY_ADMIN') {
      toast({
        title: t.error,
        description: language === 'en' ? 'This order is already cancelled.' : 'Cette commande est déjà annulée.',
        variant: "destructive"
      });
      setIsCancelDialogOpen(false);
      setCancellationReason('');
      return;
    }

    if (selectedOrder.status === 'PAID' || selectedOrder.status === 'COMPLETED') {
      toast({
        title: t.error,
        description: language === 'en' ? 'Cannot cancel a paid or completed order.' : 'Impossible d\'annuler une commande payée ou terminée.',
        variant: "destructive"
      });
      setIsCancelDialogOpen(false);
      setCancellationReason('');
      return;
    }

    // Verify order belongs to this ambassador
    if (selectedOrder.ambassador_id !== ambassador?.id) {
      toast({
        title: t.error,
        description: language === 'en' ? 'You do not have permission to cancel this order.' : 'Vous n\'avez pas la permission d\'annuler cette commande.',
        variant: "destructive"
      });
      setIsCancelDialogOpen(false);
      setCancellationReason('');
      return;
    }

    try {
      const apiBase = getApiBaseUrl();
      const response = await fetch(
        buildFullApiUrl(API_ROUTES.AMBASSADOR_CANCEL_ORDER, apiBase),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            orderId: selectedOrder.id,
            reason: cancellationReason.trim(),
          }),
        }
      );

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || 'Failed to cancel order.');
      }

      setIsCancelDialogOpen(false);
      setCancelSuccessSummary({
        customerName: selectedOrder.user_name,
        amount: selectedOrder.total_price,
      });
      setCancelSuccessOpen(true);
      setSelectedOrder(null);
      setCancellationReason("");

      void fetchData({ silent: true });
    } catch (error: any) {
      console.error('Error cancelling order:', error);
      const errorMessage = error?.message || error?.error?.message || 'Failed to cancel order.';
      toast({
        title: t.error,
        description: errorMessage,
        variant: "destructive"
      });
    }
  };


  const handleUpdateProfile = async () => {
    if (profileForm.password && profileForm.password !== profileForm.confirmPassword) {
      toast({
        title: t.error,
        description: t.passwordMismatch,
        variant: "destructive"
      });
      return;
    }

    // Validate password length if provided
    if (profileForm.password && profileForm.password.length < 6) {
      toast({
        title: t.error,
        description: language === 'en' 
          ? "Password must be at least 6 characters" 
          : "Le mot de passe doit contenir au moins 6 caractères",
        variant: "destructive"
      });
      return;
    }

    try {
      // If password is being updated, use server-side API for secure hashing
      if (profileForm.password && profileForm.password.trim() !== '') {
        const apiBase = getApiBaseUrl();
        const passwordApiUrl = buildFullApiUrl(API_ROUTES.AMBASSADOR_UPDATE_PASSWORD, apiBase);
        
        if (!passwordApiUrl) {
          throw new Error('Invalid API URL configuration');
        }
        
        const response = await fetch(passwordApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            newPassword: profileForm.password
          })
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to update password');
        }

        toast({
          title: t.profileUpdated,
          description: result.requiresLogin
            ? (language === 'en'
              ? 'Password updated. Please log in again.'
              : 'Mot de passe mis à jour. Veuillez vous reconnecter.')
            : undefined,
          variant: "default"
        });

        setIsProfileDialogOpen(false);
        setProfileForm({ password: '', confirmPassword: '' });

        if (result.requiresLogin) {
          navigate('/ambassador/auth');
        }
        return;
      }

      // No changes to save
      toast({
        title: t.error,
        description: language === 'en' 
          ? "No changes to save" 
          : "Aucun changement à enregistrer",
        variant: "destructive"
      });
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast({
        title: t.error,
        description: error?.message || "Failed to update profile.",
        variant: "destructive"
      });
    }
  };

  const handleLogout = async () => {
    if (ambassador) {
      logger.action('Ambassador logged out', {
        category: 'authentication',
        userType: 'ambassador',
        details: { 
          name: ambassador.full_name,
          phone: ambassador.phone, 
          ambassadorId: ambassador.id 
        }
      });
    }

    try {
      await fetch(`${getApiBaseUrl()}${API_ROUTES.AMBASSADOR_LOGOUT}`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // proceed to auth page even if logout request fails
    }

    navigate('/ambassador/auth');
  };

  const getStatusBadge = (status: string) => {
    // Normalize status to handle both uppercase and lowercase
    const normalizedStatus = status.toUpperCase();
    
    // Status badge styling with proper colors
    if (normalizedStatus === 'ACCEPTED') {
      return (
        <Badge className="bg-gradient-to-r from-primary to-primary/90 text-white border-0 shadow-lg shadow-primary/30">
          {t.accepted}
        </Badge>
      );
    }
    if (normalizedStatus === 'APPROVED') {
      return (
        <Badge className="bg-green-500/20 text-green-300 border border-green-500/30 shadow-lg shadow-green-500/20">
          {language === 'en' ? 'Approved' : 'Approuvé'}
        </Badge>
      );
    }
    if (normalizedStatus === 'REJECTED') {
      return (
        <Badge className="bg-red-500/20 text-red-300 border border-red-500/30 shadow-lg shadow-red-500/20">
          {language === 'en' ? 'Rejected' : 'Rejeté'}
        </Badge>
      );
    }
    if (normalizedStatus === 'PENDING_ADMIN_APPROVAL') {
      return (
        <Badge className="bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 shadow-lg shadow-yellow-500/20">
          {language === 'en' ? 'Pending Admin Approval' : 'En Attente d\'Approbation Admin'}
        </Badge>
      );
    }
    if (normalizedStatus === 'PENDING') {
      return (
        <Badge className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-lg shadow-cyan-500/20">
          {t.pending}
        </Badge>
      );
    }
    if (normalizedStatus === 'CANCELLED_BY_AMBASSADOR' || normalizedStatus === 'CANCELLED_BY_ADMIN' || normalizedStatus === 'CANCELLED') {
      return (
        <Badge className="bg-red-500/20 text-red-300 border border-red-500/30 shadow-lg shadow-red-500/20">
          {t.cancelled}
        </Badge>
      );
    }
    if (normalizedStatus === 'COMPLETED') {
      return (
        <Badge className="bg-green-500/20 text-green-300 border border-green-500/30 shadow-lg shadow-green-500/20">
          {t.completed}
        </Badge>
      );
    }
    if (normalizedStatus === 'PENDING_CASH') {
      return (
        <Badge className="bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 shadow-lg shadow-yellow-500/20">
          {language === 'en' ? 'Pending Cash' : 'Paiement en Attente'}
        </Badge>
      );
    }
    if (normalizedStatus === 'PAID') {
      return (
        <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/30 shadow-lg shadow-blue-500/20">
          {language === 'en' ? 'Paid' : 'Payé'}
        </Badge>
      );
    }
    
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      'REFUNDED': { label: language === 'en' ? 'Refunded' : 'Remboursé', variant: "outline" },
      'FRAUD_SUSPECT': { label: language === 'en' ? 'Fraud Suspect' : 'Fraude Suspecte', variant: "destructive" },
      'IGNORED': { label: language === 'en' ? 'Ignored' : 'Ignoré', variant: "secondary" },
      'ON_HOLD': { label: language === 'en' ? 'On Hold' : 'En Attente', variant: "secondary" }
    };
    const statusInfo = statusMap[normalizedStatus] || { label: status, variant: "outline" as const };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  if (loading || !ambassador) {
    return (
      <LoadingScreen 
        size="fullscreen" 
        text={t.loading}
      />
    );
  }

  // If ambassador is suspended, show only a message and logout button
  if (ambassador.status === 'suspended') {
    return (
      <div className="pt-20 sm:pt-24 min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {/* Header Section */}
          <div className="mb-6 sm:mb-8">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 sm:gap-0">
              <div className="text-center sm:text-left">
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-heading font-bold text-primary mb-2 sm:mb-3 uppercase">
                  {t.title}
                </h1>
                <p className="text-sm sm:text-base text-muted-foreground">
                  {t.welcome}, <span className="font-semibold text-foreground">{ambassador.full_name}</span>!
                </p>
              </div>
              <Button 
                onClick={handleLogout} 
                variant="outline"
                className="w-full sm:w-auto border-primary/30 hover:border-primary hover:bg-primary/10 transition-all duration-300 hover:shadow-lg hover:shadow-primary/20"
              >
                <LogOut className="w-4 h-4 mr-2" />
                {t.logout}
              </Button>
            </div>
          </div>

          {/* Suspended Message */}
          <Card className="border-destructive/20 shadow-lg">
            <CardContent className="pt-6">
              <div className="text-center space-y-6 py-8">
                <div className="flex justify-center">
                  <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
                    <AlertCircle className="w-10 h-10 text-destructive" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
                    {t.suspendedTitle}
                  </h2>
                  <p className="text-muted-foreground text-lg">
                    {t.suspendedMessage}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // If sales are disabled, show only a message and logout button
  if (!salesEnabled) {
    return (
      <div className="pt-20 sm:pt-24 min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {/* Header Section */}
          <div className="mb-6 sm:mb-8">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 sm:gap-0">
              <div className="text-center sm:text-left">
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-heading font-bold text-primary mb-2 sm:mb-3 uppercase">
                  {t.title}
                </h1>
                <p className="text-sm sm:text-base text-muted-foreground">
                  {t.welcome}, <span className="font-semibold text-foreground">{ambassador.full_name}</span>!
                </p>
              </div>
              <Button 
                onClick={handleLogout} 
                variant="outline"
                className="w-full sm:w-auto border-primary/30 hover:border-primary hover:bg-primary/10 transition-all duration-300 hover:shadow-lg hover:shadow-primary/20"
              >
                <LogOut className="w-4 h-4 mr-2" />
                {t.logout}
              </Button>
            </div>
          </div>

          <SalesClosedState
            language={language}
            title={t.salesDisabledTitle}
            message={t.salesDisabledMessage}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="pt-20 sm:pt-24 min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header Section - Responsive */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 sm:gap-0">
            <div className="text-center sm:text-left">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-heading font-bold text-primary mb-2 sm:mb-3">
                {t.title}
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                {t.welcome}, <span className="font-semibold text-foreground">{ambassador.full_name}</span>!
              </p>
            </div>
            <Button 
              onClick={handleLogout} 
              variant="outline"
              className="w-full sm:w-auto border-primary/30 hover:border-primary hover:bg-primary/10 transition-all duration-300 hover:shadow-lg hover:shadow-primary/20"
            >
              <LogOut className="w-4 h-4 mr-2" />
              {t.logout}
            </Button>
          </div>
        </div>

        <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <Label
            htmlFor="ambassador-event-filter"
            className="text-sm font-medium shrink-0 text-muted-foreground"
          >
            {t.filterByEvent}
          </Label>
          <div className="flex flex-col gap-1 min-w-0 w-full sm:w-auto">
            <Select
              value={selectedEventFilter || undefined}
              onValueChange={setSelectedEventFilter}
              disabled={filterableEvents.length === 0}
            >
              <SelectTrigger
                id="ambassador-event-filter"
                className="w-full sm:w-[320px] bg-card border-border"
              >
                <SelectValue placeholder={t.selectEvent} />
              </SelectTrigger>
              <SelectContent>
                {filterableEvents.map((event) => (
                  <SelectItem key={event.id} value={event.id}>
                    {event.name}
                    {event.is_test ? " (test)" : ""} —{" "}
                    {formatDateDMY(event.date, language)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filterableEvents.length === 0 && (
              <p className="text-xs text-muted-foreground max-w-md">
                {t.noUpcomingEvents}
              </p>
            )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <AmbassadorTabLayoutGroup>
            <TabsList className="relative grid h-10 w-full grid-cols-4 gap-0.5 rounded-lg border border-border/30 bg-muted/50 p-1 text-muted-foreground">
              <TabsTrigger
                id="tab-new-orders"
                value="new-orders"
                className="relative z-10 min-w-0 border border-transparent bg-transparent px-1.5 py-1.5 text-xs font-medium shadow-none transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none sm:px-4 sm:text-sm"
              >
                <AmbassadorTabIndicator active={activeTab === "new-orders"} />
                <span className="relative z-10 truncate sm:hidden">
                  {language === "en" ? "Orders" : "Nouveau"}
                </span>
                <span className="relative z-10 hidden truncate sm:inline">
                  {language === "en" ? "New Orders" : "Nouvelles Commandes"}
                </span>
              </TabsTrigger>
              <TabsTrigger
                id="tab-history"
                value="history"
                className="relative z-10 min-w-0 border border-transparent bg-transparent px-1.5 py-1.5 text-xs font-medium shadow-none transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none sm:px-4 sm:text-sm"
              >
                <AmbassadorTabIndicator active={activeTab === "history"} />
                <span className="relative z-10 truncate sm:hidden">
                  {language === "en" ? "History" : "Hist."}
                </span>
                <span className="relative z-10 hidden truncate sm:inline">
                  {language === "en" ? "History" : "Historique"}
                </span>
              </TabsTrigger>
              <TabsTrigger
                id="tab-performance"
                value="performance"
                className="relative z-10 min-w-0 border border-transparent bg-transparent px-1.5 py-1.5 text-xs font-medium shadow-none transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none sm:px-4 sm:text-sm"
              >
                <AmbassadorTabIndicator active={activeTab === "performance"} />
                <span className="relative z-10 truncate sm:hidden">
                  {language === "en" ? "Stats" : "Perf."}
                </span>
                <span className="relative z-10 hidden truncate sm:inline">{t.performance}</span>
              </TabsTrigger>
              <TabsTrigger
                id="tab-profile"
                value="profile"
                className="relative z-10 min-w-0 border border-transparent bg-transparent px-1.5 py-1.5 text-xs font-medium shadow-none transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none sm:px-4 sm:text-sm"
              >
                <AmbassadorTabIndicator active={activeTab === "profile"} />
                <span className="relative z-10 truncate">{t.profile}</span>
              </TabsTrigger>
            </TabsList>
          </AmbassadorTabLayoutGroup>

          <AmbassadorTabPanel activeTab={activeTab}>
            <div
              role="tabpanel"
              id={`panel-${activeTab}`}
              aria-labelledby={`tab-${activeTab}`}
            >
              {activeTab === "new-orders" && (
                <NewOrdersTab
                  language={language}
                  t={t}
                  newOrders={newOrders}
                  getOrderPasses={getOrderPasses}
                  getStatusBadge={getStatusBadge}
                  onConfirmCash={(order) => {
                    setSelectedOrder(order);
                    setIsConfirmDialogOpen(true);
                  }}
                  onCancelOrder={(order) => {
                    setSelectedOrder(order);
                    setIsCancelDialogOpen(true);
                  }}
                />
              )}
              {activeTab === "history" && (
                <HistoryTab
                  language={language}
                  t={t}
                  historyOrders={historyOrders}
                  getOrderPasses={getOrderPasses}
                  getStatusBadge={getStatusBadge}
                />
              )}
              {activeTab === "performance" && (
                <PerformanceTab language={language} t={t} performance={performance} />
              )}
              {activeTab === "profile" && ambassador && (
                <ProfileTab
                  t={t}
                  ambassador={ambassador}
                  onOpenEditDialog={() => setIsProfileDialogOpen(true)}
                />
              )}
            </div>
          </AmbassadorTabPanel>
        </Tabs>

        <OrderCancelledSuccess
          open={cancelSuccessOpen}
          onOpenChange={(open) => {
            setCancelSuccessOpen(open);
            if (!open) setCancelSuccessSummary(null);
          }}
          language={language}
          customerName={cancelSuccessSummary?.customerName}
          amount={cancelSuccessSummary?.amount}
        />

        <PaymentConfirmedSuccess
          open={paymentSuccessOpen}
          onOpenChange={(open) => {
            setPaymentSuccessOpen(open);
            if (!open) setPaymentSuccessSummary(null);
          }}
          language={language}
          customerName={paymentSuccessSummary?.customerName}
          amount={paymentSuccessSummary?.amount}
        />

        <ConfirmOrderDialog
          open={isConfirmDialogOpen}
          onOpenChange={(open) => {
            setIsConfirmDialogOpen(open);
            if (!open) setSelectedOrder(null);
          }}
          order={selectedOrder}
          onConfirm={handleConfirmCash}
          language={language}
          title={t.confirmOrder}
          confirmLabel={t.confirmPayment}
          backLabel={t.goBack}
        />

        <CancelOrderDialog
          open={isCancelDialogOpen}
          onOpenChange={(open) => {
            setIsCancelDialogOpen(open);
            if (!open) setCancellationReason("");
          }}
          order={selectedOrder}
          reason={cancellationReason}
          onReasonChange={setCancellationReason}
          onConfirm={handleCancelOrder}
          language={language}
          title={t.cancelOrder}
          reasonLabel={t.cancelReason}
          confirmLabel={t.confirmCancel}
          keepOrderLabel={t.keepOrder}
        />

        <EditProfileDialog
          open={isProfileDialogOpen}
          onOpenChange={(open) => {
            setIsProfileDialogOpen(open);
            if (!open) {
              setProfileForm({ password: "", confirmPassword: "" });
              setShowPassword(false);
            }
          }}
          language={language}
          phone={ambassador?.phone ?? ""}
          password={profileForm.password}
          confirmPassword={profileForm.confirmPassword}
          showPassword={showPassword}
          onPasswordChange={(value) => setProfileForm({ ...profileForm, password: value })}
          onConfirmPasswordChange={(value) =>
            setProfileForm({ ...profileForm, confirmPassword: value })
          }
          onToggleShowPassword={() => setShowPassword(!showPassword)}
          onSave={handleUpdateProfile}
          onCancel={() => {
            setIsProfileDialogOpen(false);
            setProfileForm({ password: "", confirmPassword: "" });
          }}
          title={t.editProfile}
          currentPhoneLabel={t.currentPhone}
          newPasswordLabel={t.newPassword}
          confirmPasswordLabel={t.confirmPassword}
          cancelLabel={t.cancel}
          saveLabel={t.save}
        />
      </div>
    </div>
  );
};

export default AmbassadorDashboard; 
