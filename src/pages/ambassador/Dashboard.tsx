import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  LogOut, User, BarChart, Plus, CheckCircle, XCircle, Clock, 
  AlertCircle, DollarSign, Package, TrendingUp, Phone, Mail, 
  MapPin, Edit, Lock, Eye, EyeOff, Save, X
} from 'lucide-react';
import LoadingScreen from '@/components/ui/LoadingScreen';
import { CITIES, SOUSSE_VILLES, TUNIS_VILLES } from "@/lib/constants";
import { format } from "date-fns";
import { fetchSalesSettings, subscribeToSalesSettings } from "@/lib/salesSettings";
import { API_ROUTES, buildFullApiUrl, getApiBaseUrl } from "@/lib/api-routes";
import { logger } from "@/lib/logger";

interface AmbassadorDashboardProps {
  language: 'en' | 'fr';
}

interface Order {
  id: string;
  source: 'platform_cod' | 'platform_online';
  user_name: string; // Database column name
  user_phone: string; // Database column name
  user_email?: string; // Database column name
  city: string;
  ville?: string;
  ambassador_id: string;
  event_id?: string;
  pass_type: string;
  quantity: number;
  total_price: number;
  payment_method: 'cod' | 'online'; // Payment method: 'cod' or 'online'
  status: 'PENDING_ADMIN_APPROVAL' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'PENDING' | 'ACCEPTED' | 'CANCELLED_BY_AMBASSADOR' | 'CANCELLED_BY_ADMIN' | 'REFUNDED' | 'FRAUD_SUSPECT' | 'IGNORED' | 'ON_HOLD' | 'PENDING_CASH' | 'PAID';
  cancellation_reason?: string;
  rejection_reason?: string;
  notes?: string | any; // JSON string or parsed object containing pass breakdown
  order_passes?: Array<{ id: string; order_id: string; pass_type: string; quantity: number; price: number }>; // Order passes from order_passes table
  assigned_at?: string;
  accepted_at?: string;
  approved_at?: string;
  rejected_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  created_at: string;
  updated_at: string;
}

interface Ambassador {
  id: string;
  full_name: string;
  phone: string;
  email?: string;
  city: string;
  ville?: string;
  status: string;
  commission_rate: number;
}

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
      // Fetch new orders (PENDING_CASH - unpaid orders waiting for cash confirmation)
      const { data: newOrdersData, error: newOrdersError } = await supabase
        .from('orders')
        .select(`
          *,
          order_passes (*)
        `)
        .eq('ambassador_id', ambassadorId)
        .eq('status', 'PENDING_CASH')
        .order('created_at', { ascending: false });

      if (newOrdersError) throw newOrdersError;
      setNewOrders(newOrdersData || []);

      // Fetch history orders (all orders except PENDING_CASH which are in New Orders tab)
      // Include: PAID, PENDING_ADMIN_APPROVAL, COMPLETED, CANCELLED, and all other final statuses
      const { data: historyData, error: historyError } = await supabase
        .from('orders')
        .select(`
          *,
          order_passes (*)
        `)
        .eq('ambassador_id', ambassadorId)
        .not('status', 'eq', 'PENDING_CASH') // Exclude PENDING_CASH (those are in New Orders tab)
        .order('updated_at', { ascending: false })
        .limit(100);

      if (historyError) throw historyError;
      setHistoryOrders(historyData || []);

      // Fetch performance data
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
      // Fetch orders with order_passes relation to calculate accurate revenue and pass counts
      const { data: allOrders, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_passes (*)
        `)
        .eq('ambassador_id', ambassadorId);

      if (error) throw error;

      const total = allOrders?.length || 0;
      
      // Use uppercase status values (database uses uppercase)
      // Count PAID orders
      const paid = allOrders?.filter((o: any) => o.status === 'PAID').length || 0;
      // Count cancelled orders (new unified system uses 'CANCELLED' status with cancelled_by field)
      const cancelled = allOrders?.filter((o: any) => 
        o.status === 'CANCELLED' || 
        o.status === 'CANCELLED_BY_AMBASSADOR' || 
        o.status === 'CANCELLED_BY_ADMIN' // Backward compatibility with old statuses
      ).length || 0;
      
      // Count rejected orders (admin rejected PENDING_ADMIN_APPROVAL orders)
      const rejected = allOrders?.filter((o: any) => o.status === 'REJECTED').length || 0;
      
      // Ignored orders: PENDING that haven't been accepted for more than 15 minutes
      const ignored = allOrders?.filter((o: any) => 
        (o.status === 'PENDING') && 
        o.assigned_at &&
        new Date(o.assigned_at).getTime() < Date.now() - 15 * 60 * 1000 && // 15 minutes
        !o.accepted_at // Not yet accepted
      ).length || 0;
      
      // Total revenue: Count only PAID orders
      // Calculate from order_passes for accuracy (recalculate instead of using stored total_price)
      const revenueOrders = allOrders?.filter((o: any) => o.status === 'PAID') || [];
      
      // Calculate revenue and passes from order_passes table (accurate calculation)
      let totalRevenue = 0;
      let totalPassesSold = 0;
      
      revenueOrders.forEach((order: any) => {
        if (order.order_passes && order.order_passes.length > 0) {
          // New system: use order_passes (accurate calculation)
          order.order_passes.forEach((pass: any) => {
            const passRevenue = (pass.price || 0) * (pass.quantity || 0);
            totalRevenue += passRevenue;
            totalPassesSold += pass.quantity || 0;
          });
        } else {
          // Fallback: try to parse from notes field (legacy orders)
          let calculatedFromNotes = false;
          if (order.notes) {
            try {
              const notesData = typeof order.notes === 'string' ? JSON.parse(order.notes) : order.notes;
              if (notesData?.all_passes && Array.isArray(notesData.all_passes)) {
                notesData.all_passes.forEach((pass: any) => {
                  const passPrice = pass.price || 0;
                  const passQuantity = pass.quantity || 0;
                  const passRevenue = passPrice * passQuantity;
                  totalRevenue += passRevenue;
                  totalPassesSold += passQuantity;
                });
                calculatedFromNotes = true;
              }
            } catch (e) {
              console.error('Error parsing order notes:', e);
            }
          }
          
          // Final fallback: calculate from quantity and price per pass
          // If we have quantity and can calculate price per pass, use that
          if (!calculatedFromNotes && order.quantity && order.quantity > 0) {
            // Calculate price per pass from total_price / quantity
            const pricePerPass = (order.total_price || 0) / order.quantity;
            // But this still uses the wrong total_price, so we need another approach
            // For now, let's use the stored values but log a warning
            console.warn(`Order ${order.id} has no order_passes or notes. Using stored total_price: ${order.total_price}, quantity: ${order.quantity}`);
            totalRevenue += order.total_price || 0;
            totalPassesSold += order.quantity || 0;
          } else if (!calculatedFromNotes) {
            totalRevenue += order.total_price || 0;
            totalPassesSold += order.quantity || 0;
          }
        }
      });
      
      // New Commission Calculation Rules:
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
      
      // Total commission = base + bonuses
      const commission = baseCommission + totalBonuses;

      // Calculate average response time (time from assigned to accepted)
      const acceptedOrders = allOrders?.filter((o: any) => o.accepted_at && o.assigned_at) || [];
      const avgResponseTime = acceptedOrders.length > 0
        ? acceptedOrders.reduce((sum: number, o: any) => {
            const assigned = new Date(o.assigned_at).getTime();
            const accepted = new Date(o.accepted_at).getTime();
            return sum + (accepted - assigned);
          }, 0) / acceptedOrders.length / 1000 / 60 // Convert to minutes
        : 0;

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
        completionRate: total > 0 ? ((paid / total) * 100).toFixed(1) : '0',
        cancellationRate: total > 0 ? ((cancelled / total) * 100).toFixed(1) : '0',
        rejectionRate: total > 0 ? ((rejected / total) * 100).toFixed(1) : '0',
        ignoreRate: total > 0 ? ((ignored / total) * 100).toFixed(1) : '0',
        avgResponseTime: avgResponseTime.toFixed(1),
        totalRevenue: totalRevenue.toFixed(2),
        commission: commission.toFixed(2)
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
        variant="default" 
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
            <Card className="border-border/50 shadow-lg shadow-primary/5 bg-gradient-to-br from-background to-background/95">
              <CardHeader className="bg-gradient-to-r from-yellow-500/10 via-orange-500/5 to-yellow-500/10 border-b border-border/50 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-yellow-500/20 to-orange-500/20">
                    <Package className="w-5 h-5 text-yellow-400" />
                  </div>
                  <div>
                    <CardTitle className="text-xl sm:text-2xl font-heading bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                      {language === 'en' ? 'New Orders' : 'Nouvelles Commandes'}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {language === 'en' 
                        ? 'Contact the client, collect cash payment, then confirm the order'
                        : 'Contactez le client, collectez le paiement en espèces, puis confirmez la commande'}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                {newOrders.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="inline-flex p-4 rounded-full bg-muted/50 mb-4">
                      <Package className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground text-lg font-medium">
                      {language === 'en' ? 'No new orders' : 'Aucune nouvelle commande'}
                    </p>
                    <p className="text-sm text-muted-foreground/80 mt-2">
                      {language === 'en' ? 'New orders will appear here' : 'Les nouvelles commandes apparaîtront ici'}
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto rounded-lg border border-border/30">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gradient-to-r from-muted/50 to-muted/30 border-b-2 border-border/50">
                            <TableHead className="font-semibold text-foreground/90">{t.customerName}</TableHead>
                            <TableHead className="font-semibold text-foreground/90">{t.phone}</TableHead>
                            <TableHead className="font-semibold text-foreground/90">{t.city}</TableHead>
                            <TableHead className="font-semibold text-foreground/90">{t.passType}</TableHead>
                            <TableHead className="font-semibold text-foreground/90">{t.quantity}</TableHead>
                            <TableHead className="font-semibold text-foreground/90">{t.totalPrice}</TableHead>
                            <TableHead className="font-semibold text-foreground/90">{t.status}</TableHead>
                            <TableHead className="font-semibold text-foreground/90">{t.actions}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {newOrders.map((order, index) => (
                            <TableRow 
                              key={order.id} 
                              className={`border-border/30 transition-all duration-200 ${
                                index % 2 === 0 
                                  ? 'bg-card/30 hover:bg-card/50' 
                                  : 'bg-card/20 hover:bg-card/40'
                              }`}
                            >
                              <TableCell className="font-medium text-foreground">{order.user_name}</TableCell>
                              <TableCell className="text-foreground/90 flex items-center gap-2">
                                <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                                {order.user_phone}
                              </TableCell>
                              <TableCell className="text-foreground/90 flex items-center gap-2">
                                <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                                {order.city}{order.ville ? ` – ${order.ville}` : ''}
                              </TableCell>
                              <TableCell>
                                {(() => {
                                  const passes = getOrderPasses(order);
                                  if (passes.length === 0) {
                                    return <span className="text-muted-foreground text-sm">-</span>;
                                  }
                                  
                                  if (passes.length === 1) {
                                    const pass = passes[0];
                                    const isVip = pass.pass_type?.toLowerCase() === 'vip';
                                    const passName = isVip ? t.vip : (pass.pass_type || t.standard);
                                    return (
                                      <Badge 
                                        variant={isVip ? "default" : "secondary"}
                                        className={isVip 
                                          ? "bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 text-yellow-300 border-yellow-500/30" 
                                          : "bg-muted/50 text-foreground/80"
                                        }
                                      >
                                        {passName}
                                      </Badge>
                                    );
                                  }
                                  
                                  // Multiple passes - show breakdown
                                  const passBreakdown = passes
                                    .map((p: any) => {
                                      const passName = p.pass_type?.toLowerCase() === 'vip' ? t.vip : 
                                                      p.pass_type?.toLowerCase() === 'zone 1' ? 'Zone 1' :
                                                      p.pass_type?.toLowerCase() === 'standard' ? t.standard : 
                                                      p.pass_type || t.standard;
                                      return `${p.quantity}× ${passName}`;
                                    })
                                    .join(' + ');
                                  return (
                                    <div className="space-y-1">
                                      <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary text-xs">MIXED</Badge>
                                      <p className="text-xs text-muted-foreground mt-1">{passBreakdown}</p>
                                    </div>
                                  );
                                })()}
                              </TableCell>
                              <TableCell className="text-center">
                                {(() => {
                                  const passes = getOrderPasses(order);
                                  const totalQuantity = passes.reduce((sum, p) => sum + (p.quantity || 0), 0) || order.quantity || 0;
                                  return (
                                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold">
                                      {totalQuantity}
                                    </span>
                                  );
                                })()}
                              </TableCell>
                              <TableCell className="font-semibold">
                                <span className="text-green-400 font-bold">{order.total_price.toFixed(2)} TND</span>
                              </TableCell>
                              <TableCell>{getStatusBadge(order.status)}</TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  {order.status === 'PENDING_CASH' && (
                                    <Button
                                      size="sm"
                                      onClick={() => handleConfirmCash(order.id)}
                                      className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white border-0 shadow-lg shadow-green-500/30 hover:shadow-green-500/50 transition-all duration-300"
                                    >
                                      <CheckCircle className="w-4 h-4 mr-1" />
                                      {language === 'en' ? 'Confirm' : 'Confirmer'}
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => {
                                      setSelectedOrder(order);
                                      setIsCancelDialogOpen(true);
                                    }}
                                    className="bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 shadow-lg shadow-red-500/20 hover:shadow-red-500/30 transition-all duration-300"
                                  >
                                    <XCircle className="w-4 h-4 mr-1" />
                                    {t.cancel}
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-4">
                      {newOrders.map((order) => (
                        <Card 
                          key={order.id} 
                          className="border-2 border-yellow-500/30 bg-gradient-to-br from-yellow-500/10 via-yellow-500/5 to-background shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-[1.02]"
                        >
                          <CardContent className="p-4 sm:p-6 space-y-4">
                            <div className="space-y-3">
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">{t.customerName}</p>
                                <p className="font-semibold text-base">{order.user_name}</p>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1">{t.phone}</p>
                                  <p className="text-sm">{order.user_phone}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1">{t.city}</p>
                                  <p className="text-sm">{order.city}{order.ville ? ` – ${order.ville}` : ''}</p>
                                </div>
                              </div>
                            </div>

                            {/* Pass Details */}
                            <div className="p-3 rounded-lg bg-muted/20 border border-border/30">
                              <p className="text-xs text-muted-foreground mb-2">{t.passType}</p>
                              {(() => {
                                const passes = getOrderPasses(order);
                                if (passes.length === 0) {
                                  return <span className="text-muted-foreground text-sm">-</span>;
                                }
                                
                                if (passes.length === 1) {
                                  const pass = passes[0];
                                  const isVip = pass.pass_type?.toLowerCase() === 'vip';
                                  const passName = isVip ? t.vip : (pass.pass_type || t.standard);
                                  return (
                                    <div className="space-y-2">
                                      <Badge 
                                        variant={isVip ? "default" : "secondary"}
                                        className={isVip 
                                          ? "bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 text-yellow-300 border-yellow-500/30" 
                                          : "bg-muted/50 text-foreground/80"
                                        }
                                      >
                                        {passName}
                                      </Badge>
                                      <div className="flex items-center gap-2">
                                        <p className="text-xs text-muted-foreground">{t.quantity}:</p>
                                        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/20 text-primary font-bold">
                                          {pass.quantity}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                }
                                
                                // Multiple passes - show all passes clearly
                                return (
                                  <div className="space-y-2">
                                    <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary text-xs">MIXED</Badge>
                                    <div className="space-y-1.5 mt-2">
                                      {passes.map((p: any, idx: number) => {
                                        const passName = p.pass_type?.toLowerCase() === 'vip' ? t.vip : 
                                                        p.pass_type?.toLowerCase() === 'zone 1' ? 'Zone 1' :
                                                        p.pass_type?.toLowerCase() === 'standard' ? t.standard : 
                                                        p.pass_type || t.standard;
                                        return (
                                          <div key={idx} className="flex items-center justify-between text-sm bg-background/50 p-2 rounded">
                                            <span className="font-medium">{passName}</span>
                                            <span className="text-muted-foreground">× {p.quantity}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                    <div className="flex items-center gap-2 pt-1 border-t border-border/30">
                                      <p className="text-xs text-muted-foreground">{t.quantity}:</p>
                                      <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/20 text-primary font-bold">
                                        {passes.reduce((sum, p) => sum + (p.quantity || 0), 0)}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>

                            {/* Total Price - Highlighted */}
                            <div className="p-4 rounded-lg bg-gradient-to-r from-green-500/20 via-green-500/10 to-green-500/20 border border-green-500/30">
                              <p className="text-xs text-green-300/80 mb-1">{t.totalPrice}</p>
                              <p className="text-2xl font-bold text-green-400">{order.total_price.toFixed(2)} TND</p>
                            </div>

                            {/* Action Buttons */}
                            <div className="pt-2 border-t border-border/30">
                              <div className="flex flex-wrap gap-2">
                                {order.status === 'PENDING_CASH' && (
                                  <Button
                                    size="sm"
                                    onClick={() => handleConfirmCash(order.id)}
                                    className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white border-0 shadow-lg shadow-green-500/30 hover:shadow-green-500/50 transition-all duration-300"
                                  >
                                    <CheckCircle className="w-4 h-4 mr-1" />
                                    {language === 'en' ? 'Confirm' : 'Confirmer'}
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => {
                                    setSelectedOrder(order);
                                    setIsCancelDialogOpen(true);
                                  }}
                                  className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 shadow-lg shadow-red-500/20 hover:shadow-red-500/30 transition-all duration-300"
                                >
                                  <XCircle className="w-4 h-4 mr-1" />
                                  {t.cancel}
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* History Tab (shows PAID, COMPLETED, CANCELLED orders) */}
          <TabsContent value="history" className="mt-6">
            <Card className="border-border/50 shadow-lg shadow-primary/5 bg-gradient-to-br from-background to-background/95">
              <CardHeader className="bg-gradient-to-r from-primary/10 via-secondary/5 to-primary/10 border-b border-border/50 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20">
                    <BarChart className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-xl sm:text-2xl font-heading bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                      {language === 'en' ? 'History' : 'Historique'}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {language === 'en' 
                        ? 'View your completed, paid, and cancelled orders'
                        : 'Consultez vos commandes terminées, payées et annulées'}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                {historyOrders.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="inline-flex p-4 rounded-full bg-muted/50 mb-4">
                      <Package className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground text-lg font-medium">
                      {language === 'en' ? 'No order history' : 'Aucun historique de commande'}
                    </p>
                    <p className="text-sm text-muted-foreground/80 mt-2">
                      {language === 'en' ? 'Your completed orders will appear here' : 'Vos commandes terminées apparaîtront ici'}
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto rounded-lg border border-border/30">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gradient-to-r from-muted/50 to-muted/30 border-b-2 border-border/50">
                            <TableHead className="font-semibold text-foreground/90">{t.customerName}</TableHead>
                            <TableHead className="font-semibold text-foreground/90">{t.phone}</TableHead>
                            <TableHead className="font-semibold text-foreground/90">{t.city}</TableHead>
                            <TableHead className="font-semibold text-foreground/90">{t.passType}</TableHead>
                            <TableHead className="font-semibold text-foreground/90">{t.quantity}</TableHead>
                            <TableHead className="font-semibold text-foreground/90">{t.totalPrice}</TableHead>
                            <TableHead className="font-semibold text-foreground/90">{t.status}</TableHead>
                            <TableHead className="font-semibold text-foreground/90">{language === 'en' ? 'Date' : 'Date'}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {historyOrders.map((order, index) => (
                            <TableRow 
                              key={order.id} 
                              className={`border-border/30 transition-all duration-200 ${
                                index % 2 === 0 
                                  ? 'bg-card/30 hover:bg-card/50' 
                                  : 'bg-card/20 hover:bg-card/40'
                              }`}
                            >
                              <TableCell className="font-medium text-foreground">{order.user_name}</TableCell>
                              <TableCell className="text-foreground/90 flex items-center gap-2">
                                <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                                {order.user_phone}
                              </TableCell>
                              <TableCell className="text-foreground/90 flex items-center gap-2">
                                <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                                {order.city}{order.ville ? ` – ${order.ville}` : ''}
                              </TableCell>
                              <TableCell>
                                {(() => {
                                  const passes = getOrderPasses(order);
                                  if (passes.length === 0) {
                                    return <span className="text-muted-foreground text-sm">-</span>;
                                  }
                                  
                                  if (passes.length === 1) {
                                    const pass = passes[0];
                                    const isVip = pass.pass_type?.toLowerCase() === 'vip';
                                    const passName = isVip ? t.vip : (pass.pass_type || t.standard);
                                    return (
                                      <Badge 
                                        variant={isVip ? "default" : "secondary"}
                                        className={isVip 
                                          ? "bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 text-yellow-300 border-yellow-500/30" 
                                          : "bg-muted/50 text-foreground/80"
                                        }
                                      >
                                        {passName}
                                      </Badge>
                                    );
                                  }
                                  
                                  // Multiple passes - show breakdown
                                  const passBreakdown = passes
                                    .map((p: any) => {
                                      const passName = p.pass_type?.toLowerCase() === 'vip' ? t.vip : 
                                                      p.pass_type?.toLowerCase() === 'zone 1' ? 'Zone 1' :
                                                      p.pass_type?.toLowerCase() === 'standard' ? t.standard : 
                                                      p.pass_type || t.standard;
                                      return `${p.quantity}× ${passName}`;
                                    })
                                    .join(' + ');
                                  return (
                                    <div className="space-y-1">
                                      <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary text-xs">MIXED</Badge>
                                      <p className="text-xs text-muted-foreground mt-1">{passBreakdown}</p>
                                    </div>
                                  );
                                })()}
                              </TableCell>
                              <TableCell className="text-center">
                                {(() => {
                                  const passes = getOrderPasses(order);
                                  const totalQuantity = passes.reduce((sum, p) => sum + (p.quantity || 0), 0) || order.quantity || 0;
                                  return (
                                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold">
                                      {totalQuantity}
                                    </span>
                                  );
                                })()}
                              </TableCell>
                              <TableCell className="font-semibold">
                                <span className="text-green-400 font-bold">{order.total_price.toFixed(2)} TND</span>
                              </TableCell>
                              <TableCell>{getStatusBadge(order.status)}</TableCell>
                              <TableCell>
                                <div className="text-xs space-y-1">
                                  <div className="font-medium text-foreground/90">
                                    {format(new Date(order.completed_at || order.cancelled_at || order.updated_at), 'MMM d, yyyy')}
                                  </div>
                                  <div className="text-muted-foreground flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {format(new Date(order.completed_at || order.cancelled_at || order.updated_at), 'HH:mm')}
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-4">
                      {historyOrders.map((order) => {
                        const isPaid = order.status === 'PAID';
                        const isCompleted = order.status === 'COMPLETED';
                        const isCancelled = order.status === 'CANCELLED' || order.status === 'CANCELLED_BY_AMBASSADOR' || order.status === 'CANCELLED_BY_ADMIN';
                        
                        return (
                          <Card 
                            key={order.id} 
                            className={`border-2 shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-[1.02] ${
                              isPaid 
                                ? 'bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-background border-blue-500/30' 
                                : isCompleted
                                ? 'bg-gradient-to-br from-green-500/10 via-green-500/5 to-background border-green-500/30'
                                : isCancelled
                                ? 'bg-gradient-to-br from-red-500/10 via-red-500/5 to-background border-red-500/30'
                                : 'bg-gradient-to-br from-card/50 to-card/30 border-border/50'
                            }`}
                          >
                            <CardContent className="p-5 space-y-4">
                              {/* Header with status */}
                              <div className="flex items-start justify-between pb-3 border-b border-border/30">
                                <div className="flex-1">
                                  <h3 className="font-bold text-lg text-foreground mb-1">{order.user_name}</h3>
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Clock className="w-3.5 h-3.5" />
                                    {format(new Date(order.completed_at || order.cancelled_at || order.updated_at), 'MMM d, yyyy HH:mm')}
                                  </div>
                                </div>
                                <div>{getStatusBadge(order.status)}</div>
                              </div>

                              {/* Customer Info */}
                              <div className="grid grid-cols-1 gap-3">
                                <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                                  <Phone className="w-4 h-4 text-primary/70" />
                                  <div>
                                    <p className="text-xs text-muted-foreground">{t.phone}</p>
                                    <p className="text-sm font-medium text-foreground">{order.user_phone}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                                  <MapPin className="w-4 h-4 text-primary/70" />
                                  <div>
                                    <p className="text-xs text-muted-foreground">{t.city}</p>
                                    <p className="text-sm font-medium text-foreground">{order.city}{order.ville ? ` – ${order.ville}` : ''}</p>
                                  </div>
                                </div>
                              </div>

                              {/* Pass Details */}
                              <div className="p-3 rounded-lg bg-muted/20 border border-border/30">
                                <p className="text-xs text-muted-foreground mb-2">{t.passType}</p>
                                {(() => {
                                  const passes = getOrderPasses(order);
                                  if (passes.length === 0) {
                                    return <span className="text-muted-foreground text-sm">-</span>;
                                  }
                                  
                                  if (passes.length === 1) {
                                    const pass = passes[0];
                                    const isVip = pass.pass_type?.toLowerCase() === 'vip';
                                    const passName = isVip ? t.vip : (pass.pass_type || t.standard);
                                    return (
                                      <div className="space-y-2">
                                        <Badge 
                                          variant={isVip ? "default" : "secondary"}
                                          className={isVip 
                                            ? "bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 text-yellow-300 border-yellow-500/30" 
                                            : "bg-muted/50 text-foreground/80"
                                          }
                                        >
                                          {passName}
                                        </Badge>
                                        <div className="flex items-center gap-2">
                                          <p className="text-xs text-muted-foreground">{t.quantity}:</p>
                                          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/20 text-primary font-bold">
                                            {pass.quantity}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  }
                                  
                                  // Multiple passes - show all passes clearly
                                  return (
                                    <div className="space-y-2">
                                      <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary text-xs">MIXED</Badge>
                                      <div className="space-y-1.5 mt-2">
                                        {passes.map((p: any, idx: number) => {
                                          const passName = p.pass_type?.toLowerCase() === 'vip' ? t.vip : 
                                                          p.pass_type?.toLowerCase() === 'zone 1' ? 'Zone 1' :
                                                          p.pass_type?.toLowerCase() === 'standard' ? t.standard : 
                                                          p.pass_type || t.standard;
                                          return (
                                            <div key={idx} className="flex items-center justify-between text-sm bg-background/50 p-2 rounded">
                                              <span className="font-medium">{passName}</span>
                                              <span className="text-muted-foreground">× {p.quantity}</span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                      <div className="flex items-center gap-2 pt-1 border-t border-border/30">
                                        <p className="text-xs text-muted-foreground">{t.quantity}:</p>
                                        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/20 text-primary font-bold">
                                          {passes.reduce((sum, p) => sum + (p.quantity || 0), 0)}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>

                              {/* Total Price - Highlighted */}
                              <div className="p-4 rounded-lg bg-gradient-to-r from-green-500/20 via-green-500/10 to-green-500/20 border border-green-500/30">
                                <p className="text-xs text-green-300/80 mb-1">{t.totalPrice}</p>
                                <p className="text-2xl font-bold text-green-400">{order.total_price.toFixed(2)} TND</p>
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

          {/* Performance Tab */}
          <TabsContent value="performance" className="mt-6">
            {performance ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {/* Completion Rate Card */}
                <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent hover:from-emerald-500/15 hover:via-emerald-500/10 transition-all duration-300 shadow-lg shadow-emerald-500/10 hover:shadow-xl hover:shadow-emerald-500/20 hover:scale-[1.02]">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-emerald-500/10 transition-colors" />
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-3 text-sm sm:text-base font-semibold text-muted-foreground">
                      <div className="p-2 rounded-lg bg-emerald-500/20 group-hover:bg-emerald-500/30 transition-colors">
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                      </div>
                      {t.completionRate}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-emerald-400 to-emerald-300 bg-clip-text text-transparent mb-2">
                      {performance.completionRate}%
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground/80 font-medium">
                      {performance.paid} / {performance.total} {language === 'en' ? 'paid' : 'payées'}
                    </p>
                    <div className="mt-3 h-1.5 bg-emerald-500/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-emerald-400 to-emerald-300 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(parseFloat(performance.completionRate) || 0, 100)}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Cancellation Rate Card */}
                <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-red-500/10 via-red-500/5 to-transparent hover:from-red-500/15 hover:via-red-500/10 transition-all duration-300 shadow-lg shadow-red-500/10 hover:shadow-xl hover:shadow-red-500/20 hover:scale-[1.02]">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-red-500/10 transition-colors" />
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-3 text-sm sm:text-base font-semibold text-muted-foreground">
                      <div className="p-2 rounded-lg bg-red-500/20 group-hover:bg-red-500/30 transition-colors">
                        <XCircle className="w-4 h-4 text-red-400" />
                      </div>
                      {t.cancellationRate}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-red-400 to-red-300 bg-clip-text text-transparent mb-2">
                      {performance.cancellationRate}%
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground/80 font-medium">
                      {performance.cancelled} {language === 'en' ? 'cancelled orders' : 'commandes annulées'}
                    </p>
                    <div className="mt-3 h-1.5 bg-red-500/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-red-400 to-red-300 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(parseFloat(performance.cancellationRate) || 0, 100)}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Rejection Rate Card */}
                <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-orange-500/10 via-orange-500/5 to-transparent hover:from-orange-500/15 hover:via-orange-500/10 transition-all duration-300 shadow-lg shadow-orange-500/10 hover:shadow-xl hover:shadow-orange-500/20 hover:scale-[1.02]">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-orange-500/10 transition-colors" />
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-3 text-sm sm:text-base font-semibold text-muted-foreground">
                      <div className="p-2 rounded-lg bg-orange-500/20 group-hover:bg-orange-500/30 transition-colors">
                        <AlertCircle className="w-4 h-4 text-orange-400" />
                      </div>
                      {t.rejectionRate}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-orange-400 to-orange-300 bg-clip-text text-transparent mb-2">
                      {performance.rejectionRate}%
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground/80 font-medium">
                      {performance.rejected} {language === 'en' ? 'rejected orders' : 'commandes rejetées'}
                    </p>
                    <div className="mt-3 h-1.5 bg-orange-500/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-orange-400 to-orange-300 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(parseFloat(performance.rejectionRate) || 0, 100)}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Total Revenue Card */}
                <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-green-500/10 via-green-500/5 to-transparent hover:from-green-500/15 hover:via-green-500/10 transition-all duration-300 shadow-lg shadow-green-500/10 hover:shadow-xl hover:shadow-green-500/20 hover:scale-[1.02]">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-green-500/10 transition-colors" />
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-3 text-sm sm:text-base font-semibold text-muted-foreground">
                      <div className="p-2 rounded-lg bg-green-500/20 group-hover:bg-green-500/30 transition-colors">
                        <DollarSign className="w-4 h-4 text-green-400" />
                      </div>
                      {t.totalRevenue}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent mb-2">
                      {parseFloat(performance.totalRevenue).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground/80 font-medium">
                      TND {language === 'en' ? 'total revenue' : 'revenu total'}
                    </p>
                    <div className="mt-3 flex items-center gap-1 text-green-400/60">
                      <TrendingUp className="w-3 h-3" />
                      <span className="text-xs font-medium">{language === 'en' ? 'All time' : 'Tout le temps'}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Commission Earned Card */}
                <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 hover:from-primary/25 hover:via-primary/15 transition-all duration-300 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.02]">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-primary/15 transition-colors" />
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-3 text-sm sm:text-base font-semibold text-muted-foreground">
                      <div className="p-2 rounded-lg bg-primary/30 group-hover:bg-primary/40 transition-colors">
                        <DollarSign className="w-4 h-4 text-primary" />
                      </div>
                      {t.commissionEarned}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary via-primary/90 to-primary/80 bg-clip-text text-transparent mb-2">
                      {parseFloat(performance.commission).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground/80 font-medium">
                      {language === 'en' 
                        ? `${performance.totalPassesSold || 0} ${(performance.totalPassesSold || 0) === 1 ? 'pass sold' : 'passes sold'}`
                        : `${performance.totalPassesSold || 0} ${(performance.totalPassesSold || 0) === 1 ? 'pass vendu' : 'passes vendus'}`}
                    </p>
                    <div className="mt-3 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground/70">{language === 'en' ? 'Base (passes 8+)' : 'Base (passes 8+)'}:</span>
                        <span className="font-semibold text-primary">{(performance.baseCommission || 0).toFixed(0)} DT</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground/70">{language === 'en' ? 'Bonuses' : 'Bonus'}:</span>
                        <span className="font-semibold text-primary">+{(performance.totalBonuses || 0).toFixed(0)} DT</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card className="border-border/50 shadow-lg shadow-primary/5">
                <CardContent className="p-12">
                  <div className="flex flex-col items-center justify-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <BarChart className="w-6 h-6 text-primary animate-pulse" />
                    </div>
                    <p className="text-center text-muted-foreground font-medium">
                    {language === 'en' ? 'Loading performance data...' : 'Chargement des données de performance...'}
                  </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Profile Tab */}
          <TabsContent value="profile" className="mt-6">
            <Card className="border-border/50 shadow-lg shadow-primary/5">
              <CardHeader>
                <CardTitle className="text-xl sm:text-2xl font-heading">{t.profile}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium mb-2 block">{t.currentPhone}</Label>
                    <Input value={ambassador.phone} disabled className="bg-muted/50 border-border/50" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-2 block">{t.city}</Label>
                    <Input value={ambassador.city} disabled className="bg-muted/50 border-border/50" />
                  </div>
                  {ambassador.ville && (
                    <div>
                      <Label className="text-sm font-medium mb-2 block">{t.ville}</Label>
                      <Input value={ambassador.ville} disabled className="bg-muted/50 border-border/50" />
                    </div>
                  )}
                  <Button 
                    onClick={() => setIsProfileDialogOpen(true)}
                    className="w-full sm:w-auto bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 text-white border-0 shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-all duration-300"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    {t.editProfile}
                  </Button>
                </div>
              </CardContent>
            </Card>
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
