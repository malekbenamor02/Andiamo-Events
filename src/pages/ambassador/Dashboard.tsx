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
import { API_ROUTES, buildFullApiUrl } from "@/lib/api-routes";
import { sanitizeUrl } from "@/lib/url-validator";

interface AmbassadorDashboardProps {
  language: 'en' | 'fr';
}

interface Order {
  id: string;
  source: 'platform_cod' | 'platform_online' | 'ambassador_manual';
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
  status: 'PENDING_ADMIN_APPROVAL' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'PENDING' | 'ACCEPTED' | 'MANUAL_ACCEPTED' | 'MANUAL_COMPLETED' | 'CANCELLED_BY_AMBASSADOR' | 'CANCELLED_BY_ADMIN' | 'REFUNDED' | 'FRAUD_SUSPECT' | 'IGNORED' | 'ON_HOLD';
  cancellation_reason?: string;
  rejection_reason?: string;
  notes?: string | any; // JSON string or parsed object containing pass breakdown
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
  const [activeTab, setActiveTab] = useState('assigned');
  const [assignedOrders, setAssignedOrders] = useState<Order[]>([]);
  const [completedOrders, setCompletedOrders] = useState<Order[]>([]);
  const [performance, setPerformance] = useState<any>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isManualOrderDialogOpen, setIsManualOrderDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  
  const [events, setEvents] = useState<any[]>([]);
  const [eventPasses, setEventPasses] = useState<Record<string, any[]>>({}); // event_id -> passes[]
  const [manualOrderForm, setManualOrderForm] = useState({
    customer_name: '',
    phone: '',
    email: '',
    city: '',
    ville: '',
    event_id: '',
    selectedPasses: [] as Array<{ passId: string; passName: string; quantity: number; price: number }>,
    notes: ''
  });

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
    createManualOrder: "Create Manual Order",
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
    createOrder: "Create Manual Order",
    newOrder: "New Manual Order",
    event: "Event",
    selectEvent: "Select event",
    noUpcomingEvents: "No upcoming events",
    save: "Save",
    cancelOrder: "Cancel Order",
    cancelReason: "Cancellation Reason",
    reasonRequired: "Please provide a cancellation reason",
    orderAccepted: "Order accepted successfully",
    orderCancelled: "Order cancelled",
    orderCompleted: "Order completed successfully",
    manualOrderCreated: "Manual order created successfully",
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
    ignoreRate: "Ignore Rate",
    manualOrders: "Manual Orders",
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
    createManualOrder: "Créer Commande Manuelle",
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
    createOrder: "Créer Commande Manuelle",
    newOrder: "Nouvelle Commande Manuelle",
    event: "Événement",
    selectEvent: "Sélectionner un événement",
    noUpcomingEvents: "Aucun événement à venir",
    save: "Enregistrer",
    cancelOrder: "Annuler la Commande",
    cancelReason: "Raison d'Annulation",
    reasonRequired: "Veuillez fournir une raison d'annulation",
    orderAccepted: "Commande acceptée avec succès",
    orderCancelled: "Commande annulée",
    orderCompleted: "Commande terminée avec succès",
    manualOrderCreated: "Commande manuelle créée avec succès",
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
    ignoreRate: "Taux d'Ignoré",
    manualOrders: "Commandes Manuelles",
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
          
          // Only fetch data and events if not suspended
          if (latestAmbassador.status !== 'suspended') {
            fetchData(user.id);
            fetchEvents();
          } else {
            setLoading(false);
          }
        } else {
          // If fetch fails, use cached user data
          setAmbassador(user);
          fetchData(user.id);
          fetchEvents();
        }
      } catch (error) {
        console.error('Error fetching latest ambassador status:', error);
        // If fetch fails, use cached user data
        setAmbassador(user);
        fetchData(user.id);
        fetchEvents();
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
  
  const fetchEvents = async () => {
    try {
      // Get today's date at midnight to include all events starting today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Fetch all upcoming events - include both events with event_type='upcoming' and events without event_type (for backward compatibility)
      const { data, error } = await supabase
        .from('events')
        .select('id, name, date, event_type')
        .gte('date', today.toISOString())
        .order('date', { ascending: true });

      if (error) throw error;
      
      // Filter to only include events with event_type='upcoming' or event_type IS NULL (for backward compatibility)
      const upcomingEvents = (data || []).filter(event => 
        !event.event_type || event.event_type === 'upcoming'
      );
      
      setEvents(upcomingEvents);

      // Fetch passes for each event
      const passesMap: Record<string, any[]> = {};
      for (const event of upcomingEvents) {
        const { data: passesData, error: passesError } = await supabase
          .from('event_passes')
          .select('*')
          .eq('event_id', event.id)
          .order('is_primary', { ascending: false })
          .order('price', { ascending: true });

        if (!passesError && passesData) {
          passesMap[event.id] = passesData;
        }
      }
      setEventPasses(passesMap);
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  const fetchData = async (ambassadorId: string) => {
    setLoading(true);
    try {
      // Fetch assigned orders (PENDING, ACCEPTED, MANUAL_ACCEPTED for non-COD; APPROVED for COD)
      const { data: assignedData, error: assignedError } = await supabase
        .from('orders')
        .select('*')
        .eq('ambassador_id', ambassadorId)
        .in('status', ['PENDING', 'ACCEPTED', 'MANUAL_ACCEPTED', 'APPROVED']) // Include APPROVED for COD orders
        .order('created_at', { ascending: false });

      if (assignedError) throw assignedError;
      setAssignedOrders(assignedData || []);

      // Fetch completed orders (COMPLETED status)
      const { data: completedData, error: completedError } = await supabase
        .from('orders')
        .select('*')
        .eq('ambassador_id', ambassadorId)
        .in('status', ['COMPLETED', 'MANUAL_COMPLETED']) // Include MANUAL_COMPLETED for backward compatibility
        .order('completed_at', { ascending: false })
        .limit(50);

      if (completedError) throw completedError;
      setCompletedOrders(completedData || []);

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
      const { data: allOrders, error } = await supabase
        .from('orders')
      .select('*')
        .eq('ambassador_id', ambassadorId);

      if (error) throw error;

      const total = allOrders?.length || 0;
      
      // Use uppercase status values (database uses uppercase)
      // Include COMPLETED orders (and MANUAL_COMPLETED for backward compatibility)
      const completed = allOrders?.filter((o: any) => 
        o.status === 'COMPLETED' || o.status === 'MANUAL_COMPLETED'
      ).length || 0;
      const cancelled = allOrders?.filter((o: any) => 
        o.status === 'CANCELLED_BY_AMBASSADOR' || o.status === 'CANCELLED_BY_ADMIN'
      ).length || 0;
      
      // Ignored orders: PENDING that haven't been accepted for more than 15 minutes
      const ignored = allOrders?.filter((o: any) => 
        (o.status === 'PENDING') && 
        o.assigned_at &&
        new Date(o.assigned_at).getTime() < Date.now() - 15 * 60 * 1000 && // 15 minutes
        !o.accepted_at // Not yet accepted
      ).length || 0;
      
      const manual = allOrders?.filter((o: any) => o.source === 'ambassador_manual').length || 0;
      
      // Total revenue: Only count COMPLETED orders (and MANUAL_COMPLETED for backward compatibility)
      const completedOrders = allOrders?.filter((o: any) => 
        o.status === 'COMPLETED' || o.status === 'MANUAL_COMPLETED'
      ) || [];
      const totalRevenue = completedOrders.reduce((sum: number, o: any) => sum + (o.total_price || 0), 0);
      
      // Commission: Only on completed orders
      const commission = totalRevenue * ((ambassador?.commission_rate || 10) / 100);

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
        completed,
        cancelled,
        ignored,
        manual,
        completionRate: total > 0 ? ((completed / total) * 100).toFixed(1) : '0',
        cancellationRate: total > 0 ? ((cancelled / total) * 100).toFixed(1) : '0',
        ignoreRate: total > 0 ? ((ignored / total) * 100).toFixed(1) : '0',
        avgResponseTime: avgResponseTime.toFixed(1),
        totalRevenue: totalRevenue.toFixed(2),
        commission: commission.toFixed(2)
      });
    } catch (error) {
      console.error('Error fetching performance:', error);
    }
  };

  const handleAcceptOrder = async (orderId: string) => {
    // Check if sales are enabled
    if (!salesEnabled) {
      toast({
        title: t.salesDisabledTitle,
        description: t.salesDisabledMessage,
        variant: "destructive"
      });
      return;
    }

    // Check if order is a manual order - ambassadors cannot approve their own manual orders
    const order = assignedOrders.find(o => o.id === orderId);
    if (order && (order.source === 'ambassador_manual' || order.status === 'PENDING_ADMIN_APPROVAL')) {
      toast({
        title: t.error,
        description: language === 'en' 
          ? 'Manual orders require admin approval. You cannot approve your own orders.'
          : 'Les commandes manuelles nécessitent l\'approbation de l\'administrateur. Vous ne pouvez pas approuver vos propres commandes.',
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('orders')
        .update({
          status: 'ACCEPTED', // Database uses uppercase
          accepted_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;

      // Log the action
      await supabase.from('order_logs').insert({
        order_id: orderId,
        action: 'accepted',
        performed_by: ambassador?.id,
        performed_by_type: 'ambassador'
      });

      toast({
        title: t.orderAccepted,
        variant: "default"
      });

      fetchData(ambassador?.id || '');
    } catch (error) {
      console.error('Error accepting order:', error);
      toast({
        title: t.error,
        description: "Failed to accept order.",
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

    try {
      // Cancel order without reassignment
      {
        const { error } = await supabase
          .from('orders')
          .update({
            status: 'CANCELLED_BY_AMBASSADOR',
            cancellation_reason: cancellationReason,
            cancelled_at: new Date().toISOString()
          })
          .eq('id', selectedOrder.id);

        if (error) throw error;

        // Log the action
        await supabase.from('order_logs').insert({
          order_id: selectedOrder.id,
          action: 'cancelled',
          performed_by: ambassador?.id,
          performed_by_type: 'ambassador',
          details: { reason: cancellationReason }
        });

        toast({
          title: t.orderCancelled,
          variant: "default"
        });
      }

      setIsCancelDialogOpen(false);
      setSelectedOrder(null);
      setCancellationReason('');
      fetchData(ambassador?.id || '');
    } catch (error) {
      console.error('Error cancelling order:', error);
      toast({
        title: t.error,
        description: "Failed to cancel order.",
        variant: "destructive"
      });
    }
  };

  const handleCompleteOrder = async (orderId: string) => {
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
      // First, get the order to check if it's a manual order
      const { data: order, error: fetchError } = await supabase
        .from('orders')
        .select('source, status, payment_method, user_email')
        .eq('id', orderId)
        .single();

      if (fetchError) throw fetchError;

      // COD orders (ambassador_manual) should be COMPLETED after approval
      // Check if order is in APPROVED status (required for COD orders)
      if (order.payment_method === 'cod' && order.status !== 'APPROVED') {
        toast({
          title: t.error,
          description: language === 'en'
            ? 'COD orders must be approved by admin before they can be completed.'
            : 'Les commandes COD doivent être approuvées par l\'administrateur avant de pouvoir être terminées.',
          variant: "destructive"
        });
        return;
      }
      
      // All completed orders use COMPLETED status (unified status)
      const newStatus = 'COMPLETED';

      const { error } = await supabase
        .from('orders')
        .update({
          status: newStatus,
          completed_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;

      // Log the action
      await supabase.from('order_logs').insert({
        order_id: orderId,
        action: 'completed',
        performed_by: ambassador?.id,
        performed_by_type: 'ambassador'
      });

      // Generate tickets and send confirmation email for COD orders
      if (order.payment_method === 'cod' && order.user_email) {
        try {
          console.log('🎫 Starting ticket generation for order:', orderId);
          console.log('📋 Order status after update:', newStatus);
          
          // Small delay to ensure database update is committed
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // First, generate tickets (this will also send the email with QR codes)
          const apiBase = sanitizeUrl(import.meta.env.VITE_API_URL || 'http://localhost:8082');
          const ticketApiUrl = buildFullApiUrl(API_ROUTES.GENERATE_TICKETS_FOR_ORDER, apiBase);
          
          if (!ticketApiUrl) {
            throw new Error('Invalid API URL configuration');
          }
          
          const ticketResponse = await fetch(ticketApiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ orderId }),
          });

          const responseData = await ticketResponse.json();
          console.log('📦 Ticket generation response status:', ticketResponse.status);
          console.log('📦 Ticket generation response data:', responseData);

          if (!ticketResponse.ok) {
            console.error('❌ Failed to generate tickets. Status:', ticketResponse.status);
            console.error('❌ Error details:', responseData);
            
            // Fallback to old email system if ticket generation fails
            console.log('📧 Falling back to old email system...');
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8082';
            const emailResponse = await fetch(`${apiUrl}/api/send-order-completion-email`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ orderId }),
            });

            if (!emailResponse.ok) {
              const emailErrorData = await emailResponse.json();
              console.error('❌ Failed to send completion email:', emailErrorData);
            } else {
              console.log('✅ Fallback email sent successfully');
            }
          } else {
            console.log('✅ Tickets generated successfully:', responseData);
          }
        } catch (error) {
          console.error('❌ Error generating tickets or sending email:', error);
          console.error('Error details:', error);
          // Don't fail the order completion if ticket/email generation fails
        }
      } else {
        console.log('⚠️ Skipping ticket generation - payment_method:', order.payment_method, 'user_email:', order.user_email);
      }

      toast({
        title: t.orderCompleted,
        variant: "default"
      });

      fetchData(ambassador?.id || '');
    } catch (error) {
      console.error('Error completing order:', error);
      toast({
        title: t.error,
        description: "Failed to complete order.",
        variant: "destructive"
      });
    }
  };

  const handleCreateManualOrder = async () => {
    // Check if sales are enabled
    if (!salesEnabled) {
      toast({
        title: t.salesDisabledTitle,
        description: t.salesDisabledMessage,
        variant: "destructive"
      });
      return;
    }

    // Validate ambassador is logged in
    if (!ambassador?.id) {
      toast({
        title: t.error,
        description: "You must be logged in to create orders.",
        variant: "destructive"
      });
      return;
    }

    // Debug: Log the entire form state
    console.log('Form state before validation:', manualOrderForm);

    // Validate form - check each field individually
    if (!manualOrderForm.customer_name || manualOrderForm.customer_name.trim() === '') {
      toast({
        title: t.error,
        description: "Customer name is required.",
        variant: "destructive"
      });
      return;
    }

    if (!manualOrderForm.phone || manualOrderForm.phone.trim() === '') {
      toast({
        title: t.error,
        description: "Phone number is required.",
        variant: "destructive"
      });
      return;
    }

    if (!manualOrderForm.city || manualOrderForm.city.trim() === '') {
      toast({
        title: t.error,
        description: "City is required.",
        variant: "destructive"
      });
      return;
    }

    if (!manualOrderForm.event_id) {
      toast({
        title: t.error,
        description: "Event selection is required.",
        variant: "destructive"
      });
      return;
    }

    // Validate phone
    const phoneRegex = /^[2594][0-9]{7}$/;
    if (!phoneRegex.test(manualOrderForm.phone)) {
      toast({
        title: t.error,
        description: "Invalid phone number format.",
        variant: "destructive"
      });
      return;
    }

    // Validate ville if city is Sousse
    if ((manualOrderForm.city === 'Sousse' || manualOrderForm.city === 'Tunis') && !manualOrderForm.ville) {
      toast({
        title: t.error,
        description: "Ville is required for Sousse.",
        variant: "destructive"
      });
      return;
    }

    try {
      // Get selected event
      const selectedEvent = events.find(e => e.id === manualOrderForm.event_id);
      if (!selectedEvent) {
        toast({
          title: t.error,
          description: "Please select a valid event.",
          variant: "destructive"
        });
        return;
      }

      // Validate that at least one pass is selected
      if (!manualOrderForm.selectedPasses || manualOrderForm.selectedPasses.length === 0) {
        toast({
          title: t.error,
          description: "Please select at least one pass.",
          variant: "destructive"
        });
        return;
      }

      // Validate all passes have quantity > 0
      for (const selectedPass of manualOrderForm.selectedPasses) {
        if (selectedPass.quantity <= 0) {
          toast({
            title: t.error,
            description: "Each pass must have a quantity greater than 0.",
            variant: "destructive"
          });
          return;
        }
      }

      // Trim and validate all required fields
      const customerName = manualOrderForm.customer_name?.trim();
      const phone = manualOrderForm.phone?.trim();
      const city = manualOrderForm.city?.trim();

      if (!customerName || !phone || !city) {
        toast({
          title: t.error,
          description: "Please fill in all required fields (customer name, phone, city).",
          variant: "destructive"
        });
        return;
      }

      // Calculate total quantity and total price
      const totalQuantity = manualOrderForm.selectedPasses.reduce((sum, pass) => sum + pass.quantity, 0);
      const totalPrice = manualOrderForm.selectedPasses.reduce((sum, pass) => sum + (pass.price * pass.quantity), 0);
      
      // Determine primary pass name (first selected pass name, or 'mixed' if multiple types)
      const primaryPassName = manualOrderForm.selectedPasses.length === 1 
        ? manualOrderForm.selectedPasses[0].passName 
        : 'mixed';

      // Prepare insert data - match the actual database schema
      // Database uses: user_name, user_phone, user_email (NOT customer_name, phone, email)
      // Status values are UPPERCASE: 'PENDING_ADMIN_APPROVAL'
      // Database uses payment_method (NOT payment_type)
      const insertData: any = {
        source: 'ambassador_manual',
        user_name: String(customerName || '').trim(), // Database column is user_name (NOT NULL)
        user_phone: String(phone || '').trim(), // Database column is user_phone (NOT NULL)
        user_email: manualOrderForm.email ? String(manualOrderForm.email).trim() : null, // Database column is user_email
        city: String(city || '').trim(),
        ville: manualOrderForm.ville ? String(manualOrderForm.ville).trim() : null,
        event_id: manualOrderForm.event_id || null,
        ambassador_id: ambassador.id,
        pass_type: primaryPassName, // Primary pass name (or 'mixed' if multiple)
        quantity: totalQuantity, // Total quantity across all passes
        total_price: totalPrice, // Total price of all passes combined
        payment_method: 'cod', // Database uses payment_method (NOT NULL)
        status: 'PENDING_ADMIN_APPROVAL', // Manual orders require admin approval
        notes: JSON.stringify({
          all_passes: manualOrderForm.selectedPasses.map(p => ({
            passId: p.passId,
            passName: p.passName,
            quantity: p.quantity,
            price: p.price
          })), // Store all pass types with their quantities and prices
          total_order_price: totalPrice,
          pass_count: manualOrderForm.selectedPasses.length, // Number of different pass types
          ambassador_notes: manualOrderForm.notes?.trim() || null
        })
      };

      // Final validation - ensure user_name is not empty (database column name)
      if (!insertData.user_name || insertData.user_name.length === 0) {
        console.error('ERROR: user_name is empty!', insertData);
        toast({
          title: t.error,
          description: "Customer name cannot be empty. Please check the form.",
          variant: "destructive"
        });
        return;
      }

      // Debug log - comprehensive logging
      console.log('=== DEBUGGING ORDER CREATION ===');
      console.log('1. Original form state:', manualOrderForm);
      console.log('2. Trimmed customerName:', customerName);
      console.log('3. Insert data object:', insertData);
      console.log('4. user_name in insertData:', insertData.user_name);
      console.log('5. user_name type:', typeof insertData.user_name);
      console.log('6. user_name length:', insertData.user_name?.length);
      console.log('7. JSON stringified:', JSON.stringify(insertData, null, 2));
      
      // Double-check: if user_name is still empty/null, abort
      if (!insertData.user_name || insertData.user_name.trim() === '') {
        console.error('ABORTING: user_name is empty in final insertData!');
        console.error('Form state was:', manualOrderForm);
        toast({
          title: t.error,
          description: "Customer name is missing. Please ensure the field is filled.",
          variant: "destructive"
        });
        return;
      }

      // Make the insert request
      console.log('8. Making Supabase insert request...');
      const { data, error } = await supabase
        .from('orders')
        .insert(insertData)
        .select()
        .single();
      
      console.log('9. Insert response - data:', data);
      console.log('10. Insert response - error:', error);

      if (error) {
        console.error('Supabase error details:', error);
        throw error;
      }

      toast({
        title: t.manualOrderCreated,
        variant: "default"
      });

      setIsManualOrderDialogOpen(false);
      setManualOrderForm({
        customer_name: '',
        phone: '',
        email: '',
        city: '',
        ville: '',
        event_id: '',
        selectedPasses: [],
        notes: ''
      });
      fetchData(ambassador?.id || '');
    } catch (error: any) {
      console.error('Error creating manual order:', error);
      const errorMessage = error?.message || error?.error?.message || "Failed to create manual order.";
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
        const apiBase = sanitizeUrl(import.meta.env.VITE_API_URL || 'http://localhost:8082');
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
    localStorage.removeItem('ambassadorSession');
    navigate('/ambassador/auth');
  };

  const getStatusBadge = (status: string) => {
    // Normalize status to handle both uppercase and lowercase
    const normalizedStatus = status.toUpperCase();
    
    // Status badge styling with proper colors
    if (normalizedStatus === 'ACCEPTED' || normalizedStatus === 'MANUAL_ACCEPTED') {
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
    if (normalizedStatus === 'COMPLETED' || normalizedStatus === 'MANUAL_COMPLETED') {
      return (
        <Badge className="bg-green-500/20 text-green-300 border border-green-500/30 shadow-lg shadow-green-500/20">
          {t.completed}
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
            <TabsList className="inline-flex h-10 items-center justify-start sm:justify-center rounded-lg bg-muted/50 p-1 text-muted-foreground w-full sm:w-auto min-w-full sm:min-w-0 sm:grid sm:grid-cols-5 gap-1 border border-border/30">
              <TabsTrigger 
                value="assigned"
                className="whitespace-nowrap px-3 sm:px-4 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/20 data-[state=active]:to-secondary/20 data-[state=active]:text-foreground data-[state=active]:shadow-lg data-[state=active]:shadow-primary/30 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-md"
              >
                {language === 'en' ? 'My Orders' : 'Mes Commandes'}
              </TabsTrigger>
              <TabsTrigger 
                value="manual"
                className="whitespace-nowrap px-3 sm:px-4 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/20 data-[state=active]:to-secondary/20 data-[state=active]:text-foreground data-[state=active]:shadow-lg data-[state=active]:shadow-primary/30 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-md"
              >
                {t.createManualOrder}
              </TabsTrigger>
              <TabsTrigger 
                value="completed"
                className="whitespace-nowrap px-3 sm:px-4 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/20 data-[state=active]:to-secondary/20 data-[state=active]:text-foreground data-[state=active]:shadow-lg data-[state=active]:shadow-primary/30 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-md"
              >
                {t.completedOrders}
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

          {/* My Orders Tab (shows APPROVED COD orders and ACCEPTED/MANUAL_ACCEPTED non-COD orders) */}
          <TabsContent value="assigned" className="mt-6">
            <Card className="border-border/50 shadow-lg shadow-primary/5">
              <CardHeader>
                <CardTitle className="text-xl sm:text-2xl font-heading">{language === 'en' ? 'My Orders' : 'Mes Commandes'}</CardTitle>
                <p className="text-sm text-muted-foreground mt-2">
                  {language === 'en' 
                    ? 'Shows approved COD orders ready to complete, and accepted non-COD orders'
                    : 'Affiche les commandes COD approuvées prêtes à être complétées, et les commandes non-COD acceptées'}
                </p>
              </CardHeader>
              <CardContent>
                {assignedOrders.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    {language === 'en' ? 'No active orders' : 'Aucune commande active'}
                  </p>
                ) : (
                  <>
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border/50">
                            <TableHead className="font-semibold">{t.customerName}</TableHead>
                            <TableHead className="font-semibold">{t.phone}</TableHead>
                            <TableHead className="font-semibold">{t.city}</TableHead>
                            <TableHead className="font-semibold">{t.passType}</TableHead>
                            <TableHead className="font-semibold">{t.quantity}</TableHead>
                            <TableHead className="font-semibold">{t.totalPrice}</TableHead>
                            <TableHead className="font-semibold">{t.status}</TableHead>
                            <TableHead className="font-semibold">{t.actions}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {assignedOrders.map((order) => (
                            <TableRow key={order.id} className="border-border/30 hover:bg-card/50 transition-colors">
                              <TableCell className="font-medium">{order.user_name}</TableCell>
                              <TableCell>{order.user_phone}</TableCell>
                              <TableCell>{order.city}{order.ville ? ` – ${order.ville}` : ''}</TableCell>
                              <TableCell>
                                {(() => {
                                  if (order.pass_type === 'mixed' && order.notes) {
                                    try {
                                      const notesData = typeof order.notes === 'string' 
                                        ? JSON.parse(order.notes) 
                                        : order.notes;
                                      if (notesData?.all_passes && Array.isArray(notesData.all_passes)) {
                                        const passBreakdown = notesData.all_passes
                                          .map((p: any) => `${p.quantity} ${p.passType === 'vip' ? t.vip : t.standard}`)
                                          .join(' + ');
                                        return (
                                          <div className="space-y-1">
                                            <Badge variant="outline" className="border-primary/30">MIXED</Badge>
                                            <p className="text-xs text-muted-foreground">{passBreakdown}</p>
                                          </div>
                                        );
                                      }
                                    } catch (e) {
                                      // Fall through to default
                                    }
                                  }
                                  return order.pass_type === 'vip' ? t.vip : order.pass_type === 'mixed' ? 'MIXED' : t.standard;
                                })()}
                              </TableCell>
                              <TableCell>{order.quantity}</TableCell>
                              <TableCell className="font-semibold">{order.total_price.toFixed(2)} TND</TableCell>
                              <TableCell>{getStatusBadge(order.status)}</TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  {(order.status === 'PENDING' && order.source !== 'ambassador_manual') && (
                                    <Button
                                      size="sm"
                                      onClick={() => handleAcceptOrder(order.id)}
                                      className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 text-white border-0 shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-all duration-300"
                                    >
                                      <CheckCircle className="w-4 h-4 mr-1" />
                                      {t.accept}
                                    </Button>
                                  )}
                                  {(order.status === 'PENDING_ADMIN_APPROVAL' || order.status === 'REJECTED') && (
                                    <Badge variant="outline" className={
                                      order.status === 'REJECTED' 
                                        ? "border-red-500/30 text-red-300"
                                        : "border-yellow-500/30 text-yellow-300"
                                    }>
                                      {order.status === 'REJECTED' 
                                        ? (language === 'en' ? 'Rejected' : 'Rejeté')
                                        : (language === 'en' ? 'Awaiting Admin Approval' : 'En Attente d\'Approbation')
                                      }
                                    </Badge>
                                  )}
                                  {order.status !== 'CANCELLED_BY_AMBASSADOR' && 
                                   order.status !== 'CANCELLED_BY_ADMIN' && 
                                   order.status !== 'COMPLETED' && 
                                   order.status !== 'PENDING_ADMIN_APPROVAL' && (
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
                                  )}
                                  {/* Only allow completion for APPROVED COD orders or ACCEPTED/MANUAL_ACCEPTED non-COD orders */}
                                  {((order.payment_method === 'cod' && order.status === 'APPROVED') ||
                                    (order.payment_method !== 'cod' && (order.status === 'ACCEPTED' || order.status === 'MANUAL_ACCEPTED'))) && (
                                    <Button
                                      size="sm"
                                      onClick={() => handleCompleteOrder(order.id)}
                                      className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white border-0 shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-all duration-300"
                                    >
                                      <CheckCircle className="w-4 h-4 mr-1" />
                                      {t.complete}
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-4">
                      {assignedOrders.map((order) => (
                        <Card key={order.id} className="border-border/50 bg-card/50 shadow-md hover:shadow-lg transition-shadow">
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
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1">{t.passType}</p>
                                  <div>
                                    {(() => {
                                      if (order.pass_type === 'mixed' && order.notes) {
                                        try {
                                          const notesData = typeof order.notes === 'string' 
                                            ? JSON.parse(order.notes) 
                                            : order.notes;
                                          if (notesData?.all_passes && Array.isArray(notesData.all_passes)) {
                                            const passBreakdown = notesData.all_passes
                                              .map((p: any) => `${p.quantity} ${p.passType === 'vip' ? t.vip : t.standard}`)
                                              .join(' + ');
                                            return (
                                              <div className="space-y-1">
                                                <Badge variant="outline" className="border-primary/30 text-xs">MIXED</Badge>
                                                <p className="text-xs text-muted-foreground">{passBreakdown}</p>
                                              </div>
                                            );
                                          }
                                        } catch (e) {
                                          // Fall through to default
                                        }
                                      }
                                      return <span className="text-sm">{order.pass_type === 'vip' ? t.vip : order.pass_type === 'mixed' ? 'MIXED' : t.standard}</span>;
                                    })()}
                                  </div>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1">{t.quantity}</p>
                                  <p className="text-sm font-medium">{order.quantity}</p>
                                </div>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">{t.totalPrice}</p>
                                <p className="text-lg font-bold text-foreground">{order.total_price.toFixed(2)} TND</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground mb-2">{t.status}</p>
                                {getStatusBadge(order.status)}
                              </div>
                            </div>
                            <div className="pt-2 border-t border-border/30">
                              <div className="flex flex-wrap gap-2">
                                {(order.status === 'PENDING' && order.source !== 'ambassador_manual') && (
                                  <Button
                                    size="sm"
                                    onClick={() => handleAcceptOrder(order.id)}
                                    className="flex-1 sm:flex-none bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 text-white border-0 shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-all duration-300 min-w-[100px]"
                                  >
                                    <CheckCircle className="w-4 h-4 mr-1" />
                                    {t.accept}
                                  </Button>
                                )}
                                {(order.status === 'PENDING_ADMIN_APPROVAL' || order.status === 'REJECTED') && (
                                  <Badge variant="outline" className={
                                    order.status === 'REJECTED' 
                                      ? "border-red-500/30 text-red-300 text-xs"
                                      : "border-yellow-500/30 text-yellow-300 text-xs"
                                  }>
                                    {order.status === 'REJECTED' 
                                      ? (language === 'en' ? 'Rejected' : 'Rejeté')
                                      : (language === 'en' ? 'Awaiting Approval' : 'En Attente')
                                    }
                                  </Badge>
                                )}
                                {order.status !== 'CANCELLED_BY_AMBASSADOR' && 
                                 order.status !== 'CANCELLED_BY_ADMIN' && 
                                 order.status !== 'COMPLETED' && (
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => {
                                      setSelectedOrder(order);
                                      setIsCancelDialogOpen(true);
                                    }}
                                    className="flex-1 sm:flex-none bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 shadow-lg shadow-red-500/20 hover:shadow-red-500/30 transition-all duration-300 min-w-[100px]"
                                  >
                                    <XCircle className="w-4 h-4 mr-1" />
                                    {t.cancel}
                                  </Button>
                                )}
                                {/* Only allow completion for APPROVED COD orders or ACCEPTED/MANUAL_ACCEPTED non-COD orders */}
                                {((order.payment_method === 'cod' && order.status === 'APPROVED') ||
                                  (order.payment_method !== 'cod' && (order.status === 'ACCEPTED' || order.status === 'MANUAL_ACCEPTED'))) && (
                                  <Button
                                    size="sm"
                                    onClick={() => handleCompleteOrder(order.id)}
                                    className="flex-1 sm:flex-none bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white border-0 shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-all duration-300 min-w-[100px]"
                                  >
                                    <CheckCircle className="w-4 h-4 mr-1" />
                                    {t.complete}
                                  </Button>
                                )}
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

          {/* Create Manual Order Tab */}
          <TabsContent value="manual" className="mt-6">
            <Card className="border-border/50 shadow-lg shadow-primary/5">
              <CardHeader>
                <CardTitle className="text-xl sm:text-2xl font-heading">{t.createManualOrder}</CardTitle>
              </CardHeader>
              <CardContent>
                {!salesEnabled && (
                  <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <div className="flex items-center gap-2 text-destructive">
                      <AlertCircle className="w-5 h-5" />
                      <h3 className="font-semibold">{t.salesDisabledTitle}</h3>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{t.salesDisabledMessage}</p>
                  </div>
                )}
                <div className={`space-y-4 ${!salesEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label>{t.customerName} *</Label>
                      <Input
                        value={manualOrderForm.customer_name || ''}
                        onChange={(e) => setManualOrderForm({ ...manualOrderForm, customer_name: e.target.value })}
                        required
                        placeholder={language === 'en' ? "Enter customer name" : "Entrez le nom du client"}
                      />
                    </div>
                    <div>
                      <Label>{t.phone} *</Label>
                      <Input
                        value={manualOrderForm.phone}
                        onChange={(e) => setManualOrderForm({ ...manualOrderForm, phone: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>{t.email}</Label>
                    <Input
                      type="email"
                      value={manualOrderForm.email}
                      onChange={(e) => setManualOrderForm({ ...manualOrderForm, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>{t.event} *</Label>
                    <Select
                      value={manualOrderForm.event_id}
                      onValueChange={(value) => {
                        setManualOrderForm({ 
                          ...manualOrderForm, 
                          event_id: value,
                          pass_id: '' // Reset pass selection when event changes
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t.selectEvent} />
                      </SelectTrigger>
                      <SelectContent>
                        {events.length === 0 ? (
                          <SelectItem value="no-events" disabled>
                            {t.noUpcomingEvents}
                          </SelectItem>
                        ) : (
                          events.map(event => (
                            <SelectItem key={event.id} value={event.id}>
                              {event.name} - {new Date(event.date).toLocaleDateString()}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label>{t.city} *</Label>
                      <Select
                        value={manualOrderForm.city}
                        onValueChange={(value) => setManualOrderForm({ ...manualOrderForm, city: value, ville: '' })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select city" />
                        </SelectTrigger>
                        <SelectContent>
                          {CITIES.map(city => (
                            <SelectItem key={city} value={city}>{city}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {(manualOrderForm.city === 'Sousse' || manualOrderForm.city === 'Tunis') && (
                      <div>
                        <Label>{t.ville} *</Label>
                        <Select
                          value={manualOrderForm.ville}
                          onValueChange={(value) => setManualOrderForm({ ...manualOrderForm, ville: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select ville" />
                          </SelectTrigger>
                          <SelectContent>
                            {manualOrderForm.city === 'Sousse' && SOUSSE_VILLES.map(ville => (
                              <SelectItem key={ville} value={ville}>{ville}</SelectItem>
                            ))}
                            {manualOrderForm.city === 'Tunis' && TUNIS_VILLES.map(ville => (
                              <SelectItem key={ville} value={ville}>{ville}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  {manualOrderForm.event_id && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label>{language === 'en' ? 'Select Passes' : 'Sélectionner les Passes'} *</Label>
                        <Select
                          value=""
                          onValueChange={(value) => {
                            if (value && value !== '') {
                              const availablePasses = eventPasses[manualOrderForm.event_id] || [];
                              const selectedPass = availablePasses.find((p: any) => p.id === value);
                              if (selectedPass && !manualOrderForm.selectedPasses.find(p => p.passId === value)) {
                                const passPrice = typeof selectedPass.price === 'number' ? selectedPass.price : parseFloat(selectedPass.price) || 0;
                                setManualOrderForm({
                                  ...manualOrderForm,
                                  selectedPasses: [
                                    ...manualOrderForm.selectedPasses,
                                    {
                                      passId: selectedPass.id,
                                      passName: selectedPass.name,
                                      quantity: 1,
                                      price: passPrice
                                    }
                                  ]
                                });
                              }
                            }
                          }}
                        >
                          <SelectTrigger className="w-auto">
                            <SelectValue placeholder={language === 'en' ? "Add a pass" : "Ajouter un pass"} />
                          </SelectTrigger>
                          <SelectContent>
                            {eventPasses[manualOrderForm.event_id]?.length === 0 ? (
                              <SelectItem value="no-passes" disabled>
                                {language === 'en' ? 'No passes available' : 'Aucun pass disponible'}
                              </SelectItem>
                            ) : (
                              eventPasses[manualOrderForm.event_id]?.filter((pass: any) => 
                                !manualOrderForm.selectedPasses.find(p => p.passId === pass.id)
                              ).map((pass: any) => (
                                <SelectItem key={pass.id} value={pass.id}>
                                  {pass.name} - {typeof pass.price === 'number' ? pass.price : parseFloat(pass.price) || 0} TND
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {manualOrderForm.selectedPasses.length > 0 && (
                        <div className="space-y-2">
                          {manualOrderForm.selectedPasses.map((selectedPass, index) => (
                            <div 
                              key={selectedPass.passId} 
                              className="flex items-center gap-3 p-4 rounded-lg border transition-all duration-200"
                              style={{
                                background: '#1F1F1F',
                                borderColor: '#2A2A2A'
                              }}
                            >
                              <div className="flex-1">
                                <p className="font-medium text-sm" style={{ color: '#FFFFFF' }}>{selectedPass.passName}</p>
                                <p className="text-xs mt-1" style={{ color: '#B0B0B0' }}>{selectedPass.price.toFixed(2)} TND each</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Label className="text-xs" style={{ color: '#B0B0B0' }}>{language === 'en' ? 'Qty:' : 'Qté:'}</Label>
                                <Input
                                  type="number"
                                  min="1"
                                  max="10"
                                  value={selectedPass.quantity}
                                  onChange={(e) => {
                                    const newQuantity = Math.max(1, parseInt(e.target.value) || 1);
                                    const updatedPasses = [...manualOrderForm.selectedPasses];
                                    updatedPasses[index] = { ...selectedPass, quantity: newQuantity };
                                    setManualOrderForm({ ...manualOrderForm, selectedPasses: updatedPasses });
                                  }}
                                  className="w-16 h-8 text-sm"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const updatedPasses = manualOrderForm.selectedPasses.filter((_, i) => i !== index);
                                    setManualOrderForm({ ...manualOrderForm, selectedPasses: updatedPasses });
                                  }}
                                  className="h-8 w-8 p-0"
                                  style={{
                                    color: '#EF4444'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                  }}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold text-sm" style={{ color: '#E21836' }}>{(selectedPass.price * selectedPass.quantity).toFixed(2)} TND</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {manualOrderForm.selectedPasses.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          {language === 'en' ? 'No passes selected. Use the dropdown above to add passes.' : 'Aucun pass sélectionné. Utilisez le menu déroulant ci-dessus pour ajouter des passes.'}
                        </p>
                      )}
                      
                      {manualOrderForm.selectedPasses.length > 0 && (
                        <div 
                          className="p-4 rounded-lg border"
                          style={{
                            background: '#1F1F1F',
                            borderColor: '#2A2A2A'
                          }}
                        >
                          <div className="flex justify-between items-center">
                            <span className="text-sm" style={{ color: '#B0B0B0' }}>{t.totalPrice}:</span>
                            <span className="text-xl font-bold" style={{ color: '#E21836' }}>
                              {manualOrderForm.selectedPasses.reduce((sum, pass) => sum + (pass.price * pass.quantity), 0).toFixed(2)} TND
                            </span>
                          </div>
                          <div className="flex justify-between items-center mt-2 text-xs" style={{ color: '#B0B0B0' }}>
                            <span>{language === 'en' ? 'Total Quantity:' : 'Quantité Totale:'}</span>
                            <span style={{ color: '#FFFFFF' }}>{manualOrderForm.selectedPasses.reduce((sum, pass) => sum + pass.quantity, 0)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <div>
                    <Label>{language === 'en' ? 'Notes (Optional)' : 'Notes (Optionnel)'}</Label>
                    <Textarea
                      value={manualOrderForm.notes}
                      onChange={(e) => setManualOrderForm({ ...manualOrderForm, notes: e.target.value })}
                      placeholder={language === 'en' ? 'Add any additional notes...' : 'Ajoutez des notes supplémentaires...'}
                      rows={3}
                    />
                  </div>
                  <Button 
                    onClick={handleCreateManualOrder} 
                    disabled={!salesEnabled}
                    className="w-full bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 text-white border-0 shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {t.createOrder}
                  </Button>
            </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Completed Orders Tab */}
          <TabsContent value="completed" className="mt-6">
            <Card className="border-border/50 shadow-lg shadow-primary/5">
              <CardHeader>
                <CardTitle className="text-xl sm:text-2xl font-heading">{t.completedOrders}</CardTitle>
              </CardHeader>
              <CardContent>
                {completedOrders.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">{t.noCompletedOrders}</p>
                ) : (
                  <>
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border/50">
                            <TableHead className="font-semibold">{t.customerName}</TableHead>
                            <TableHead className="font-semibold">{t.phone}</TableHead>
                            <TableHead className="font-semibold">{t.city}</TableHead>
                            <TableHead className="font-semibold">{t.passType}</TableHead>
                            <TableHead className="font-semibold">{t.quantity}</TableHead>
                            <TableHead className="font-semibold">{t.totalPrice}</TableHead>
                            <TableHead className="font-semibold">Completed At</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {completedOrders.map((order) => (
                            <TableRow key={order.id} className="border-border/30 hover:bg-card/50 transition-colors">
                              <TableCell className="font-medium">{order.user_name}</TableCell>
                              <TableCell>{order.user_phone}</TableCell>
                              <TableCell>{order.city}{order.ville ? ` – ${order.ville}` : ''}</TableCell>
                              <TableCell>
                                {(() => {
                                  if (order.pass_type === 'mixed' && order.notes) {
                                    try {
                                      const notesData = typeof order.notes === 'string' 
                                        ? JSON.parse(order.notes) 
                                        : order.notes;
                                      if (notesData?.all_passes && Array.isArray(notesData.all_passes)) {
                                        const passBreakdown = notesData.all_passes
                                          .map((p: any) => `${p.quantity} ${p.passType === 'vip' ? t.vip : t.standard}`)
                                          .join(' + ');
                                        return (
                                          <div className="space-y-1">
                                            <Badge variant="outline" className="border-primary/30">MIXED</Badge>
                                            <p className="text-xs text-muted-foreground">{passBreakdown}</p>
                                          </div>
                                        );
                                      }
                                    } catch (e) {
                                      // Fall through to default
                                    }
                                  }
                                  return order.pass_type === 'vip' ? t.vip : order.pass_type === 'mixed' ? 'MIXED' : t.standard;
                                })()}
                              </TableCell>
                              <TableCell>{order.quantity}</TableCell>
                              <TableCell className="font-semibold">{order.total_price.toFixed(2)} TND</TableCell>
                              <TableCell>
                                {order.completed_at ? format(new Date(order.completed_at), 'PPp') : '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-4">
                      {completedOrders.map((order) => (
                        <Card key={order.id} className="border-border/50 bg-card/50 shadow-md hover:shadow-lg transition-shadow">
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
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1">{t.passType}</p>
                                  <div>
                                    {(() => {
                                      if (order.pass_type === 'mixed' && order.notes) {
                                        try {
                                          const notesData = typeof order.notes === 'string' 
                                            ? JSON.parse(order.notes) 
                                            : order.notes;
                                          if (notesData?.all_passes && Array.isArray(notesData.all_passes)) {
                                            const passBreakdown = notesData.all_passes
                                              .map((p: any) => `${p.quantity} ${p.passType === 'vip' ? t.vip : t.standard}`)
                                              .join(' + ');
                                            return (
                                              <div className="space-y-1">
                                                <Badge variant="outline" className="border-primary/30 text-xs">MIXED</Badge>
                                                <p className="text-xs text-muted-foreground">{passBreakdown}</p>
                                              </div>
                                            );
                                          }
                                        } catch (e) {
                                          // Fall through to default
                                        }
                                      }
                                      return <span className="text-sm">{order.pass_type === 'vip' ? t.vip : order.pass_type === 'mixed' ? 'MIXED' : t.standard}</span>;
                                    })()}
                                  </div>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1">{t.quantity}</p>
                                  <p className="text-sm font-medium">{order.quantity}</p>
                                </div>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">{t.totalPrice}</p>
                                <p className="text-lg font-bold text-foreground">{order.total_price.toFixed(2)} TND</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Completed At</p>
                                <p className="text-sm">{order.completed_at ? format(new Date(order.completed_at), 'PPp') : '-'}</p>
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

          {/* Performance Tab */}
          <TabsContent value="performance" className="mt-6">
            {performance && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                <Card className="border-border/50 shadow-lg shadow-primary/5 hover:shadow-xl hover:shadow-primary/10 transition-shadow">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                      <TrendingUp className="w-5 h-5 text-primary" />
                      {t.completionRate}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl sm:text-3xl font-bold text-gradient-neon">{performance.completionRate}%</p>
                    <p className="text-sm text-muted-foreground mt-1">{performance.completed} / {performance.total}</p>
                  </CardContent>
                </Card>
                <Card className="border-border/50 shadow-lg shadow-primary/5 hover:shadow-xl hover:shadow-primary/10 transition-shadow">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                      <XCircle className="w-5 h-5 text-red-400" />
                      {t.cancellationRate}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl sm:text-3xl font-bold text-red-400">{performance.cancellationRate}%</p>
                    <p className="text-sm text-muted-foreground mt-1">{performance.cancelled} orders</p>
                  </CardContent>
                </Card>
                <Card className="border-border/50 shadow-lg shadow-primary/5 hover:shadow-xl hover:shadow-primary/10 transition-shadow">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                      <Clock className="w-5 h-5 text-cyan-400" />
                      {t.avgResponseTime}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl sm:text-3xl font-bold text-cyan-400">{performance.avgResponseTime} min</p>
                  </CardContent>
                </Card>
                <Card className="border-border/50 shadow-lg shadow-primary/5 hover:shadow-xl hover:shadow-primary/10 transition-shadow">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                      <Package className="w-5 h-5 text-secondary" />
                      {t.manualOrders}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl sm:text-3xl font-bold text-secondary">{performance.manual}</p>
                  </CardContent>
                </Card>
                <Card className="border-border/50 shadow-lg shadow-primary/5 hover:shadow-xl hover:shadow-primary/10 transition-shadow">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                      <DollarSign className="w-5 h-5 text-green-400" />
                      {t.totalRevenue}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl sm:text-3xl font-bold text-green-400">{performance.totalRevenue} TND</p>
                  </CardContent>
                </Card>
                <Card className="border-border/50 shadow-lg shadow-primary/5 hover:shadow-xl hover:shadow-primary/10 transition-shadow">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                      <DollarSign className="w-5 h-5 text-green-500" />
                      {t.commissionEarned}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl sm:text-3xl font-bold text-gradient-neon">{performance.commission} TND</p>
                  </CardContent>
                </Card>
              </div>
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
        <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
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
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => {
                  setIsCancelDialogOpen(false);
                  setCancellationReason('');
                }}>
                  {t.cancel}
                </Button>
                <Button variant="destructive" onClick={handleCancelOrder}>
                  {t.cancel}
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
