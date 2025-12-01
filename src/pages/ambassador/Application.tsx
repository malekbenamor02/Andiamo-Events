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
  const benefitsRef = useRef<HTMLDivElement>(null);

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
      { ref: formRef, id: 'form' },
      { ref: benefitsRef, id: 'benefits' }
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
      heroTitle: "Become an Andiamo Ambassador",
      heroSubtitle: "Join the movement. Get exclusive perks, earn commissions, and be part of Tunisia's top nightlife community!",
      benefits: [
        "Exclusive access to events",
        "Earn commission on every ticket sold",
        "Andiamo merchandise & rewards",
        "VIP networking opportunities",
        "Be the first to know about new events"
      ],
      formTitle: "Application Form",
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
      heroTitle: "Devenez Ambassadeur Andiamo",
      heroSubtitle: "Rejoignez le mouvement. Profitez d'avantages exclusifs, gagnez des commissions et faites partie de la meilleure communauté nightlife de Tunisie !",
      benefits: [
        "Accès exclusif aux événements",
        "Gagnez une commission sur chaque billet vendu",
        "Goodies & récompenses Andiamo",
        "Opportunités de networking VIP",
        "Soyez le premier informé des nouveaux événements"
      ],
      formTitle: "Formulaire de Candidature",
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

      // Check for duplicate phone number in active ambassadors (approved ambassadors)
      const { data: existingAmbByPhone } = await supabase
        .from('ambassadors')
        .select('id')
        .eq('phone', formData.phoneNumber)
        .maybeSingle();
      
      if (existingAmbByPhone) {
        toast({
          title: language === 'en' ? 'Already Applied' : 'Déjà Candidaté', 
          description: language === 'en'
            ? 'This phone number is already registered as an approved ambassador.' 
            : 'Ce numéro de téléphone est déjà enregistré comme ambassadeur approuvé.', 
          variant: 'destructive' 
        });
        setIsSubmitting(false);
        return;
      }

      // Check for duplicate email in active ambassadors (if email provided)
      if (sanitizedEmail && sanitizedEmail.trim() !== '') {
        const { data: existingAmbByEmail } = await supabase
          .from('ambassadors')
          .select('id')
          .eq('email', sanitizedEmail)
          .maybeSingle();
        
        if (existingAmbByEmail) {
          toast({
            title: language === 'en' ? 'Already Applied' : 'Déjà Candidaté', 
            description: language === 'en'
              ? 'This email is already registered as an approved ambassador.' 
              : 'Cet email est déjà enregistré comme ambassadeur approuvé.', 
            variant: 'destructive' 
          });
          setIsSubmitting(false);
          return;
        }
      }
      
      // Check for duplicate phone number in applications (pending or approved)
      const { data: existingAppByPhone } = await supabase
        .from('ambassador_applications')
        .select('id, status')
        .eq('phone_number', formData.phoneNumber)
        .in('status', ['pending', 'approved'])
        .maybeSingle();

      if (existingAppByPhone) {
        // If approved, check if there's still an active ambassador
        if (existingAppByPhone.status === 'approved') {
          const { data: activeAmbassador } = await supabase
            .from('ambassadors')
            .select('id')
            .eq('phone', formData.phoneNumber)
            .maybeSingle();
          
          if (activeAmbassador) {
            toast({
              title: language === 'en' ? 'Already Applied' : 'Déjà Candidaté', 
              description: language === 'en'
                ? 'An application with this phone number has already been approved and an active ambassador account exists.' 
                : 'Une candidature avec ce numéro de téléphone a déjà été approuvée et un compte ambassadeur actif existe.', 
              variant: 'destructive' 
            });
            setIsSubmitting(false);
            return;
          }
        } else {
          // Application is pending
          toast({
            title: language === 'en' ? 'Already Applied' : 'Déjà Candidaté', 
            description: language === 'en'
              ? 'You have already submitted an application. Please wait for review.'
              : 'Vous avez déjà soumis une candidature. Veuillez attendre l\'examen.', 
            variant: 'destructive' 
          });
          setIsSubmitting(false);
          return;
        }
      }

      // Check for duplicate email in applications (if email provided)
      if (sanitizedEmail && sanitizedEmail.trim() !== '') {
        const { data: existingAppByEmail } = await supabase
          .from('ambassador_applications')
          .select('id, status')
          .eq('email', sanitizedEmail)
          .in('status', ['pending', 'approved'])
          .maybeSingle();

        if (existingAppByEmail) {
          if (existingAppByEmail.status === 'approved') {
            const { data: activeAmbassador } = await supabase
              .from('ambassadors')
              .select('id')
              .eq('email', sanitizedEmail)
              .maybeSingle();
            
            if (activeAmbassador) {
              toast({
                title: language === 'en' ? 'Already Applied' : 'Déjà Candidaté', 
                description: language === 'en'
                  ? 'An application with this email has already been approved and an active ambassador account exists.' 
                  : 'Une candidature avec cet email a déjà été approuvée et un compte ambassadeur actif existe.', 
                variant: 'destructive' 
              });
              setIsSubmitting(false);
              return;
            }
          } else {
            // Application is pending
            toast({
              title: language === 'en' ? 'Already Applied' : 'Déjà Candidaté', 
              description: language === 'en'
                ? 'An application with this email already exists and is pending review. Please wait for the review to complete.'
                : 'Une candidature avec cet email existe déjà et est en attente d\'examen. Veuillez attendre la fin de l\'examen.', 
              variant: 'destructive' 
            });
            setIsSubmitting(false);
            return;
          }
        }
      }

      // Check for rejected or removed applications and verify reapply delay (30 days)
      const REAPPLY_DELAY_DAYS = 30;
      const now = new Date();
      const delayDate = new Date(now.getTime() - (REAPPLY_DELAY_DAYS * 24 * 60 * 60 * 1000));

      // Check by phone
      const { data: rejectedAppByPhone } = await supabase
        .from('ambassador_applications')
        .select('id, status, reapply_delay_date')
        .eq('phone_number', formData.phoneNumber)
        .in('status', ['rejected', 'removed'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (rejectedAppByPhone) {
        const canReapply = !rejectedAppByPhone.reapply_delay_date || 
          new Date(rejectedAppByPhone.reapply_delay_date) <= now;
        
        if (!canReapply) {
          const delayUntil = new Date(rejectedAppByPhone.reapply_delay_date);
          const daysRemaining = Math.ceil((delayUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          toast({
            title: language === 'en' ? 'Cannot Reapply Yet' : 'Ne Peut Pas Re-candidater Encore', 
            description: language === 'en'
              ? `You can reapply in ${daysRemaining} day(s). Please wait until ${delayUntil.toLocaleDateString()}.`
              : `Vous pouvez re-candidater dans ${daysRemaining} jour(s). Veuillez attendre jusqu'au ${delayUntil.toLocaleDateString()}.`, 
            variant: 'destructive' 
          });
          setIsSubmitting(false);
          return;
        }
      }

      // Check by email
      if (sanitizedEmail && sanitizedEmail.trim() !== '') {
        const { data: rejectedAppByEmail } = await supabase
          .from('ambassador_applications')
          .select('id, status, reapply_delay_date')
          .eq('email', sanitizedEmail)
          .in('status', ['rejected', 'removed'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (rejectedAppByEmail) {
          const canReapply = !rejectedAppByEmail.reapply_delay_date || 
            new Date(rejectedAppByEmail.reapply_delay_date) <= now;
          
          if (!canReapply) {
            const delayUntil = new Date(rejectedAppByEmail.reapply_delay_date);
            const daysRemaining = Math.ceil((delayUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            toast({
              title: language === 'en' ? 'Cannot Reapply Yet' : 'Ne Peut Pas Re-candidater Encore', 
              description: language === 'en'
                ? `You can reapply in ${daysRemaining} day(s). Please wait until ${delayUntil.toLocaleDateString()}.`
                : `Vous pouvez re-candidater dans ${daysRemaining} jour(s). Veuillez attendre jusqu'au ${delayUntil.toLocaleDateString()}.`, 
              variant: 'destructive' 
            });
            setIsSubmitting(false);
            return;
          }
        }
      }

      // All checks passed, insert new application
      const { error } = await supabase
        .from('ambassador_applications')
        .insert({
          full_name: sanitizedFullName,
          age: parseInt(formData.age),
          phone_number: formData.phoneNumber,
          email: sanitizedEmail,
          city: sanitizedCity,
          ville: formData.city === 'Sousse' ? DOMPurify.sanitize(formData.ville) : null,
          social_link: sanitizedSocialLink,
          motivation: sanitizedMotivation || null, // Motivation is optional
          status: 'pending'
        });

      if (error) {
        // If it's a unique constraint error, provide a more helpful message
        if (error.code === '23505' || error.message?.includes('unique constraint') || error.message?.includes('duplicate key')) {
          toast({
            title: language === 'en' ? 'Application Already Exists' : 'Candidature Existe Déjà',
            description: language === 'en'
              ? 'An application with this phone number or email already exists. Please contact support if you believe this is an error.'
              : 'Une candidature avec ce numéro de téléphone ou cet email existe déjà. Veuillez contacter le support si vous pensez qu\'il s\'agit d\'une erreur.',
            variant: 'destructive',
          });
          setIsSubmitting(false);
          return;
        }
        throw error;
      }

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
        title: 'Success!', 
        description: 'Your application has been submitted successfully.' 
      });
    } catch (error) {
      logFormSubmission('Ambassador Application', false, {
        phone: formData.phoneNumber,
        error: error instanceof Error ? error.message : String(error)
      }, 'guest');
      logger.error('Ambassador application submission failed', error, {
        category: 'form_submission',
        details: { formName: 'Ambassador Application', phoneNumber: formData.phoneNumber }
      });

      toast({ title: 'Error', description: (error as any).message, variant: 'destructive' });
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
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        </div>

        <div className="max-w-3xl w-full relative z-10">
          <div className="backdrop-blur-sm bg-card/40 border border-border/50 rounded-3xl p-8 md:p-12 shadow-2xl">
            <div className="text-center space-y-8">
              <div className="flex justify-center">
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-ping" style={{ animationDuration: '3s' }}></div>
                  <div className="relative bg-gradient-to-br from-primary via-primary/80 to-secondary p-6 md:p-8 rounded-2xl shadow-2xl">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/50 to-secondary/50 rounded-2xl blur-sm"></div>
                    <XCircle className="w-12 h-12 md:w-16 md:h-16 text-white relative z-10" />
                  </div>
                </div>
              </div>
              
              <div className="space-y-6 pt-4">
                <div className="space-y-3">
                  <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
                    {language === 'en' ? 'Applications Closed' : 'Candidatures Fermées'}
                  </h1>
                  <div className="h-1 w-24 bg-gradient-to-r from-primary to-secondary mx-auto rounded-full"></div>
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
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-float delay-1000" />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-accent/5 rounded-full blur-3xl animate-float delay-2000" />
        
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)`,
          backgroundSize: '40px 40px',
        }} />
        
        <div className="absolute top-20 left-10 animate-pulse">
          <Star className="w-6 h-6 text-yellow-300/20" />
        </div>
        <div className="absolute top-40 right-20 animate-pulse delay-1000">
          <Star className="w-4 h-4 text-blue-300/20" />
        </div>
        <div className="absolute top-60 left-1/4 animate-pulse delay-2000">
          <Star className="w-5 h-5 text-purple-300/20" />
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
          <h1 className="text-5xl md:text-6xl font-heading font-bold text-gradient-neon mb-3 animate-pulse-glow">
            {t.heroTitle}
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
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
        className="w-full max-w-6xl mx-auto mb-12 transform transition-all duration-1000 ease-out relative z-10"
      >
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1">
            <Card className="glass border-border/50 shadow-2xl overflow-hidden">
              <div className="relative bg-gradient-to-r from-primary/10 via-secondary/10 to-accent/10 p-6 border-b border-border/20">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-50" />
                <CardHeader className="text-center pb-0 relative z-10">
                  <CardTitle className="text-3xl font-heading font-bold text-gradient-neon flex items-center justify-center gap-3">
                    <Sparkles className="w-6 h-6 animate-pulse" />
                    {t.formTitle}
                    <Sparkles className="w-6 h-6 animate-pulse" />
                  </CardTitle>
                </CardHeader>
              </div>
              <CardContent className="p-8">
              {submitted ? (
                <div className="text-center space-y-4">
                  <div className="flex justify-center mb-4">
                    <div className="relative">
                      <Heart className="w-12 h-12 text-green-500 animate-pulse" />
                      <div className="absolute -top-1 -right-1">
                        <Star className="w-4 h-4 text-yellow-300 animate-spin" />
                      </div>
                    </div>
                  </div>
                  <p className="text-green-500 font-semibold">{t.success}</p>
                  <Button asChild variant="outline" className="w-full">
                    <Link to="/ambassador/auth">{t.login}</Link>
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2 group">
                      <Label htmlFor="fullName" className="flex items-center gap-2 text-sm font-semibold text-foreground/90">
                        <div className="p-1.5 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                          <User className="w-4 h-4 text-primary" />
                        </div>
                        {t.fullName}
                      </Label>
                      <div className="relative">
                        <Input 
                          id="fullName" 
                          value={formData.fullName} 
                          onChange={e => setFormData({ ...formData, fullName: e.target.value })} 
                          required 
                          className="pl-12 h-12 bg-background/50 border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-300 group-hover:border-primary/50"
                        />
                        <User className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                    
                    <div className="space-y-2 group">
                      <Label htmlFor="age" className="flex items-center gap-2 text-sm font-semibold text-foreground/90">
                        <div className="p-1.5 rounded-lg bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
                          <Calendar className="w-4 h-4 text-blue-500" />
                        </div>
                        {t.age}
                      </Label>
                      <div className="relative">
                        <Input 
                          id="age" 
                          type="number" 
                          min="16" 
                          max="99" 
                          value={formData.age} 
                          onChange={e => setFormData({ ...formData, age: e.target.value })} 
                          required 
                          className="pl-12 h-12 bg-background/50 border-border/50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-300 group-hover:border-blue-500/50"
                        />
                        <Calendar className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground group-hover:text-blue-500 transition-colors" />
                      </div>
                    </div>
                    
                    <div className="space-y-2 group">
                      <Label htmlFor="phone" className="flex items-center gap-2 text-sm font-semibold text-foreground/90">
                        <div className="p-1.5 rounded-lg bg-green-500/10 group-hover:bg-green-500/20 transition-colors">
                          <Phone className="w-4 h-4 text-green-500" />
                        </div>
                        {t.phone}
                      </Label>
                      <div className="relative">
                        <Input 
                          id="phone" 
                          type="tel" 
                          value={formData.phoneNumber} 
                          onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })} 
                          required 
                          className="pl-12 h-12 bg-background/50 border-border/50 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all duration-300 group-hover:border-green-500/50"
                        />
                        <Phone className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground group-hover:text-green-500 transition-colors" />
                      </div>
                    </div>
                    
                    <div className="space-y-2 group">
                      <Label htmlFor="email" className="flex items-center gap-2 text-sm font-semibold text-foreground/90">
                        <div className="p-1.5 rounded-lg bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors">
                          <Mail className="w-4 h-4 text-purple-500" />
                        </div>
                        {t.email}
                      </Label>
                      <div className="relative">
                        <Input 
                          id="email" 
                          type="email" 
                          value={formData.email} 
                          onChange={e => setFormData({ ...formData, email: e.target.value })} 
                          required 
                          className="pl-12 h-12 bg-background/50 border-border/50 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all duration-300 group-hover:border-purple-500/50"
                        />
                        <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground group-hover:text-purple-500 transition-colors" />
                      </div>
                    </div>
                    
                    <div className="space-y-2 md:col-span-2 group">
                      <Label htmlFor="city" className="flex items-center gap-2 text-sm font-semibold text-foreground/90">
                        <div className="p-1.5 rounded-lg bg-red-500/10 group-hover:bg-red-500/20 transition-colors">
                          <MapPin className="w-4 h-4 text-red-500" />
                        </div>
                        {t.city} <span className="text-destructive">*</span>
                      </Label>
                      <div className="relative">
                        <MapPin className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground group-hover:text-red-500 transition-colors pointer-events-none z-20" />
                        <Select 
                          value={formData.city} 
                          onValueChange={(value) => {
                            setFormData({ ...formData, city: value, ville: value === 'Sousse' ? formData.ville : '' });
                          }}
                          required
                        >
                          <SelectTrigger className="pl-12 h-12 bg-background/50 border-border/50 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all duration-300 group-hover:border-red-500/50 relative z-10 w-full">
                            <SelectValue placeholder={language === 'en' ? 'Select a city' : 'Sélectionner une ville'} />
                          </SelectTrigger>
                          <SelectContent className="z-[9999]" position="popper">
                            {CITIES.map((city) => (
                              <SelectItem key={city} value={city}>{city}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    {isSousse && (
                      <div className="space-y-2 md:col-span-2 group animate-in slide-in-from-top-4 fade-in duration-300">
                        <Label htmlFor="ville" className="flex items-center gap-2 text-sm font-semibold text-foreground/90">
                          <div className="p-1.5 rounded-lg bg-orange-500/10 group-hover:bg-orange-500/20 transition-colors">
                            <MapPin className="w-4 h-4 text-orange-500" />
                          </div>
                          {language === 'en' ? 'Ville (Neighborhood)' : 'Quartier'} <span className="text-destructive">*</span>
                        </Label>
                        <div className="relative">
                          <MapPin className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground group-hover:text-orange-500 transition-colors pointer-events-none z-20" />
                          <Select 
                            value={formData.ville} 
                            onValueChange={(value) => setFormData({ ...formData, ville: value })}
                            required
                          >
                            <SelectTrigger className="pl-12 h-12 bg-background/50 border-border/50 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all duration-300 group-hover:border-orange-500/50 relative z-10 w-full">
                              <SelectValue placeholder={language === 'en' ? 'Select a neighborhood' : 'Sélectionner un quartier'} />
                            </SelectTrigger>
                            <SelectContent className="z-[9999]" position="popper">
                              {SOUSSE_VILLES.map((ville) => (
                                <SelectItem key={ville} value={ville}>{ville}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                    
                    <div className="space-y-2 md:col-span-2 group">
                      <Label htmlFor="socialLink" className="flex items-center gap-2 text-sm font-semibold text-foreground/90">
                        <div className="p-1.5 rounded-lg bg-pink-500/10 group-hover:bg-pink-500/20 transition-colors">
                          <Instagram className="w-4 h-4 text-pink-500" />
                        </div>
                        {t.socialLink}
                      </Label>
                      <div className="relative">
                        <Input 
                          id="socialLink" 
                          type="url" 
                          value={formData.socialLink} 
                          onChange={e => setFormData({ ...formData, socialLink: e.target.value })} 
                          required 
                          placeholder="https://www.instagram.com/username"
                          className="pl-12 h-12 bg-background/50 border-border/50 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all duration-300 group-hover:border-pink-500/50"
                        />
                        <Instagram className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground group-hover:text-pink-500 transition-colors" />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {language === 'en' 
                          ? 'Must start with https://www.instagram.com/ or https://instagram.com/' 
                          : 'Doit commencer par https://www.instagram.com/ ou https://instagram.com/'}
                      </p>
                    </div>
                    
                    <div className="space-y-2 md:col-span-2 group">
                      <Label htmlFor="motivation" className="flex items-center gap-2 text-sm font-semibold text-foreground/90">
                        <div className="p-1.5 rounded-lg bg-orange-500/10 group-hover:bg-orange-500/20 transition-colors">
                          <FileText className="w-4 h-4 text-orange-500" />
                        </div>
                        {t.motivation}
                      </Label>
                      <div className="relative">
                        <Textarea 
                          id="motivation" 
                          value={formData.motivation} 
                          onChange={e => setFormData({ ...formData, motivation: e.target.value })} 
                          className="min-h-[140px] resize-y bg-background/50 border-border/50 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all duration-300 group-hover:border-orange-500/50"
                          placeholder={language === 'en' ? 'Optional: Tell us why you want to be an ambassador' : 'Optionnel : Dites-nous pourquoi vous voulez être ambassadeur'}
                        />
                      </div>
                    </div>
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full btn-gradient h-14 text-lg font-semibold relative overflow-hidden group hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 shadow-lg hover:shadow-xl" 
                    disabled={isSubmitting}
                  >
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      {isSubmitting ? (
                        <>
                          <div className="h-5 w-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                          {t.submitting}
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-5 h-5" />
                          {t.submit}
                        </>
                      )}
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-secondary/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="absolute inset-0 bg-[length:200%_200%] animate-shimmer opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ backgroundImage: 'linear-gradient(to right, transparent 0%, rgba(255,255,255,0.1) 30%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0.1) 70%, transparent 100%)' }} />
                  </Button>
                  
                  <div className="text-center pt-2">
                    <Button asChild variant="outline" className="w-full hover:scale-[1.02] active:scale-[0.98] transition-all duration-300">
                      <Link to="/ambassador/auth">{t.login}</Link>
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
          </div>
        
          <div 
            ref={benefitsRef}
            className="hidden lg:flex flex-col justify-center bg-gradient-to-br from-primary via-secondary to-accent text-white w-full max-w-sm p-8 gap-6 transform transition-all duration-1000 ease-out relative rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/90 via-secondary/90 to-accent/90" />
            <div className="absolute inset-0 opacity-20" style={{
              backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
              backgroundSize: '20px 20px',
            }} />
            
            <div className="absolute top-4 right-4 z-10">
              <Star className="w-5 h-5 text-yellow-300/80 animate-pulse" />
            </div>
            <div className="absolute bottom-4 left-4 z-10">
              <Sparkles className="w-4 h-4 text-white/80 animate-bounce" />
            </div>
            <div className="absolute top-1/2 left-3 z-10">
              <Heart className="w-4 h-4 text-red-300/80 animate-pulse" style={{ animationDelay: '500ms' }} />
            </div>
            
            <div className="flex flex-col items-center gap-4 relative z-10">
              <div className="relative">
                <div className="absolute inset-0 bg-white/20 rounded-full blur-xl animate-pulse" />
                <Users className="w-14 h-14 text-white relative z-10" />
                <div className="absolute -top-1 -right-1 z-20">
                  <Star className="w-4 h-4 text-yellow-300 animate-spin" />
                </div>
              </div>
              <h2 className="text-2xl font-heading font-bold mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                {language === 'en' ? 'Why Join?' : 'Pourquoi rejoindre ?'}
                <Sparkles className="w-5 h-5" />
              </h2>
              <ul className="space-y-4 text-left w-full">
                {t.benefits.map((benefit, i) => {
                  const icons = [
                    <Award key="award" className="w-5 h-5 text-yellow-300" />,
                    <Target key="target" className="w-5 h-5 text-yellow-300" />,
                    <Gift key="gift" className="w-5 h-5 text-yellow-300" />,
                    <Crown key="crown" className="w-5 h-5 text-yellow-300" />,
                    <TrendingUp key="trending" className="w-5 h-5 text-yellow-300" />
                  ];
                  return (
                    <li key={i} className="flex items-start gap-3 group hover:translate-x-1 transition-transform duration-300">
                      <div className="mt-0.5 group-hover:scale-110 transition-transform duration-300">
                        {icons[i] || <Star className="w-5 h-5 text-yellow-300" />}
                      </div>
                      <span className="text-base leading-relaxed group-hover:text-yellow-200 transition-colors duration-300">
                        {benefit}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
      </div>
    </div>
  </div>
  );
};

export default Application;







