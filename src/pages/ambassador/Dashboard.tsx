import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { LogOut, User, Eye, EyeOff, Save, AlertCircle } from "lucide-react";
import LoadingScreen from "@/components/ui/LoadingScreen";
import { fetchSalesSettings, subscribeToSalesSettings } from "@/lib/salesSettings";
import { API_ROUTES, buildFullApiUrl, getApiBaseUrl } from "@/lib/api-routes";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";
import type { AmbassadorDashboardProps, Order, Ambassador } from "./types";
import { NewOrdersTab } from "./components/NewOrdersTab";
import { HistoryTab } from "./components/HistoryTab";
import { PerformanceTab } from "./components/PerformanceTab";
import { ProfileTab } from "./components/ProfileTab";

const AmbassadorDashboard = ({ language }: AmbassadorDashboardProps) => {
  const [ambassador, setAmbassador] = useState<Ambassador | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('new-orders');
  const [newOrders, setNewOrders] = useState<Order[]>([]); // PENDING_CASH orders
  const [historyOrders, setHistoryOrders] = useState<Order[]>([]); // PAID, COMPLETED orders
  const [performance, setPerformance] = useState<any>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');

  const [profileForm, setProfileForm] = useState({
    password: '',
    confirmPassword: ''
  });

  const [salesEnabled, setSalesEnabled] = useState(true);

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
    noAssignedOrders: "No assigned orders",
    noCompletedOrders: "No completed orders yet",
    event: "Event",
    selectEvent: "Select event",
    save: "Save",
    cancelOrder: "Cancel Order",
    cancelReason: "Cancellation Reason",
    confirmCancel: "Confirm Cancel",
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
    salesDisabledMessage: "Sales are not open yet. Please check back later.",
    salesDisabledTitle: "Sales Temporarily Unavailable",
    suspended: "Account Paused",
    suspendedMessage: "Your ambassador account has been temporarily paused. Please contact support for more information.",
    suspendedTitle: "Account Temporarily Paused"
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
    noAssignedOrders: "Aucune commande assignée",
    noCompletedOrders: "Aucune commande terminée",
    event: "Événement",
    selectEvent: "Sélectionner un événement",
    noUpcomingEvents: "Aucun événement à venir",
    save: "Enregistrer",
    cancelOrder: "Annuler la Commande",
    cancelReason: "Raison d'Annulation",
    confirmCancel: "Confirmer l'Annulation",
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
    salesDisabledMessage: "Les ventes ne sont pas encore ouvertes. Veuillez réessayer plus tard.",
    salesDisabledTitle: "Ventes Temporairement Indisponibles",
    suspended: "Compte en Pause",
    suspendedMessage: "Votre compte d'ambassadeur a été temporairement mis en pause. Veuillez contacter le support pour plus d'informations.",
    suspendedTitle: "Compte Temporairement en Pause"
  };

  useEffect(() => {
    const session = localStorage.getItem('ambassadorSession');
    if (!session) {
      navigate('/ambassador/auth');
      return;
    }
    const { user } = JSON.parse(session);
    
    // Fetch latest ambassador status from database to check if they were paused
    const loadAmbassadorData = async () => {
      try {
        const { data: latestAmbassador, error } = await supabase
          .from('ambassadors')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (!error && latestAmbassador) {
          // Update ambassador state with latest data (including status)
          setAmbassador(latestAmbassador);
          
          // Only fetch data if not suspended
          if (latestAmbassador.status !== 'suspended') {
            fetchData(user.id);
          } else {
            setLoading(false);
          }
        } else {
          // If fetch fails, use cached user data
          setAmbassador(user);
          fetchData(user.id);
        }
      } catch (error) {
        console.error('Error fetching latest ambassador status:', error);
        // If fetch fails, use cached user data
        setAmbassador(user);
        fetchData(user.id);
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
            pass_type: p.passName || p.pass_type || order.pass_type || 'standard',
            quantity: p.quantity || 0,
            price: p.price || 0
          }));
        }
      } catch (e) {
        console.error('Error parsing order notes:', e);
      }
    }
    
    // Fallback: use order.pass_type and order.quantity (very old system)
    if (order.pass_type && order.quantity) {
      const pricePerPass = order.total_price / order.quantity;
      return [{
        pass_type: order.pass_type,
        quantity: order.quantity,
        price: pricePerPass
      }];
    }
    
    return [];
  };

  const fetchData = async (ambassadorId: string) => {
    setLoading(true);
    try {
      const apiBase = getApiBaseUrl();

      // Fetch new orders (PENDING_CASH) via API endpoint
      const newOrdersUrl = buildFullApiUrl(API_ROUTES.AMBASSADOR_ORDERS, apiBase) + `?ambassadorId=${ambassadorId}&status=PENDING_CASH`;
      const newOrdersResponse = await fetch(newOrdersUrl, {
        credentials: 'include'
      });

      if (!newOrdersResponse.ok) {
        throw new Error('Failed to fetch new orders');
      }

      const newOrdersResult = await newOrdersResponse.json();
      setNewOrders(newOrdersResult.data || []);

      // Fetch history orders (all except PENDING_CASH) via API endpoint
      // We'll fetch all orders and filter out PENDING_CASH on the frontend for display
      // (API already excludes REMOVED_BY_ADMIN)
      const historyUrl = buildFullApiUrl(API_ROUTES.AMBASSADOR_ORDERS, apiBase) + `?ambassadorId=${ambassadorId}&limit=100`;
      const historyResponse = await fetch(historyUrl, {
        credentials: 'include'
      });

      if (!historyResponse.ok) {
        throw new Error('Failed to fetch history orders');
      }

      const historyResult = await historyResponse.json();
      // Filter out PENDING_CASH orders (those are in New Orders tab)
      const filteredHistory = (historyResult.data || []).filter((order: Order) => order.status !== 'PENDING_CASH');
      setHistoryOrders(filteredHistory);

      // Fetch performance data via API endpoint
      await fetchPerformance(ambassadorId);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: t.error,
        description: "Failed to fetch data.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchPerformance = async (ambassadorId: string) => {
    try {
      // Fetch performance data via API endpoint (excludes REMOVED_BY_ADMIN automatically)
      const apiBase = getApiBaseUrl();
      const performanceUrl = buildFullApiUrl(API_ROUTES.AMBASSADOR_PERFORMANCE, apiBase) + `?ambassadorId=${ambassadorId}`;
      const performanceResponse = await fetch(performanceUrl, {
        credentials: 'include'
      });

      if (!performanceResponse.ok) {
        throw new Error('Failed to fetch performance data');
      }

      const performanceResult = await performanceResponse.json();
      
      if (!performanceResult.success) {
        throw new Error(performanceResult.error || 'Failed to fetch performance data');
      }

      // Use data from API (already filtered and calculated)
      const performanceData = performanceResult.data;
      
      const total = performanceData.total || 0;
      const paid = performanceData.paid || 0;
      const cancelled = performanceData.cancelled || 0;
      const rejected = performanceData.rejected || 0;
      const ignored = performanceData.ignored || 0;
      const totalPassesSold = performanceData.totalPassesSold || 0;
      const totalRevenue = performanceData.totalRevenue || 0;
      const avgResponseTime = performanceData.averageResponseTime || 0;

      // Commission Calculation Rules (calculated in frontend):
      // - No payment for passes 1-7 (0 DT)
      // - From pass 8 onwards: 3 DT per pass
      // - Bonuses: 15 passes = +15 DT, 25 passes = +20 DT, 35 passes = +20 DT (cumulative)
      
      // Calculate base commission (only for passes 8+)
      let baseCommission = 0;
      if (totalPassesSold > 7) {
        const paidPasses = totalPassesSold - 7; // Passes 8 onwards
        baseCommission = paidPasses * 3; // 3 DT per pass
      }
      
      // Calculate cumulative bonuses
      let totalBonuses = 0;
      if (totalPassesSold >= 15) {
        totalBonuses += 15; // 15 DT bonus at 15 passes
      }
      if (totalPassesSold >= 25) {
        totalBonuses += 20; // 20 DT bonus at 25 passes
      }
      if (totalPassesSold >= 35) {
        totalBonuses += 20; // 20 DT bonus at 35 passes
      }

      const totalCommission = baseCommission + totalBonuses;
      
      setPerformance({
        total,
        paid,
        completed: 0, // No longer using completed status
        cancelled,
        rejected,
        ignored,
        totalPassesSold,
        baseCommission,
        totalBonuses,
        commission: totalCommission, // Total commission = base + bonuses
        completionRate: total > 0 ? ((paid / total) * 100).toFixed(1) : '0',
        cancellationRate: total > 0 ? ((cancelled / total) * 100).toFixed(1) : '0',
        rejectionRate: total > 0 ? ((rejected / total) * 100).toFixed(1) : '0',
        ignoreRate: total > 0 ? ((ignored / total) * 100).toFixed(1) : '0',
        totalRevenue,
        averageResponseTime: Math.round(avgResponseTime * 10) / 10
      });
    } catch (error) {
      console.error('Error fetching performance:', error);
    }
  };

  const handleConfirmCash = async (orderId: string) => {
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
      const { error } = await supabase
        .from('orders')
        .update({
          status: 'PENDING_ADMIN_APPROVAL',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;

      // Log the action
      await supabase.from('order_logs').insert({
        order_id: orderId,
        action: 'status_changed',
        performed_by: ambassador?.id,
        performed_by_type: 'ambassador',
        details: { from_status: 'PENDING_CASH', to_status: 'PENDING_ADMIN_APPROVAL' }
      });

      toast({
        title: language === 'en' ? 'Cash Confirmed' : 'Paiement Confirmé',
        description: language === 'en' 
          ? 'Cash payment confirmed. Waiting for admin approval before tickets are sent.'
          : 'Paiement en espèces confirmé. En attente de l\'approbation de l\'administrateur avant l\'envoi des billets.',
        variant: "default"
      });

      // Refresh orders data
      fetchData(ambassador?.id || '');
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
      // Cancel order without reassignment
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          status: 'CANCELLED',
          cancelled_by: 'ambassador',
          cancellation_reason: cancellationReason.trim(),
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedOrder.id);

      if (updateError) {
        throw new Error(updateError.message || 'Failed to update order status');
      }

      // Log the action (don't fail if logging fails)
      const { error: logError } = await supabase.from('order_logs').insert({
        order_id: selectedOrder.id,
        action: 'cancelled',
        performed_by: ambassador?.id,
        performed_by_type: 'ambassador',
        details: { reason: cancellationReason.trim() }
      });

      if (logError) {
        console.warn('Failed to log cancellation:', logError);
        // Don't throw - order is cancelled, logging is secondary
      }

      toast({
        title: t.orderCancelled,
        variant: "default"
      });

      setIsCancelDialogOpen(false);
      setSelectedOrder(null);
      setCancellationReason('');
      fetchData(ambassador?.id || '');
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
          body: JSON.stringify({
            ambassadorId: ambassador?.id,
            newPassword: profileForm.password
          })
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to update password');
        }

        toast({
          title: t.profileUpdated,
          variant: "default"
        });

        setIsProfileDialogOpen(false);
        // Reset password fields
        setProfileForm({ password: '', confirmPassword: '' });
        
        // No need to refresh ambassador data since only password changed
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

  const handleLogout = () => {
    // Log ambassador logout
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
    
    localStorage.removeItem('ambassadorSession');
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
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-heading font-bold text-gradient-neon mb-2 sm:mb-3 uppercase">
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
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-heading font-bold text-gradient-neon mb-2 sm:mb-3 uppercase">
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

          {/* Sales Disabled Message */}
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
                    {t.salesDisabledTitle}
                  </h2>
                  <p className="text-muted-foreground text-lg">
                    {t.salesDisabledMessage}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
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
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-heading font-bold text-gradient-neon mb-2 sm:mb-3">
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

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Scrollable Tabs on Mobile */}
          <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
            <TabsList className="inline-flex h-10 items-center justify-start sm:justify-center rounded-lg bg-muted/50 p-1 text-muted-foreground w-full sm:w-auto min-w-full sm:min-w-0 sm:grid sm:grid-cols-4 gap-1 border border-border/30">
              <TabsTrigger 
                value="new-orders"
                className="whitespace-nowrap px-3 sm:px-4 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/20 data-[state=active]:to-secondary/20 data-[state=active]:text-foreground data-[state=active]:shadow-lg data-[state=active]:shadow-primary/30 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-md"
              >
                {language === 'en' ? 'New Orders' : 'Nouvelles Commandes'}
              </TabsTrigger>
              <TabsTrigger 
                value="history"
                className="whitespace-nowrap px-3 sm:px-4 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/20 data-[state=active]:to-secondary/20 data-[state=active]:text-foreground data-[state=active]:shadow-lg data-[state=active]:shadow-primary/30 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-md"
              >
                {language === 'en' ? 'History' : 'Historique'}
              </TabsTrigger>
              <TabsTrigger 
                value="performance"
                className="whitespace-nowrap px-3 sm:px-4 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/20 data-[state=active]:to-secondary/20 data-[state=active]:text-foreground data-[state=active]:shadow-lg data-[state=active]:shadow-primary/30 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-md"
              >
                {t.performance}
              </TabsTrigger>
              <TabsTrigger 
                value="profile"
                className="whitespace-nowrap px-3 sm:px-4 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/20 data-[state=active]:to-secondary/20 data-[state=active]:text-foreground data-[state=active]:shadow-lg data-[state=active]:shadow-primary/30 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-md"
              >
                {t.profile}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* New Orders Tab (shows PENDING_CASH orders waiting for cash confirmation) */}
          <TabsContent value="new-orders" className="mt-6">
            <NewOrdersTab
              language={language}
              t={t}
              newOrders={newOrders}
              getOrderPasses={getOrderPasses}
              getStatusBadge={getStatusBadge}
              onConfirmCash={handleConfirmCash}
              onCancelOrder={(order) => { setSelectedOrder(order); setIsCancelDialogOpen(true); }}
            />
          </TabsContent>

          {/* History Tab (shows PAID, COMPLETED, CANCELLED orders) */}
          <TabsContent value="history" className="mt-6">
            <HistoryTab
              language={language}
              t={t}
              historyOrders={historyOrders}
              getOrderPasses={getOrderPasses}
              getStatusBadge={getStatusBadge}
            />
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="mt-6">
            <PerformanceTab language={language} t={t} performance={performance} />
          </TabsContent>

          {/* Profile Tab */}
          <TabsContent value="profile" className="mt-6">
            <ProfileTab t={t} ambassador={ambassador} onOpenEditDialog={() => setIsProfileDialogOpen(true)} />
          </TabsContent>
        </Tabs>

        {/* Cancel Order Dialog */}
        <Dialog open={isCancelDialogOpen} onOpenChange={(open) => {
          setIsCancelDialogOpen(open);
          if (!open) {
            setCancellationReason('');
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t.cancelOrder}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>{t.cancelReason} *</Label>
                <Textarea
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  placeholder="Enter cancellation reason..."
                />
              </div>
              <div className="flex justify-end">
                <Button variant="destructive" onClick={handleCancelOrder}>
                  {t.confirmCancel}
                </Button>
              </div>
      </div>
          </DialogContent>
        </Dialog>

        {/* Edit Profile Dialog */}
        <Dialog open={isProfileDialogOpen} onOpenChange={setIsProfileDialogOpen}>
        <DialogContent>
          <DialogHeader>
              <DialogTitle>{t.editProfile}</DialogTitle>
          </DialogHeader>
            <div className="space-y-4">
              <div className="p-3 bg-muted/30 rounded-md border border-border/50">
                <Label className="text-xs text-muted-foreground mb-1 block">{t.currentPhone}</Label>
                <p className="text-sm font-medium">{ambassador?.phone}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {language === 'en' 
                    ? "Phone number cannot be changed" 
                    : "Le numéro de téléphone ne peut pas être modifié"}
                </p>
              </div>
              <div>
                <Label>{t.newPassword}</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={profileForm.password}
                    onChange={(e) => setProfileForm({ ...profileForm, password: e.target.value })}
                    placeholder={language === 'en' ? "Enter new password" : "Entrez le nouveau mot de passe"}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div>
                <Label>{t.confirmPassword}</Label>
                <Input
                  type="password"
                  value={profileForm.confirmPassword}
                  onChange={(e) => setProfileForm({ ...profileForm, confirmPassword: e.target.value })}
                  placeholder={language === 'en' ? "Confirm new password" : "Confirmez le nouveau mot de passe"}
                />
          </div>
          <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => {
                  setIsProfileDialogOpen(false);
                  setProfileForm({ password: '', confirmPassword: '' });
                }}>
                  {t.cancel}
                </Button>
                <Button onClick={handleUpdateProfile}>
                  <Save className="w-4 h-4 mr-2" />
                  {t.save}
                </Button>
              </div>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
};

export default AmbassadorDashboard; 
