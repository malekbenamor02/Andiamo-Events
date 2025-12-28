import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { logFormSubmission, logger } from "@/lib/logger";
import { Link } from "react-router-dom";
import { API_ROUTES } from '@/lib/api-routes';
import { safeApiCall } from '@/lib/api-client';
import { User, Star, Users, Sparkles, Zap, Heart, Mail, Phone, MapPin, Instagram, FileText, Calendar, Award, Target, Gift, Crown, TrendingUp, XCircle } from "lucide-react";
// @ts-ignore
import DOMPurify from 'dompurify';
import LoadingScreen from '@/components/ui/LoadingScreen';
import { CITIES, SOUSSE_VILLES } from '@/lib/constants';

interface ApplicationProps {
  language: 'en' | 'fr';
}

const Application = ({ language }: ApplicationProps) => {
  const [formData, setFormData] = useState({
    fullName: '',
    age: '',
    phoneNumber: '',
    email: '',
    city: '',
    ville: '',
    socialLink: '',
    motivation: ''
  });
  
  const isSousse = formData.city === 'Sousse';
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [animatedSections, setAnimatedSections] = useState<Set<string>>(new Set());
  const [applicationEnabled, setApplicationEnabled] = useState<boolean | null>(null);
  const [applicationMessage, setApplicationMessage] = useState<string>("");
  const [loadingApplicationStatus, setLoadingApplicationStatus] = useState(true);
  
  const heroRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const sectionId = entry.target.getAttribute('data-section');
            if (sectionId) {
              setAnimatedSections(prev => new Set([...prev, sectionId]));
            }
          }
        });
      },
      { 
        threshold: 0.3,
        rootMargin: '0px 0px -50px 0px'
      }
    );

    const sections = [
      { ref: heroRef, id: 'hero' },
      { ref: formRef, id: 'form' }
    ];

    sections.forEach(({ ref, id }) => {
      if (ref.current) {
        ref.current.setAttribute('data-section', id);
        observer.observe(ref.current);
      }
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const checkApplicationStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('site_content')
          .select('content')
          .eq('key', 'ambassador_application_settings')
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            setApplicationEnabled(true);
            setApplicationMessage("");
            setLoadingApplicationStatus(false);
            return;
          }
          setApplicationEnabled(true);
          setApplicationMessage("");
          setLoadingApplicationStatus(false);
          return;
        }

        if (data && data.content) {
          const settings = data.content as { enabled?: boolean; message?: string };
          const isEnabled = settings.enabled !== false;
          setApplicationEnabled(isEnabled);
          setApplicationMessage(
            settings.message || 
            (language === 'en' 
              ? 'Ambassador applications are currently closed. Please check back later.' 
              : 'Les candidatures d\'ambassadeur sont actuellement fermées. Veuillez réessayer plus tard.')
          );
        } else {
          setApplicationEnabled(true);
          setApplicationMessage("");
        }
      } catch (error) {
        logger.error('Error checking application status', error, {
          category: 'database',
          details: { language }
        });
        setApplicationEnabled(true);
        setApplicationMessage("");
      } finally {
        setLoadingApplicationStatus(false);
      }
    };

    checkApplicationStatus();

    const channel = supabase
      .channel('ambassador-application-settings-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'site_content',
          filter: 'key=eq.ambassador_application_settings'
        },
        () => {
          checkApplicationStatus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [language]);

  const t = {
    en: {
      heroTitle: "Become an Ambassador",
      heroSubtitle: "Get exclusive perks, earn commissions, and be part of Tunisia's top nightlife community!",
      benefits: [
        "Exclusive access to events",
        "Earn commission on every ticket sold",
        "Andiamo merchandise & rewards",
        "VIP networking opportunities",
        "Be the first to know about new events"
      ],
      formTitle: "Ambassador Application",
      fullName: "Full Name",
      age: "Age",
      phone: "Phone Number",
      email: "Email",
      city: "City",
      socialLink: "Instagram Link",
      motivation: "Why do you want to be an ambassador?",
      submit: "Submit Application",
      submitting: "Submitting...",
      success: "Application submitted! We will review and contact you soon.",
      login: "Already approved? Login here"
    },
    fr: {
      heroTitle: "Devenez Ambassadeur",
      heroSubtitle: "Profitez d'avantages exclusifs, gagnez des commissions et faites partie de la meilleure communauté nightlife de Tunisie !",
      benefits: [
        "Accès exclusif aux événements",
        "Gagnez une commission sur chaque billet vendu",
        "Goodies & récompenses Andiamo",
        "Opportunités de networking VIP",
        "Soyez le premier informé des nouveaux événements"
      ],
      formTitle: "Candidature Ambassadeur",
      fullName: "Nom Complet",
      age: "Âge",
      phone: "Numéro de Téléphone",
      email: "Email",
      city: "Ville",
      socialLink: "Lien Instagram",
      motivation: "Pourquoi voulez-vous être ambassadeur?",
      submit: "Soumettre la Candidature",
      submitting: "Soumission...",
      success: "Candidature soumise! Nous vous contacterons bientôt.",
      login: "Déjà approuvé ? Connectez-vous ici"
    }
  }[language];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      // Validate phone number format
      const phoneRegex = /^[2594][0-9]{7}$/;
      if (!phoneRegex.test(formData.phoneNumber)) {
        toast({
          title: language === 'en' ? 'Invalid Phone Number' : 'Numéro de Téléphone Invalide',
          description: language === 'en' 
            ? 'Phone number must be 8 digits starting with 2, 5, 9, or 4.' 
            : 'Le numéro de téléphone doit être 8 chiffres commençant par 2, 5, 9, ou 4.',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      // Validate city is selected
      if (!formData.city || !CITIES.includes(formData.city as any)) {
        toast({
          title: language === 'en' ? 'City Required' : 'Ville Requise',
          description: language === 'en' 
            ? 'Please select a city from the list.' 
            : 'Veuillez sélectionner une ville dans la liste.',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      // Validate ville is required for Sousse
      if (formData.city === 'Sousse' && (!formData.ville || !SOUSSE_VILLES.includes(formData.ville as any))) {
        toast({
          title: language === 'en' ? 'Ville Required' : 'Quartier Requis',
          description: language === 'en' 
            ? 'Please select a ville (neighborhood) for Sousse.' 
            : 'Veuillez sélectionner un quartier pour Sousse.',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      // Validate Instagram link starts with Instagram URL
      if (formData.socialLink && !formData.socialLink.trim().startsWith('https://www.instagram.com/') && !formData.socialLink.trim().startsWith('https://instagram.com/')) {
        toast({
          title: language === 'en' ? 'Invalid Instagram Link' : 'Lien Instagram Invalide',
          description: language === 'en' 
            ? 'Instagram link must start with https://www.instagram.com/ or https://instagram.com/' 
            : 'Le lien Instagram doit commencer par https://www.instagram.com/ ou https://instagram.com/',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      // Sanitize all inputs
      const sanitizedFullName = DOMPurify.sanitize(formData.fullName);
      const sanitizedEmail = DOMPurify.sanitize(formData.email);
      const sanitizedCity = DOMPurify.sanitize(formData.city);
      const sanitizedSocialLink = DOMPurify.sanitize(formData.socialLink);
      const sanitizedMotivation = DOMPurify.sanitize(formData.motivation);

      // Submit application via API endpoint (includes all validation and checks)
      const data = await safeApiCall(API_ROUTES.AMBASSADOR_APPLICATION, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: sanitizedFullName,
          age: formData.age,
          phoneNumber: formData.phoneNumber,
          email: sanitizedEmail,
          city: sanitizedCity,
          ville: formData.city === 'Sousse' ? DOMPurify.sanitize(formData.ville) : null,
          socialLink: sanitizedSocialLink,
          motivation: sanitizedMotivation || null,
        })
      });

      if (data.success) {
        logFormSubmission('Ambassador Application', true, {
          fullName: sanitizedFullName,
          phone: formData.phoneNumber,
          email: sanitizedEmail,
          city: sanitizedCity
        }, 'guest');
        logger.action('Ambassador application submitted', {
          category: 'form_submission',
          details: { phoneNumber: formData.phoneNumber, city: sanitizedCity }
        });

        setSubmitted(true);
        toast({ 
          title: language === 'en' ? 'Success!' : 'Succès!', 
          description: language === 'en' 
            ? 'Your application has been submitted successfully.' 
            : 'Votre candidature a été soumise avec succès.'
        });
      }
    } catch (error: any) {
      logFormSubmission('Ambassador Application', false, {
        phone: formData.phoneNumber,
        error: error instanceof Error ? error.message : String(error)
      }, 'guest');
      logger.error('Ambassador application submission failed', error, {
        category: 'form_submission',
        details: { formName: 'Ambassador Application', phoneNumber: formData.phoneNumber }
      });

      const errorMessage = error.message || (language === 'en' ? 'An error occurred' : 'Une erreur s\'est produite');
      toast({ 
        title: language === 'en' ? 'Error' : 'Erreur', 
        description: errorMessage, 
        variant: 'destructive' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingApplicationStatus || applicationEnabled === null) {
    return (
      <LoadingScreen 
        variant="default" 
        size="fullscreen" 
        text={language === 'en' ? 'Loading...' : 'Chargement...'}
      />
    );
  }

  if (applicationEnabled === false) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        </div>

        <div className="max-w-3xl w-full relative z-10">
          <div className="backdrop-blur-sm bg-card/40 border border-border/50 rounded-3xl p-8 md:p-12 shadow-2xl">
            <div className="text-center space-y-8">
              <div className="flex justify-center">
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-ping" style={{ animationDuration: '3s' }}></div>
                  <div className="relative bg-gradient-to-br from-primary via-primary/80 to-primary/60 p-6 md:p-8 rounded-2xl shadow-2xl">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/50 to-primary/50 rounded-2xl blur-sm"></div>
                    <XCircle className="w-12 h-12 md:w-16 md:h-16 text-white relative z-10" />
                  </div>
                </div>
              </div>
              
              <div className="space-y-6 pt-4">
                <div className="space-y-3">
                  <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
                    {language === 'en' ? 'Applications Closed' : 'Candidatures Fermées'}
                  </h1>
                  <div className="h-1 w-24 bg-gradient-to-r from-primary to-primary/80 mx-auto rounded-full"></div>
                </div>
                
                <p className="text-lg md:text-xl lg:text-2xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
                  {applicationMessage}
                </p>
              </div>

              <div className="pt-8">
                <Link to="/ambassador/auth">
                  <Button variant="outline" className="px-6 py-3">
                    {t.login}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-dark flex flex-col items-center justify-start p-0 md:p-8 relative overflow-hidden animate-page-intro">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-float delay-1000" />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-primary/5 rounded-full blur-3xl animate-float delay-2000" />
        
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)`,
          backgroundSize: '40px 40px',
        }} />
        
        <div className="absolute top-20 left-10 animate-pulse">
          <Star className="w-6 h-6 text-yellow-300/20" />
        </div>
        <div className="absolute top-40 right-20 animate-pulse delay-1000">
          <Star className="w-4 h-4 text-primary/20" />
        </div>
        <div className="absolute top-60 left-1/4 animate-pulse delay-2000">
          <Star className="w-5 h-5 text-primary/20" />
        </div>
        <div className="absolute top-80 right-1/3 animate-pulse delay-1500">
          <Star className="w-3 h-3 text-pink-300/20" />
        </div>
        
        <div className="absolute top-32 left-1/3 animate-bounce delay-500">
          <Sparkles className="w-4 h-4 text-primary/30" />
        </div>
        <div className="absolute top-48 right-1/4 animate-bounce delay-1000">
          <Sparkles className="w-3 h-3 text-primary/20" />
        </div>
      </div>

      <div 
        ref={heroRef}
        className="w-full max-w-4xl mx-auto text-center py-16 px-4 md:px-0 transform transition-all duration-1000 ease-out relative z-10"
      >
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl animate-pulse" />
            <Sparkles className="w-16 h-16 text-primary animate-pulse relative z-10" />
            <div className="absolute -top-2 -right-2 z-20">
              <Star className="w-5 h-5 text-yellow-300 animate-spin" />
            </div>
            <div className="absolute -bottom-2 -left-2 z-20">
              <Heart className="w-4 h-4 text-red-400 animate-pulse" />
            </div>
          </div>
          <h1 className="text-5xl md:text-6xl font-heading font-bold mb-3 animate-pulse-glow" style={{ color: '#E21836' }}>
            {t.heroTitle}
          </h1>
          <p className="text-xl md:text-2xl max-w-3xl mx-auto leading-relaxed" style={{ color: '#B0B0B0' }}>
            {t.heroSubtitle}
          </p>
          
          <div className="flex gap-3 mt-6">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-6 h-6 text-yellow-300 animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />
            ))}
          </div>
        </div>
      </div>
      
      <div 
        ref={formRef}
        className="w-full max-w-4xl mx-auto mb-12 transform transition-all duration-1000 ease-out relative z-10"
      >
        <Card 
          className="shadow-2xl overflow-hidden"
          style={{
            backgroundColor: '#1F1F1F',
            borderColor: '#2A2A2A'
          }}
        >
              <div 
                className="relative p-6 border-b"
                style={{
                  backgroundColor: '#1F1F1F',
                  borderColor: '#2A2A2A'
                }}
              >
                <CardHeader className="text-center pb-0 relative z-10">
                  <CardTitle className="text-3xl font-heading font-bold" style={{ color: '#E21836' }}>
                    {t.formTitle}
                  </CardTitle>
                </CardHeader>
              </div>
              <CardContent className="p-8">
              {submitted ? (
                <div className="text-center space-y-4">
                  <div className="flex justify-center mb-4">
                    <div className="relative">
                      <Heart className="w-12 h-12 animate-pulse" style={{ color: '#E21836' }} />
                      <div className="absolute -top-1 -right-1">
                        <Star className="w-4 h-4 animate-spin" style={{ color: '#E21836' }} />
                      </div>
                    </div>
                  </div>
                  <p className="font-semibold" style={{ color: '#E21836' }}>{t.success}</p>
                  <Button 
                    asChild 
                    variant="outline" 
                    className="w-full"
                    style={{
                      backgroundColor: '#1F1F1F',
                      borderColor: '#2A2A2A',
                      color: '#FFFFFF'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#E21836';
                      e.currentTarget.style.color = '#E21836';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#2A2A2A';
                      e.currentTarget.style.color = '#FFFFFF';
                    }}
                  >
                    <Link to="/ambassador/auth">{t.login}</Link>
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <p className="text-sm mb-4" style={{ color: '#B0B0B0' }}>
                    {language === 'en' ? 'Fields marked * are required' : 'Les champs marqués * sont obligatoires'}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="fullName" className="text-sm font-medium" style={{ color: '#FFFFFF' }}>
                        {t.fullName} <span style={{ color: '#B0B0B0' }}>*</span>
                      </Label>
                      <Input 
                        id="fullName" 
                        value={formData.fullName} 
                        onChange={e => setFormData({ ...formData, fullName: e.target.value })} 
                        required 
                        className="h-12"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="age" className="text-sm font-medium">
                        {t.age} <span className="text-muted-foreground opacity-60">*</span>
                      </Label>
                      <Input 
                        id="age" 
                        type="number" 
                        min="16" 
                        max="99" 
                        value={formData.age} 
                        onChange={e => setFormData({ ...formData, age: e.target.value })} 
                        required 
                        className="h-12"
                      />
                    </div>
                    
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="city" className="text-sm font-medium">
                        {t.city} <span className="text-muted-foreground opacity-60">*</span>
                      </Label>
                      <Select 
                        value={formData.city} 
                        onValueChange={(value) => {
                          setFormData({ ...formData, city: value, ville: value === 'Sousse' ? formData.ville : '' });
                        }}
                        required
                      >
                        <SelectTrigger 
                          className="h-12 w-full"
                          style={{
                            backgroundColor: '#252525',
                            borderColor: '#2A2A2A',
                            color: '#FFFFFF'
                          }}
                        >
                          <SelectValue placeholder={language === 'en' ? 'Select a city' : 'Sélectionner une ville'} />
                        </SelectTrigger>
                        <SelectContent 
                          className="z-[9999]" 
                          position="popper"
                          style={{ backgroundColor: '#1F1F1F', borderColor: '#2A2A2A' }}
                        >
                          {CITIES.map((city) => (
                            <SelectItem 
                              key={city} 
                              value={city}
                              className="focus:bg-[#E21836]/20 focus:text-[#E21836] data-[highlighted]:bg-[#E21836]/20 data-[highlighted]:text-[#E21836]"
                              style={{ color: '#B0B0B0' }}
                            >
                              {city}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {isSousse && (
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="ville" className="text-sm font-medium">
                          {language === 'en' ? 'Ville (Neighborhood)' : 'Quartier'} <span className="text-muted-foreground opacity-60">*</span>
                        </Label>
                        <Select 
                          value={formData.ville} 
                          onValueChange={(value) => setFormData({ ...formData, ville: value })}
                          required
                        >
                          <SelectTrigger 
                            className="h-12 w-full"
                            style={{
                              backgroundColor: '#252525',
                              borderColor: '#2A2A2A',
                              color: '#FFFFFF'
                            }}
                          >
                            <SelectValue placeholder={language === 'en' ? 'Select a neighborhood' : 'Sélectionner un quartier'} />
                          </SelectTrigger>
                          <SelectContent 
                            className="z-[9999]" 
                            position="popper"
                            style={{ backgroundColor: '#1F1F1F', borderColor: '#2A2A2A' }}
                          >
                            {SOUSSE_VILLES.map((ville) => (
                              <SelectItem 
                                key={ville} 
                                value={ville}
                                className="focus:bg-[#E21836]/20 focus:text-[#E21836] data-[highlighted]:bg-[#E21836]/20 data-[highlighted]:text-[#E21836]"
                                style={{ color: '#B0B0B0' }}
                              >
                                {ville}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-sm font-medium">
                        {t.phone} <span className="text-muted-foreground opacity-60">*</span>
                      </Label>
                      <Input 
                        id="phone" 
                        type="tel" 
                        value={formData.phoneNumber} 
                        onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })} 
                        required 
                        className="h-12"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-medium">
                        {t.email} <span className="text-muted-foreground opacity-60">*</span>
                      </Label>
                      <Input 
                        id="email" 
                        type="email" 
                        value={formData.email} 
                        onChange={e => setFormData({ ...formData, email: e.target.value })} 
                        required 
                        className="h-12"
                      />
                    </div>
                    
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="socialLink" className="text-sm font-medium">
                        {t.socialLink} <span className="text-muted-foreground opacity-60">*</span>
                      </Label>
                      <Input 
                        id="socialLink" 
                        type="url" 
                        value={formData.socialLink} 
                        onChange={e => setFormData({ ...formData, socialLink: e.target.value })} 
                        required 
                        placeholder="https://www.instagram.com/username"
                        className="h-12"
                      />
                      <p className="text-xs" style={{ color: '#B0B0B0' }}>
                        {language === 'en' 
                          ? 'Must start with https://www.instagram.com/ or https://instagram.com/' 
                          : 'Doit commencer par https://www.instagram.com/ ou https://instagram.com/'}
                      </p>
                    </div>
                    
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="motivation" className="text-sm font-medium">
                        {t.motivation}
                      </Label>
                      <Textarea 
                        id="motivation" 
                        value={formData.motivation} 
                        onChange={e => setFormData({ ...formData, motivation: e.target.value })} 
                        className="min-h-[140px] resize-y"
                        placeholder={language === 'en' ? 'Optional: Tell us why you want to be an ambassador' : 'Optionnel : Dites-nous pourquoi vous voulez être ambassadeur'}
                      />
                    </div>
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full btn-gradient h-14 text-lg font-medium" 
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="h-5 w-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-2" />
                        {t.submitting}
                      </>
                    ) : (
                      t.submit
                    )}
                  </Button>
                  
                  <div className="text-center pt-2">
                    <Button 
                      asChild 
                      variant="outline" 
                      className="w-full hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
                      style={{
                        backgroundColor: '#1F1F1F',
                        borderColor: '#2A2A2A',
                        color: '#FFFFFF'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#E21836';
                        e.currentTarget.style.color = '#E21836';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#2A2A2A';
                        e.currentTarget.style.color = '#FFFFFF';
                      }}
                    >
                      <Link to="/ambassador/auth">{t.login}</Link>
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Application;







