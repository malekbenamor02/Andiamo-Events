import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { API_ROUTES, buildFullApiUrl } from '@/lib/api-routes';
import Loader from '@/components/ui/Loader';
import { 
  Mail, 
  Search, 
  Filter, 
  Eye, 
  RefreshCw, 
  Trash2,
  Calendar,
  User,
  Phone,
  Hash,
  Ticket,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';

interface Invitation {
  id: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_email: string;
  invitation_number: string;
  quantity: number;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  pass_type: string;
  zone_name?: string;
  zone_description?: string;
  sent_at?: string;
  email_delivery_status?: string;
  created_at: string;
  events?: {
    id: string;
    name: string;
    date: string;
    venue: string;
    city: string;
  };
}

interface OfficialInvitationsListProps {
  language?: 'en' | 'fr';
}

export const OfficialInvitationsList: React.FC<OfficialInvitationsListProps> = ({ 
  language = 'en'
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalQrCount, setTotalQrCount] = useState(0);
  
  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [eventFilter, setEventFilter] = useState<string>('all');
  
  // Pagination
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);
  
  // Details modal
  const [selectedInvitation, setSelectedInvitation] = useState<Invitation | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [qrTickets, setQrTickets] = useState<any[]>([]);
  const [detailsOpen, setDetailsOpen] = useState(false);
  
  // Delete confirmation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invitationToDelete, setInvitationToDelete] = useState<{ id: string; number: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch invitations
  const fetchInvitations = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (eventFilter !== 'all') params.append('event_id', eventFilter);
      params.append('limit', limit.toString());
      params.append('offset', offset.toString());

      const apiUrl = buildFullApiUrl(API_ROUTES.GET_OFFICIAL_INVITATIONS);
      if (!apiUrl) {
        throw new Error('Failed to build API URL');
      }

      const response = await fetch(`${apiUrl}?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });

      // Check content type first
      const contentType = response.headers.get('content-type');
      
      // Check if response is ok before parsing
      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        // Read response as text first (can only read once)
        const textResponse = await response.text();
        
        if (contentType && contentType.includes('application/json')) {
          try {
            const errorData = JSON.parse(textResponse);
            errorMessage = errorData.error || errorData.message || errorMessage;
          } catch (e) {
            errorMessage = textResponse || errorMessage;
          }
        } else {
          errorMessage = `Server returned non-JSON response. ${errorMessage}`;
          console.error('Non-JSON response received:', textResponse.substring(0, 200));
        }
        
        throw new Error(errorMessage);
      }

      // Parse JSON response safely
      if (!contentType || !contentType.includes('application/json')) {
        const textResponse = await response.text();
        throw new Error(`Expected JSON response but received ${contentType || 'unknown content type'}. Response: ${textResponse.substring(0, 200)}`);
      }

      const result = await response.json();

      if (result.success) {
        setInvitations(result.data || []);
        setTotalCount(result.count || 0);
        setTotalQrCount(result.qr_count || 0);
      } else {
        throw new Error(result.error || 'Failed to fetch invitations');
      }
    } catch (error) {
      console.error('Error fetching invitations:', error);
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: error instanceof Error 
          ? error.message 
          : (language === 'en' ? 'Failed to load invitations' : 'Échec du chargement des invitations'),
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvitations();
  }, [statusFilter, eventFilter, offset]);

  // Listen for invitation creation events
  useEffect(() => {
    const handleInvitationCreated = () => {
      fetchInvitations();
    };

    window.addEventListener('invitation-created', handleInvitationCreated);
    return () => {
      window.removeEventListener('invitation-created', handleInvitationCreated);
    };
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (offset === 0) {
        fetchInvitations();
      } else {
        setOffset(0);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [search]);

  // Fetch invitation details
  const fetchInvitationDetails = async (id: string) => {
    setDetailsLoading(true);
    try {
      const apiUrl = buildFullApiUrl(API_ROUTES.GET_OFFICIAL_INVITATION, undefined, id);
      if (!apiUrl) {
        throw new Error('Failed to build API URL');
      }

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });

      // Check content type first
      const contentType = response.headers.get('content-type');
      
      // Check if response is ok before parsing
      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        // Read response as text first (can only read once)
        const textResponse = await response.text();
        
        if (contentType && contentType.includes('application/json')) {
          try {
            const errorData = JSON.parse(textResponse);
            errorMessage = errorData.error || errorData.message || errorMessage;
          } catch (e) {
            errorMessage = textResponse || errorMessage;
          }
        } else {
          errorMessage = `Server returned non-JSON response. ${errorMessage}`;
          console.error('Non-JSON response received:', textResponse.substring(0, 200));
        }
        
        throw new Error(errorMessage);
      }

      // Parse JSON response safely
      if (!contentType || !contentType.includes('application/json')) {
        const textResponse = await response.text();
        throw new Error(`Expected JSON response but received ${contentType || 'unknown content type'}`);
      }

      const result = await response.json();

      if (result.success) {
        setSelectedInvitation(result.invitation);
        setQrTickets(result.qr_tickets || []);
      } else {
        throw new Error(result.error || 'Failed to fetch invitation details');
      }
    } catch (error) {
      console.error('Error fetching invitation details:', error);
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: error instanceof Error 
          ? error.message 
          : (language === 'en' ? 'Failed to load invitation details' : 'Échec du chargement des détails de l\'invitation'),
        variant: 'destructive'
      });
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleViewDetails = (invitation: Invitation) => {
    setSelectedInvitation(invitation);
    setDetailsOpen(true);
    fetchInvitationDetails(invitation.id);
  };

  const handleResendEmail = async (id: string) => {
    try {
      const apiUrl = buildFullApiUrl(API_ROUTES.RESEND_INVITATION_EMAIL, undefined, id);
      if (!apiUrl) {
        throw new Error('Failed to build API URL');
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });

      // Check content type first
      const contentType = response.headers.get('content-type');
      
      // Check if response is ok before parsing
      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        // Read response as text first (can only read once)
        const textResponse = await response.text();
        
        if (contentType && contentType.includes('application/json')) {
          try {
            const errorData = JSON.parse(textResponse);
            errorMessage = errorData.error || errorData.message || errorMessage;
          } catch (e) {
            errorMessage = textResponse || errorMessage;
          }
        } else {
          errorMessage = `Server returned non-JSON response. ${errorMessage}`;
          console.error('Non-JSON response received:', textResponse.substring(0, 200));
        }
        
        throw new Error(errorMessage);
      }

      // Parse JSON response safely
      if (!contentType || !contentType.includes('application/json')) {
        const textResponse = await response.text();
        throw new Error(`Expected JSON response but received ${contentType || 'unknown content type'}`);
      }

      const result = await response.json();

      toast({
        title: language === 'en' ? 'Success' : 'Succès',
        description: result.email_sent 
          ? (language === 'en' ? 'Email sent successfully' : 'Email envoyé avec succès')
          : (language === 'en' ? 'Failed to send email' : 'Échec de l\'envoi de l\'email'),
        variant: result.email_sent ? 'default' : 'destructive'
      });

      // Refresh list
      fetchInvitations();
    } catch (error) {
      console.error('Error resending email:', error);
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: error instanceof Error 
          ? error.message 
          : (language === 'en' ? 'Failed to resend email' : 'Échec de la réexpédition de l\'email'),
        variant: 'destructive'
      });
    }
  };

  const handleDeleteClick = (id: string, invitationNumber: string) => {
    setInvitationToDelete({ id, number: invitationNumber });
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!invitationToDelete) return;
    
    setDeleting(true);
    try {
      const apiUrl = buildFullApiUrl(API_ROUTES.DELETE_OFFICIAL_INVITATION, undefined, invitationToDelete.id);
      if (!apiUrl) {
        throw new Error('Failed to build API URL');
      }

      const response = await fetch(apiUrl, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });

      // Check content type first
      const contentType = response.headers.get('content-type');
      
      // Check if response is ok before parsing
      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        // Read response as text first (can only read once)
        const textResponse = await response.text();
        
        if (contentType && contentType.includes('application/json')) {
          try {
            const errorData = JSON.parse(textResponse);
            errorMessage = errorData.error || errorData.message || errorMessage;
          } catch (e) {
            errorMessage = textResponse || errorMessage;
          }
        } else {
          errorMessage = `Server returned non-JSON response. ${errorMessage}`;
          console.error('Non-JSON response received:', textResponse.substring(0, 200));
        }
        
        throw new Error(errorMessage);
      }

      // Parse JSON response safely
      if (!contentType || !contentType.includes('application/json')) {
        const textResponse = await response.text();
        throw new Error(`Expected JSON response but received ${contentType || 'unknown content type'}`);
      }

      const result = await response.json();

      toast({
        title: language === 'en' ? 'Success' : 'Succès',
        description: language === 'en' ? 'Invitation deleted successfully' : 'Invitation supprimée avec succès',
        variant: 'default'
      });

      // Close dialog and refresh list
      setDeleteDialogOpen(false);
      setInvitationToDelete(null);
      fetchInvitations();
    } catch (error) {
      console.error('Error deleting invitation:', error);
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: error instanceof Error 
          ? error.message 
          : (language === 'en' ? 'Failed to delete invitation' : 'Échec de la suppression de l\'invitation'),
        variant: 'destructive'
      });
    } finally {
      setDeleting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: language === 'en' ? 'Pending' : 'En attente', variant: 'secondary' as const, icon: Clock },
      sent: { label: language === 'en' ? 'Sent' : 'Envoyé', variant: 'default' as const, icon: CheckCircle },
      delivered: { label: language === 'en' ? 'Delivered' : 'Livré', variant: 'default' as const, icon: CheckCircle },
      failed: { label: language === 'en' ? 'Failed' : 'Échoué', variant: 'destructive' as const, icon: XCircle }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1 w-fit">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  // Get unique events for filter
  const uniqueEvents = Array.from(
    new Map(invitations.map(inv => inv.events?.id && [inv.events.id, inv.events])).values()
  ).filter(Boolean);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                {language === 'en' ? 'Official Invitations' : 'Invitations Officielles'}
              </CardTitle>
              <CardDescription>
                {language === 'en' 
                  ? `Total: ${totalCount} invitation${totalCount !== 1 ? 's' : ''} • ${totalQrCount} QR code${totalQrCount !== 1 ? 's' : ''} generated`
                  : `Total: ${totalCount} invitation${totalCount !== 1 ? 's' : ''} • ${totalQrCount} code${totalQrCount !== 1 ? 's' : ''} QR généré${totalQrCount !== 1 ? 's' : ''}`}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchInvitations}
              disabled={loading}
            >
              {loading ? <Loader size="sm" className="mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              {language === 'en' ? 'Refresh' : 'Actualiser'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={language === 'en' ? 'Search by name, phone, email, or invitation number...' : 'Rechercher par nom, téléphone, email ou numéro d\'invitation...'}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder={language === 'en' ? 'Status' : 'Statut'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{language === 'en' ? 'All Status' : 'Tous les statuts'}</SelectItem>
                <SelectItem value="pending">{language === 'en' ? 'Pending' : 'En attente'}</SelectItem>
                <SelectItem value="sent">{language === 'en' ? 'Sent' : 'Envoyé'}</SelectItem>
                <SelectItem value="delivered">{language === 'en' ? 'Delivered' : 'Livré'}</SelectItem>
                <SelectItem value="failed">{language === 'en' ? 'Failed' : 'Échoué'}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {loading && invitations.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader size="lg" className="[background:hsl(var(--muted-foreground))]" />
            </div>
          ) : invitations.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {language === 'en' ? 'No invitations found' : 'Aucune invitation trouvée'}
              </AlertDescription>
            </Alert>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">{language === 'en' ? 'Invitation #' : 'Invitation #'}</TableHead>
                      <TableHead className="w-[180px]">{language === 'en' ? 'Guest' : 'Invité'}</TableHead>
                      <TableHead className="w-[160px]">{language === 'en' ? 'Event' : 'Événement'}</TableHead>
                      <TableHead className="w-[100px]">{language === 'en' ? 'Pass Type' : 'Type de Pass'}</TableHead>
                      <TableHead className="w-[80px] text-center">{language === 'en' ? 'Codes' : 'Codes'}</TableHead>
                      <TableHead className="w-[100px]">{language === 'en' ? 'Status' : 'Statut'}</TableHead>
                      <TableHead className="w-[120px] hidden lg:table-cell">{language === 'en' ? 'Created' : 'Créé'}</TableHead>
                      <TableHead className="w-[120px] text-right">{language === 'en' ? 'Actions' : 'Actions'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitations.map((invitation) => (
                      <TableRow key={invitation.id}>
                        <TableCell className="font-mono font-medium">
                          {invitation.invitation_number}
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[160px]">
                            <div className="font-medium truncate">{invitation.recipient_name}</div>
                            <div className="text-xs text-muted-foreground truncate">{invitation.recipient_email}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {invitation.events ? (
                            <div className="max-w-[140px]">
                              <div className="font-medium truncate text-sm">{invitation.events.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(invitation.events.date), 'MMM dd, yyyy')}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs whitespace-nowrap">{invitation.pass_type}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary" className="text-xs">{invitation.quantity}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="scale-90 origin-left">{getStatusBadge(invitation.status)}</div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground hidden lg:table-cell">
                          {format(new Date(invitation.created_at), 'MMM dd, HH:mm')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDetails(invitation)}
                              title={language === 'en' ? 'View Details' : 'Voir les détails'}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleResendEmail(invitation.id)}
                              title={language === 'en' ? 'Resend Email' : 'Renvoyer l\'email'}
                            >
                              <Mail className="h-4 w-4" />
                            </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(invitation.id, invitation.invitation_number)}
                            className="text-destructive hover:text-destructive"
                            title={language === 'en' ? 'Delete' : 'Supprimer'}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
            </div>
          )}

          {/* Pagination */}
          {totalCount > limit && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                {language === 'en' 
                  ? `Showing ${offset + 1}-${Math.min(offset + limit, totalCount)} of ${totalCount}`
                  : `Affichage de ${offset + 1}-${Math.min(offset + limit, totalCount)} sur ${totalCount}`}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  disabled={offset === 0 || loading}
                >
                  {language === 'en' ? 'Previous' : 'Précédent'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOffset(offset + limit)}
                  disabled={offset + limit >= totalCount || loading}
                >
                  {language === 'en' ? 'Next' : 'Suivant'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {language === 'en' ? 'Invitation Details' : 'Détails de l\'Invitation'}
            </DialogTitle>
          </DialogHeader>
          {detailsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader size="lg" className="[background:hsl(var(--muted-foreground))]" />
            </div>
          ) : selectedInvitation ? (
            <div className="space-y-6">
              {/* Invitation Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    {language === 'en' ? 'Invitation Number' : 'Numéro d\'Invitation'}
                  </Label>
                  <p className="font-mono font-medium">{selectedInvitation.invitation_number}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    {language === 'en' ? 'Status' : 'Statut'}
                  </Label>
                  <div className="mt-1">{getStatusBadge(selectedInvitation.status)}</div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    {language === 'en' ? 'Guest Name' : 'Nom de l\'Invité'}
                  </Label>
                  <p>{selectedInvitation.recipient_name}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    {language === 'en' ? 'Phone' : 'Téléphone'}
                  </Label>
                  <p>{selectedInvitation.recipient_phone}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    {language === 'en' ? 'Email' : 'Email'}
                  </Label>
                  <p>{selectedInvitation.recipient_email}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    {language === 'en' ? 'Pass Type' : 'Type de Pass'}
                  </Label>
                  <Badge variant="outline">{selectedInvitation.pass_type}</Badge>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    {language === 'en' ? 'Quantity' : 'Quantité'}
                  </Label>
                  <p>{selectedInvitation.quantity}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    {language === 'en' ? 'Created' : 'Créé'}
                  </Label>
                  <p>{format(new Date(selectedInvitation.created_at), 'PPpp')}</p>
                </div>
              </div>

              {/* Event Info */}
              {selectedInvitation.events && (
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-3">{language === 'en' ? 'Event Information' : 'Informations sur l\'Événement'}</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">
                        {language === 'en' ? 'Event Name' : 'Nom de l\'Événement'}
                      </Label>
                      <p>{selectedInvitation.events.name}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">
                        {language === 'en' ? 'Date' : 'Date'}
                      </Label>
                      <p>{format(new Date(selectedInvitation.events.date), 'PPpp')}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">
                        {language === 'en' ? 'Venue' : 'Lieu'}
                      </Label>
                      <p>{selectedInvitation.events.venue}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">
                        {language === 'en' ? 'City' : 'Ville'}
                      </Label>
                      <p>{selectedInvitation.events.city}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Zone Info */}
              {selectedInvitation.zone_name && (
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-3">{language === 'en' ? 'Zone & Access Details' : 'Détails de la Zone et de l\'Accès'}</h4>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">
                      {language === 'en' ? 'Zone' : 'Zone'}
                    </Label>
                    <p className="font-medium">{selectedInvitation.zone_name}</p>
                    {selectedInvitation.zone_description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {selectedInvitation.zone_description}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* QR Codes */}
              {qrTickets.length > 0 && (
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-3">
                    {language === 'en' ? 'QR Codes' : 'Codes QR'} ({qrTickets.length})
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {qrTickets.map((qr, index) => (
                      <div key={qr.id} className="border rounded-lg p-4 text-center">
                        <img 
                          src={qr.qr_code_url} 
                          alt={`QR Code ${index + 1}`}
                          className="w-full max-w-[200px] mx-auto mb-2"
                        />
                        <p className="text-xs text-muted-foreground font-mono">
                          {qr.secure_token.substring(0, 8)}...
                        </p>
                        <Badge 
                          variant={qr.ticket_status === 'VALID' ? 'default' : 'destructive'}
                          className="mt-2"
                        >
                          {qr.ticket_status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="border-t pt-4 flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleResendEmail(selectedInvitation.id)}
                  className="flex-1"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  {language === 'en' ? 'Resend Email' : 'Renvoyer l\'Email'}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setDetailsOpen(false);
                    handleDeleteClick(selectedInvitation.id, selectedInvitation.invitation_number);
                  }}
                  className="flex-1"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {language === 'en' ? 'Delete' : 'Supprimer'}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              {language === 'en' ? 'Delete Invitation' : 'Supprimer l\'Invitation'}
            </AlertDialogTitle>
            <AlertDialogDescription className="pt-2">
              {language === 'en' 
                ? `Are you sure you want to delete invitation ${invitationToDelete?.number}? This action cannot be undone and will permanently delete the invitation and all associated QR codes.`
                : `Êtes-vous sûr de vouloir supprimer l'invitation ${invitationToDelete?.number}? Cette action est irréversible et supprimera définitivement l'invitation et tous les codes QR associés.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>
              {language === 'en' ? 'Cancel' : 'Annuler'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader size="sm" className="mr-2" />
                  {language === 'en' ? 'Deleting...' : 'Suppression...'}
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  {language === 'en' ? 'Delete' : 'Supprimer'}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
