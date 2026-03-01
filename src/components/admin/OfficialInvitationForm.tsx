import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { API_ROUTES, buildFullApiUrl } from '@/lib/api-routes';
import Loader from '@/components/ui/Loader';
import { Mail, User, Phone, Calendar, Ticket, Hash } from 'lucide-react';

interface Event {
  id: string;
  name: string;
  date: string;
  venue: string;
  city: string;
}

interface EventPass {
  id: string;
  name: string;
  price: number;
  description: string;
}

interface OfficialInvitationFormProps {
  onSuccess?: () => void;
  language?: 'en' | 'fr';
}

export const OfficialInvitationForm: React.FC<OfficialInvitationFormProps> = ({ 
  onSuccess,
  language = 'en'
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [loadingPasses, setLoadingPasses] = useState(false);
  
  // Form state
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [selectedPassTypeId, setSelectedPassTypeId] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('1');
  
  // Data
  const [events, setEvents] = useState<Event[]>([]);
  const [passes, setPasses] = useState<EventPass[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedPass, setSelectedPass] = useState<EventPass | null>(null);

  // Fetch upcoming events
  useEffect(() => {
    const fetchEvents = async () => {
      setLoadingEvents(true);
      try {
        const { data, error } = await supabase
          .from('events')
          .select('id, name, date, venue, city')
          .eq('event_type', 'upcoming')
          .gte('date', new Date().toISOString())
          .order('date', { ascending: true });

        if (error) throw error;
        setEvents(data || []);
      } catch (error) {
        console.error('Error fetching events:', error);
        toast({
          title: language === 'en' ? 'Error' : 'Erreur',
          description: language === 'en' 
            ? 'Failed to load events' 
            : 'Échec du chargement des événements',
          variant: 'destructive'
        });
      } finally {
        setLoadingEvents(false);
      }
    };

    fetchEvents();
  }, [toast, language]);

  // Fetch passes when event is selected
  useEffect(() => {
    if (!selectedEventId) {
      setPasses([]);
      setSelectedPassTypeId('');
      setSelectedPass(null);
      return;
    }

    const fetchPasses = async () => {
      setLoadingPasses(true);
      try {
        const { data, error } = await supabase
          .from('event_passes')
          .select('id, name, price, description')
          .eq('event_id', selectedEventId)
          .order('name', { ascending: true });

        if (error) throw error;
        setPasses(data || []);
        
        // Reset pass selection
        setSelectedPassTypeId('');
        setSelectedPass(null);
      } catch (error) {
        console.error('Error fetching passes:', error);
        toast({
          title: language === 'en' ? 'Error' : 'Erreur',
          description: language === 'en' 
            ? 'Failed to load pass types' 
            : 'Échec du chargement des types de passes',
          variant: 'destructive'
        });
      } finally {
        setLoadingPasses(false);
      }
    };

    fetchPasses();
  }, [selectedEventId, toast, language]);

  // Update selected event when eventId changes
  useEffect(() => {
    if (selectedEventId) {
      const event = events.find(e => e.id === selectedEventId);
      setSelectedEvent(event || null);
    } else {
      setSelectedEvent(null);
    }
  }, [selectedEventId, events]);

  // Update selected pass when passTypeId changes
  useEffect(() => {
    if (selectedPassTypeId) {
      const pass = passes.find(p => p.id === selectedPassTypeId);
      setSelectedPass(pass || null);
    } else {
      setSelectedPass(null);
    }
  }, [selectedPassTypeId, passes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!guestName.trim()) {
      toast({
        title: language === 'en' ? 'Validation Error' : 'Erreur de validation',
        description: language === 'en' ? 'Guest name is required' : 'Le nom de l\'invité est requis',
        variant: 'destructive'
      });
      return;
    }

    if (!guestPhone.trim()) {
      toast({
        title: language === 'en' ? 'Validation Error' : 'Erreur de validation',
        description: language === 'en' ? 'Guest phone is required' : 'Le téléphone de l\'invité est requis',
        variant: 'destructive'
      });
      return;
    }

    if (!guestEmail.trim()) {
      toast({
        title: language === 'en' ? 'Validation Error' : 'Erreur de validation',
        description: language === 'en' ? 'Guest email is required' : 'L\'email de l\'invité est requis',
        variant: 'destructive'
      });
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(guestEmail)) {
      toast({
        title: language === 'en' ? 'Validation Error' : 'Erreur de validation',
        description: language === 'en' ? 'Invalid email address' : 'Adresse email invalide',
        variant: 'destructive'
      });
      return;
    }

    if (!selectedEventId) {
      toast({
        title: language === 'en' ? 'Validation Error' : 'Erreur de validation',
        description: language === 'en' ? 'Please select an event' : 'Veuillez sélectionner un événement',
        variant: 'destructive'
      });
      return;
    }

    if (!selectedPassTypeId) {
      toast({
        title: language === 'en' ? 'Validation Error' : 'Erreur de validation',
        description: language === 'en' ? 'Please select a pass type' : 'Veuillez sélectionner un type de pass',
        variant: 'destructive'
      });
      return;
    }

    const quantityNum = parseInt(quantity, 10);
    if (isNaN(quantityNum) || quantityNum < 1 || quantityNum > 100) {
      toast({
        title: language === 'en' ? 'Validation Error' : 'Erreur de validation',
        description: language === 'en' ? 'Quantity must be between 1 and 100' : 'La quantité doit être entre 1 et 100',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const apiUrl = buildFullApiUrl(API_ROUTES.CREATE_OFFICIAL_INVITATION);
      if (!apiUrl) {
        throw new Error('Failed to build API URL');
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          guest_name: guestName.trim(),
          guest_phone: guestPhone.trim(),
          guest_email: guestEmail.trim().toLowerCase(),
          event_id: selectedEventId,
          pass_type_id: selectedPassTypeId,
          quantity: quantityNum
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.details || 'Failed to create invitation');
      }

      if (!result.success) {
        throw new Error(result.error || 'Failed to create invitation');
      }

      toast({
        title: language === 'en' ? 'Success' : 'Succès',
        description: language === 'en' 
          ? `Invitation created successfully! Invitation number: ${result.invitation?.invitation_number || 'N/A'}`
          : `Invitation créée avec succès! Numéro d'invitation: ${result.invitation?.invitation_number || 'N/A'}`,
        variant: 'default'
      });

      // Reset form
      setGuestName('');
      setGuestPhone('');
      setGuestEmail('');
      setSelectedEventId('');
      setSelectedPassTypeId('');
      setQuantity('1');

      // Call success callback
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error creating invitation:', error);
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: error instanceof Error 
          ? error.message 
          : (language === 'en' ? 'Failed to create invitation' : 'Échec de la création de l\'invitation'),
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          {language === 'en' ? 'Create Official Invitation' : 'Créer une Invitation Officielle'}
        </CardTitle>
        <CardDescription>
          {language === 'en' 
            ? 'Create and send official invitations with QR codes to guests'
            : 'Créer et envoyer des invitations officielles avec codes QR aux invités'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Guest Name */}
          <div className="space-y-2">
            <Label htmlFor="guest-name" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              {language === 'en' ? 'Guest Name' : 'Nom de l\'invité'} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="guest-name"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder={language === 'en' ? 'Enter guest name' : 'Entrez le nom de l\'invité'}
              required
              disabled={loading}
            />
          </div>

          {/* Guest Phone */}
          <div className="space-y-2">
            <Label htmlFor="guest-phone" className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              {language === 'en' ? 'Guest Phone' : 'Téléphone de l\'invité'} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="guest-phone"
              type="tel"
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              placeholder={language === 'en' ? '+216 12 345 678' : '+216 12 345 678'}
              required
              disabled={loading}
            />
          </div>

          {/* Guest Email */}
          <div className="space-y-2">
            <Label htmlFor="guest-email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              {language === 'en' ? 'Guest Email' : 'Email de l\'invité'} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="guest-email"
              type="email"
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              placeholder={language === 'en' ? 'guest@example.com' : 'invite@exemple.com'}
              required
              disabled={loading}
            />
          </div>

          {/* Event Selection */}
          <div className="space-y-2">
            <Label htmlFor="event" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {language === 'en' ? 'Event' : 'Événement'} <span className="text-red-500">*</span>
            </Label>
            <Select
              value={selectedEventId}
              onValueChange={setSelectedEventId}
              disabled={loading || loadingEvents}
            >
              <SelectTrigger id="event">
                <SelectValue placeholder={language === 'en' ? 'Select an event' : 'Sélectionnez un événement'} />
              </SelectTrigger>
              <SelectContent>
                {loadingEvents ? (
                  <SelectItem value="loading" disabled>
                    {language === 'en' ? 'Loading events...' : 'Chargement des événements...'}
                  </SelectItem>
                ) : events.length === 0 ? (
                  <SelectItem value="no-events" disabled>
                    {language === 'en' ? 'No upcoming events' : 'Aucun événement à venir'}
                  </SelectItem>
                ) : (
                  events.map((event) => (
                    <SelectItem key={event.id} value={event.id}>
                      {event.name} - {new Date(event.date).toLocaleDateString()}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {selectedEvent && (
              <p className="text-sm text-muted-foreground">
                {selectedEvent.venue}, {selectedEvent.city}
              </p>
            )}
          </div>

          {/* Pass Type Selection */}
          {selectedEventId && (
            <div className="space-y-2">
              <Label htmlFor="pass-type" className="flex items-center gap-2">
                <Ticket className="h-4 w-4" />
                {language === 'en' ? 'Pass Type' : 'Type de Pass'} <span className="text-red-500">*</span>
              </Label>
              <Select
                value={selectedPassTypeId}
                onValueChange={setSelectedPassTypeId}
                disabled={loading || loadingPasses}
              >
                <SelectTrigger id="pass-type">
                  <SelectValue placeholder={language === 'en' ? 'Select a pass type' : 'Sélectionnez un type de pass'} />
                </SelectTrigger>
                <SelectContent>
                  {loadingPasses ? (
                    <SelectItem value="loading" disabled>
                      {language === 'en' ? 'Loading pass types...' : 'Chargement des types de passes...'}
                    </SelectItem>
                  ) : passes.length === 0 ? (
                    <SelectItem value="no-passes" disabled>
                      {language === 'en' ? 'No pass types available' : 'Aucun type de pass disponible'}
                    </SelectItem>
                  ) : (
                    passes.map((pass) => (
                      <SelectItem key={pass.id} value={pass.id}>
                        {pass.name} - {pass.price.toFixed(2)} TND
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {selectedPass && (
                <p className="text-sm text-muted-foreground">
                  {selectedPass.description}
                </p>
              )}
            </div>
          )}

          {/* Quantity */}
          <div className="space-y-2">
            <Label htmlFor="quantity" className="flex items-center gap-2">
              <Hash className="h-4 w-4" />
              {language === 'en' ? 'Number of QR Codes' : 'Nombre de Codes QR'} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              max="100"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="1"
              required
              disabled={loading}
            />
            <p className="text-sm text-muted-foreground">
              {language === 'en' 
                ? 'Each QR code is valid for one person. Multiple QR codes will be generated and sent in the email.'
                : 'Chaque code QR est valide pour une personne. Plusieurs codes QR seront générés et envoyés par email.'}
            </p>
          </div>

          {/* Submit Button */}
          <Button 
            type="submit" 
            className="w-full" 
            disabled={loading || loadingEvents || loadingPasses}
          >
            {loading ? (
              <>
                <Loader size="sm" className="mr-2" />
                {language === 'en' ? 'Creating...' : 'Création...'}
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                {language === 'en' ? 'Create & Send Invitation' : 'Créer & Envoyer l\'Invitation'}
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
