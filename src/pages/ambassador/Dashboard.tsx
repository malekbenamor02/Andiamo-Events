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
import { useToast } from "@/hooks/use-toast";
import { LogOut, User, BarChart, Calendar, Plus, Edit, Trash2 } from 'lucide-react';

const AmbassadorDashboard = ({ language }) => {
  const [ambassador, setAmbassador] = useState(null);
  const [sales, setSales] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSale, setEditingSale] = useState(null);
  const [saleToDelete, setSaleToDelete] = useState(null);

  const [formData, setFormData] = useState({
    event_id: '',
    full_name: '',
    phone: '',
    standard_tickets: 0,
    vip_tickets: 0,
  });
  const navigate = useNavigate();
  const { toast } = useToast();

  const t = language === 'en' ? {
    title: "Ambassador Dashboard",
    welcome: "Welcome",
    totalSales: "Total Sales",
    commissionEarned: "Commission Earned",
    upcomingEvents: "Upcoming Events",
    addSale: "Add Sale",
    mySales: "My Sales",
    clientName: "Client Name",
    clientPhone: "Client Phone",
    event: "Event",
    tickets: "Tickets",
    amount: "Amount",
    date: "Date",
    actions: "Actions",
    noSales: "No sales recorded yet.",
    logout: "Logout",
    loading: "Loading your dashboard...",
    save: "Save",
    cancel: "Cancel",
    newSaleTitle: "Record a New Sale",
    editSaleTitle: "Edit Sale"
  } : {
    title: "Tableau de Bord Ambassadeur",
    welcome: "Bienvenue",
    totalSales: "Ventes Totales",
    commissionEarned: "Commission Gagnée",
    upcomingEvents: "Événements à Venir",
    addSale: "Ajouter Vente",
    mySales: "Mes Ventes",
    clientName: "Nom du Client",
    clientPhone: "Téléphone du Client",
    event: "Événement",
    tickets: "Billets",
    amount: "Montant",
    date: "Date",
    actions: "Actions",
    noSales: "Aucune vente enregistrée.",
    logout: "Déconnexion",
    loading: "Chargement de votre tableau de bord...",
    save: "Enregistrer",
    cancel: "Annuler",
    newSaleTitle: "Enregistrer une Nouvelle Vente",
    editSaleTitle: "Modifier Vente"
  };

  useEffect(() => {
    const session = localStorage.getItem('ambassadorSession');
    if (!session) {
      navigate('/ambassador/auth');
      return;
    }
    const { user } = JSON.parse(session);
    setAmbassador(user);
    fetchData(user.id);
  }, [navigate]);
  
  const fetchData = async (ambassadorId) => {
    setLoading(true);
    const { data: salesData, error: salesError } = await supabase
      .from('clients')
      .select('*, events(name)')
      .eq('ambassador_id', ambassadorId)
      .order('created_at', { ascending: false });

    const { data: eventsData, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .eq('event_type', 'upcoming');

    if (salesError || eventsError) {
      toast({ title: "Error", description: "Failed to fetch data.", variant: "destructive" });
    } else {
      setSales(salesData);
      setEvents(eventsData);
    }
    setLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('ambassadorSession');
    navigate('/ambassador/auth');
  };

  const handleOpenDialog = (sale = null) => {
    if (sale) {
      setEditingSale(sale);
      setFormData({
        event_id: sale.event_id,
        full_name: sale.full_name,
        phone: sale.phone,
        standard_tickets: sale.standard_tickets,
        vip_tickets: sale.vip_tickets,
      });
    } else {
      setEditingSale(null);
      setFormData({
        event_id: '',
        full_name: '',
        phone: '',
        standard_tickets: 0,
        vip_tickets: 0,
      });
    }
    setIsDialogOpen(true);
  };

  const handleSaveSale = async () => {
    if (!formData.event_id || !formData.full_name || !formData.phone) {
      toast({ title: "Missing Information", description: "Please fill out all required fields.", variant: "destructive" });
      return;
    }

    const selectedEvent = events.find(e => e.id === formData.event_id);
    const totalAmount = (formData.standard_tickets * selectedEvent.standard_price) + (formData.vip_tickets * selectedEvent.vip_price);

    const saleData = {
      full_name: formData.full_name,
      phone: formData.phone,
      event_id: formData.event_id,
      standard_tickets: formData.standard_tickets,
      vip_tickets: formData.vip_tickets,
      ambassador_id: ambassador.id,
      total_amount: totalAmount,
    };

    let error;
    if (editingSale) {
      // Update existing sale
      ({ error } = await supabase.from('clients').update(saleData).eq('id', editingSale.id));
    } else {
      // Insert new sale
      ({ error } = await supabase.from('clients').insert(saleData));
    }

    if (error) {
      console.error("Error saving sale:", error);
      toast({ title: "Error", description: `Failed to save sale: ${error.message}`, variant: "destructive" });
    } else {
      toast({ title: "Success", description: `Sale ${editingSale ? 'updated' : 'recorded'} successfully.` });
      setIsDialogOpen(false);
      setEditingSale(null);
      fetchData(ambassador.id);
    }
  };

  const handleDeleteSale = async (saleId) => {
    // This will now be called only after confirmation
    const { error } = await supabase.from('clients').delete().eq('id', saleId);
    if (error) {
      toast({ title: "Error", description: "Failed to delete sale.", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Sale deleted successfully." });
      fetchData(ambassador.id);
    }
    setSaleToDelete(null);
  };

  if (loading || !ambassador) {
    return (
      <div className="pt-16 min-h-screen bg-background flex items-center justify-center">
        <p>{t.loading}</p>
      </div>
    );
  }

  const totalSalesCount = sales.reduce((acc, sale) => acc + sale.standard_tickets + sale.vip_tickets, 0);
  const totalCommission = sales.reduce((acc, sale) => acc + sale.total_amount * (ambassador.commission_rate / 100), 0);
  const totalStandardTickets = sales.reduce((acc, sale) => acc + (sale.standard_tickets || 0), 0);
  const totalVipTickets = sales.reduce((acc, sale) => acc + (sale.vip_tickets || 0), 0);

  return (
    <div className="pt-24 min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-gradient-neon">{t.title}</h1>
            <p className="text-muted-foreground">{t.welcome}, {ambassador.full_name}!</p>
          </div>
          <Button onClick={handleLogout} variant="outline">
            <LogOut className="w-4 h-4 mr-2" />
            {t.logout}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader><CardTitle>{t.totalSales}</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">{totalSalesCount}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>{t.commissionEarned}</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">{totalCommission.toFixed(2)} TND</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Tickets Sold</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-4">
                <div className="flex items-center gap-2 bg-purple-100 rounded-lg px-3 py-1">
                  <span className="font-semibold text-purple-700">Standard:</span>
                  <span className="text-2xl font-bold text-purple-700">{totalStandardTickets}</span>
                </div>
                <div className="flex items-center gap-2 bg-pink-100 rounded-lg px-3 py-1">
                  <span className="font-semibold text-pink-700">VIP:</span>
                  <span className="text-2xl font-bold text-pink-700">{totalVipTickets}</span>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>{t.upcomingEvents}</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">{events.length}</p></CardContent>
          </Card>
        </div>

        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">{t.mySales}</h2>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="w-4 h-4 mr-2" />
                {t.addSale}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingSale ? t.editSaleTitle : t.newSaleTitle}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="event">{t.event}</Label>
                  <Select value={formData.event_id} onValueChange={(value) => setFormData({ ...formData, event_id: value })}>
                    <SelectTrigger><SelectValue placeholder="Select an event" /></SelectTrigger>
                    <SelectContent>
                      {events.map(event => <SelectItem key={event.id} value={event.id}>{event.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="clientName">{t.clientName}</Label>
                  <Input id="clientName" value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="clientPhone">{t.clientPhone}</Label>
                  <Input id="clientPhone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Standard Tickets</Label>
                    <Input type="number" min="0" value={formData.standard_tickets} onChange={(e) => setFormData({ ...formData, standard_tickets: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <Label>VIP Tickets</Label>
                    <Input type="number" min="0" value={formData.vip_tickets} onChange={(e) => setFormData({ ...formData, vip_tickets: parseInt(e.target.value) || 0 })} />
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>{t.cancel}</Button>
                  <Button onClick={handleSaveSale}>{t.save}</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.clientName}</TableHead>
                <TableHead>{t.event}</TableHead>
                <TableHead>{t.tickets}</TableHead>
                <TableHead>{t.amount}</TableHead>
                <TableHead>{t.date}</TableHead>
                <TableHead>{t.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.length > 0 ? sales.map(sale => (
                <TableRow key={sale.id}>
                  <TableCell>{sale.full_name}</TableCell>
                  <TableCell>{sale.events.name}</TableCell>
                  <TableCell>{sale.standard_tickets + sale.vip_tickets}</TableCell>
                  <TableCell>{sale.total_amount.toFixed(2)} TND</TableCell>
                  <TableCell>{new Date(sale.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handleOpenDialog(sale)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => setSaleToDelete(sale)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">{t.noSales}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
      {/* Custom Delete Confirmation Dialog */}
      <Dialog open={!!saleToDelete} onOpenChange={open => { if (!open) setSaleToDelete(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === 'en' ? 'Delete Sale' : 'Supprimer la vente'}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>{language === 'en'
              ? 'Are you sure you want to delete this sale? This action cannot be undone.'
              : 'Êtes-vous sûr de vouloir supprimer cette vente ? Cette action est irréversible.'}
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSaleToDelete(null)}>{language === 'en' ? 'Cancel' : 'Annuler'}</Button>
            <Button variant="destructive" onClick={() => handleDeleteSale(saleToDelete.id)}>{language === 'en' ? 'Delete' : 'Supprimer'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AmbassadorDashboard; 