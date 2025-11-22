import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { User, Star, Users, Sparkles, Zap, Heart, Mail, Phone, MapPin, Instagram, FileText, Calendar, Award, Target, Gift, Crown, TrendingUp, Users2, Clock, CheckCircle, XCircle, RefreshCw } from "lucide-react";
// @ts-ignore
import DOMPurify from 'dompurify';
import LoadingScreen from '@/components/ui/LoadingScreen';

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
    socialLink: '',
    motivation: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [animatedSections, setAnimatedSections] = useState<Set<string>>(new Set());
  // Start with null - we'll determine the actual status from the database
  const [applicationEnabled, setApplicationEnabled] = useState<boolean | null>(null);
  const [applicationMessage, setApplicationMessage] = useState<string>("");
  const [loadingApplicationStatus, setLoadingApplicationStatus] = useState(true);
  
  // Refs for animation sections
  const heroRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const benefitsRef = useRef<HTMLDivElement>(null);

  // Scroll-triggered animations
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

    // Observe all sections
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

  // Check if ambassador applications are enabled
  useEffect(() => {
    const checkApplicationStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('site_content')
          .select('content')
          .eq('key', 'ambassador_application_settings')
          .single();

        if (error) {
          // PGRST116 means no rows found - this is expected if settings don't exist yet
          if (error.code === 'PGRST116') {
            console.log('Ambassador application settings not found, defaulting to enabled');
            setApplicationEnabled(true);
            setApplicationMessage("");
            setLoadingApplicationStatus(false);
            return;
          }
          console.error('Error fetching ambassador application settings:', error);
          // Default to enabled if error (so users can still apply)
          setApplicationEnabled(true);
          setApplicationMessage("");
          setLoadingApplicationStatus(false);
          return;
        }

        if (data && data.content) {
          const settings = data.content as { enabled?: boolean; message?: string };
          const isEnabled = settings.enabled !== false; // Default to true if not set
          setApplicationEnabled(isEnabled);
          setApplicationMessage(
            settings.message || 
            (language === 'en' 
              ? 'Ambassador applications are currently closed. Please check back later.' 
              : 'Les candidatures d\'ambassadeur sont actuellement fermées. Veuillez réessayer plus tard.')
          );
        } else {
          // Default to enabled if no setting exists
          setApplicationEnabled(true);
          setApplicationMessage("");
        }
      } catch (error) {
        console.error('Error checking application status:', error);
        // Default to enabled on error (so users can still apply)
        setApplicationEnabled(true);
        setApplicationMessage("");
      } finally {
        // Always set loading to false, even if there was an error
        setLoadingApplicationStatus(false);
      }
    };

    checkApplicationStatus();

    // Set up real-time subscription to listen for changes
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

      // Sanitize all fields
      const sanitizedFullName = DOMPurify.sanitize(formData.fullName);
      const sanitizedEmail = DOMPurify.sanitize(formData.email);
      const sanitizedCity = DOMPurify.sanitize(formData.city);
      const sanitizedSocialLink = DOMPurify.sanitize(formData.socialLink);
      const sanitizedMotivation = DOMPurify.sanitize(formData.motivation);
      
      // TEMPORARY: Check if duplicate check should be enabled
      // Set to false to disable duplicate checking (for testing)
      const ENABLE_DUPLICATE_CHECK = true;
      
      if (ENABLE_DUPLICATE_CHECK) {
        // Check for existing phone in ambassadors (phone is the primary identifier)
        const { data: existingAmb, error: ambError } = await supabase
          .from('ambassadors')
          .select('id, status')
          .eq('phone', formData.phoneNumber)
          .maybeSingle();
        
        // Check for existing ambassador
        
        // Check for existing phone in applications (only check pending or approved applications)
        const { data: existingApp, error: appError } = await supabase
          .from('ambassador_applications')
          .select('id, status')
          .eq('phone_number', formData.phoneNumber)
          .in('status', ['pending', 'approved'])
          .maybeSingle();

        // Check for existing application

        // If queries failed due to RLS policies, allow the application
        // This prevents blocking applications when policies aren't set up
        const queryFailed = (ambError && (ambError.code === '42501' || ambError.message?.includes('permission') || ambError.message?.includes('policy'))) ||
                           (appError && (appError.code === '42501' || appError.message?.includes('permission') || appError.message?.includes('policy')));
        
        if (queryFailed) {
          console.warn('RLS policies may not be set up. Allowing application to proceed.');
          // Continue with application if policies aren't set up
        } else {
          // Only block if we found a record AND there was no error
          if (existingAmb && !ambError) {
            toast({
              title: 'Already Applied', 
              description: existingAmb.status === 'approved' 
                ? 'You are already an approved ambassador.' 
                : 'You have already applied. Your application is being reviewed.', 
              variant: 'destructive' 
            });
            setIsSubmitting(false);
            return;
          }

          if (existingApp && !appError) {
            toast({
              title: 'Already Applied', 
              description: existingApp.status === 'approved' 
                ? 'Your application has already been approved.' 
                : 'You have already submitted an application. Please wait for review.', 
              variant: 'destructive' 
            });
            setIsSubmitting(false);
            return;
          }
        }
      }

      const { error } = await supabase
        .from('ambassador_applications')
        .insert({
          full_name: sanitizedFullName,
          age: parseInt(formData.age),
          phone_number: formData.phoneNumber,
          email: sanitizedEmail,
          city: sanitizedCity,
          social_link: sanitizedSocialLink,
          motivation: sanitizedMotivation,
          status: 'pending'
        });

      if (error) throw error;

      setSubmitted(true);
      toast({ 
        title: 'Success!', 
        description: 'Your application has been submitted successfully.' 
      });
    } catch (error) {
      toast({ title: 'Error', description: (error as any).message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading state until we know the actual status (prevents flash of wrong content)
  if (loadingApplicationStatus || applicationEnabled === null) {
    return (
      <LoadingScreen 
        variant="default" 
        size="fullscreen" 
        text={language === 'en' ? 'Loading...' : 'Chargement...'}
      />
    );
  }

  // Show closed message if applications are disabled
  if (applicationEnabled === false) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        </div>

        <div className="max-w-3xl w-full relative z-10">
          <div className="backdrop-blur-sm bg-card/40 border border-border/50 rounded-3xl p-8 md:p-12 shadow-2xl">
            <div className="text-center space-y-8">
              {/* Icon */}
              <div className="flex justify-center">
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-ping" style={{ animationDuration: '3s' }}></div>
                  <div className="relative bg-gradient-to-br from-primary via-primary/80 to-secondary p-6 md:p-8 rounded-2xl shadow-2xl">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/50 to-secondary/50 rounded-2xl blur-sm"></div>
                    <XCircle className="w-12 h-12 md:w-16 md:h-16 text-white relative z-10" />
                  </div>
                </div>
              </div>
              
              {/* Content */}
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

              {/* Link to login */}
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

  // Show the application form (applications are enabled)
  console.log('Rendering: Application form', { 
    applicationEnabled, 
    loadingApplicationStatus,
    type: typeof applicationEnabled,
    shouldShowForm: applicationEnabled === true && !loadingApplicationStatus
  });
  
  // Safety check - if somehow we get here with wrong state, default to showing form
  
  return (
    <div className="min-h-screen bg-gradient-dark flex flex-col items-center justify-start p-0 md:p-8 relative overflow-hidden">
      {/* Floating Stars Background */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Large Stars */}
        <div className="absolute top-20 left-10 animate-pulse">
          <Star className="w-6 h-6 text-yellow-300/30" />
        </div>
        <div className="absolute top-40 right-20 animate-pulse delay-1000">
          <Star className="w-4 h-4 text-blue-300/40" />
        </div>
        <div className="absolute top-60 left-1/4 animate-pulse delay-2000">
          <Star className="w-5 h-5 text-purple-300/30" />
        </div>
        <div className="absolute top-80 right-1/3 animate-pulse delay-1500">
          <Star className="w-3 h-3 text-pink-300/40" />
        </div>
        
        {/* Sparkles */}
        <div className="absolute top-32 left-1/3 animate-bounce delay-500">
          <Sparkles className="w-4 h-4 text-primary/50" />
        </div>
        <div className="absolute top-48 right-1/4 animate-bounce delay-1000">
          <Sparkles className="w-3 h-3 text-primary/40" />
        </div>
        <div className="absolute top-72 left-1/2 animate-bounce delay-1500">
          <Sparkles className="w-5 h-5 text-primary/30" />
        </div>
        
        {/* Hearts */}
        <div className="absolute top-56 left-1/5 animate-pulse delay-300">
          <Heart className="w-4 h-4 text-red-400/30" />
        </div>
        <div className="absolute top-88 right-1/5 animate-pulse delay-700">
          <Heart className="w-3 h-3 text-red-400/40" />
        </div>
        
        {/* Zaps */}
        <div className="absolute top-64 left-1/6 animate-pulse delay-1200">
          <Zap className="w-4 h-4 text-yellow-400/40" />
        </div>
        <div className="absolute top-96 right-1/6 animate-pulse delay-800">
          <Zap className="w-3 h-3 text-yellow-400/30" />
        </div>
      </div>

      {/* Hero Section with Animation */}
      <div 
        ref={heroRef}
        className={`w-full max-w-3xl mx-auto text-center py-12 px-4 md:px-0 transform transition-all duration-1000 ease-out relative z-10 ${
          animatedSections.has('hero') 
            ? 'opacity-100 translate-y-0 scale-100' 
            : 'opacity-100 translate-y-0 scale-100'
        }`}
      >
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
          <Sparkles className="w-12 h-12 text-primary animate-pulse" />
            <div className="absolute -top-2 -right-2">
              <Star className="w-4 h-4 text-yellow-300 animate-spin" />
            </div>
            <div className="absolute -bottom-2 -left-2">
              <Heart className="w-3 h-3 text-red-400 animate-pulse" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-gradient-neon mb-2">{t.heroTitle}</h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">{t.heroSubtitle}</p>
          
          {/* Hero Stars */}
          <div className="flex gap-2 mt-4">
            <Star className="w-5 h-5 text-yellow-300 animate-pulse" />
            <Star className="w-5 h-5 text-yellow-300 animate-pulse delay-300" />
            <Star className="w-5 h-5 text-yellow-300 animate-pulse delay-600" />
            <Star className="w-5 h-5 text-yellow-300 animate-pulse delay-900" />
            <Star className="w-5 h-5 text-yellow-300 animate-pulse delay-1200" />
          </div>
        </div>
      </div>
      
      {/* Main Content: Form + Benefits with Animation */}
      <div 
        ref={formRef}
        className={`w-full max-w-5xl mx-auto bg-card/80 rounded-2xl shadow-xl flex flex-col md:flex-row overflow-hidden transform transition-all duration-1000 ease-out relative z-10 ${
          animatedSections.has('form') 
            ? 'opacity-100 translate-y-0 scale-100' 
            : 'opacity-100 translate-y-0 scale-100'
        }`}
      >
        {/* Form Section */}
        <div className="flex-1 p-6 md:p-10">
          <Card className="shadow-none glass bg-transparent">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-2xl font-bold text-gradient-neon flex items-center justify-center gap-2">
                <Sparkles className="w-5 h-5" />
                {t.formTitle}
                <Sparkles className="w-5 h-5" />
              </CardTitle>
            </CardHeader>
            <CardContent>
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
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fullName" className="flex items-center gap-2 text-sm font-medium">
                        <User className="w-4 h-4 text-primary" />
                        {t.fullName}
                      </Label>
                      <div className="relative">
                        <Input 
                          id="fullName" 
                          value={formData.fullName} 
                          onChange={e => setFormData({ ...formData, fullName: e.target.value })} 
                          required 
                          className="pl-10"
                          placeholder="Enter your full name"
                        />
                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="age" className="flex items-center gap-2 text-sm font-medium">
                        <Calendar className="w-4 h-4 text-blue-500" />
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
                          className="pl-10"
                          placeholder="Your age"
                        />
                        <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="flex items-center gap-2 text-sm font-medium">
                        <Phone className="w-4 h-4 text-green-500" />
                        {t.phone}
                      </Label>
                      <div className="relative">
                        <Input 
                          id="phone" 
                          type="tel" 
                          value={formData.phoneNumber} 
                          onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })} 
                          required 
                          className="pl-10"
                          placeholder="+216 XX XXX XXX"
                        />
                        <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="flex items-center gap-2 text-sm font-medium">
                        <Mail className="w-4 h-4 text-purple-500" />
                        {t.email}
                      </Label>
                      <div className="relative">
                        <Input 
                          id="email" 
                          type="email" 
                          value={formData.email} 
                          onChange={e => setFormData({ ...formData, email: e.target.value })} 
                          required 
                          className="pl-10"
                          placeholder="your.email@example.com"
                        />
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="city" className="flex items-center gap-2 text-sm font-medium">
                        <MapPin className="w-4 h-4 text-red-500" />
                        {t.city}
                      </Label>
                      <div className="relative">
                        <Input 
                          id="city" 
                          value={formData.city} 
                          onChange={e => setFormData({ ...formData, city: e.target.value })} 
                          required 
                          className="pl-10"
                          placeholder="Your city"
                        />
                        <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="socialLink" className="flex items-center gap-2 text-sm font-medium">
                        <Instagram className="w-4 h-4 text-pink-500" />
                        {t.socialLink}
                      </Label>
                      <div className="relative">
                        <Input 
                          id="socialLink" 
                          type="url" 
                          value={formData.socialLink} 
                          onChange={e => setFormData({ ...formData, socialLink: e.target.value })} 
                          required 
                          className="pl-10"
                          placeholder="https://instagram.com/yourusername"
                        />
                        <Instagram className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="motivation" className="flex items-center gap-2 text-sm font-medium">
                        <FileText className="w-4 h-4 text-orange-500" />
                        {t.motivation}
                      </Label>
                      <div className="relative">
                        <Textarea 
                          id="motivation" 
                          value={formData.motivation} 
                          onChange={e => setFormData({ ...formData, motivation: e.target.value })} 
                          className="min-h-[120px] resize-y"
                          placeholder="Tell us why you want to be an ambassador..."
                        />
                      </div>
                    </div>
                  </div>
                  <Button type="submit" className="w-full btn-gradient mt-2 relative overflow-hidden group" disabled={isSubmitting}>
                    <span className="relative z-10">{isSubmitting ? t.submitting : t.submit}</span>
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-secondary/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="absolute top-2 right-2">
                      <Sparkles className="w-4 h-4 text-white/60 animate-pulse" />
                    </div>
                  </Button>
                  <div className="text-center mt-4">
                    <Button asChild variant="outline" className="w-full">
                      <Link to="/ambassador/auth">{t.login}</Link>
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
        
        {/* Benefits Section with Animation */}
        <div 
          ref={benefitsRef}
          className={`hidden md:flex flex-col justify-center items-center bg-gradient-neon text-white w-full max-w-xs p-8 gap-6 transform transition-all duration-1000 ease-out relative ${
            animatedSections.has('benefits') 
              ? 'opacity-100 translate-x-0 scale-100' 
              : 'opacity-0 translate-x-8 scale-95'
          }`}
        >
          {/* Floating stars in benefits */}
          <div className="absolute top-4 right-4">
            <Star className="w-4 h-4 text-yellow-300/60 animate-pulse" />
          </div>
          <div className="absolute bottom-4 left-4">
            <Sparkles className="w-3 h-3 text-white/60 animate-bounce" />
          </div>
          <div className="absolute top-1/2 left-2">
            <Heart className="w-3 h-3 text-red-300/60 animate-pulse delay-500" />
          </div>
          
          <div className="flex flex-col items-center gap-2">
            <div className="relative">
            <Users className="w-10 h-10 text-white/80" />
              <div className="absolute -top-1 -right-1">
                <Star className="w-3 h-3 text-yellow-300 animate-spin" />
              </div>
            </div>
            <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              {language === 'en' ? 'Why Join?' : 'Pourquoi rejoindre ?'}
              <Sparkles className="w-4 h-4" />
            </h2>
            <ul className="space-y-3 text-left text-base">
              {t.benefits.map((benefit, i) => {
                const icons = [
                  <Award key="award" className="w-4 h-4 text-yellow-300 group-hover:animate-pulse" />,
                  <Target key="target" className="w-4 h-4 text-yellow-300 group-hover:animate-pulse" />,
                  <Gift key="gift" className="w-4 h-4 text-yellow-300 group-hover:animate-pulse" />,
                  <Crown key="crown" className="w-4 h-4 text-yellow-300 group-hover:animate-pulse" />,
                  <TrendingUp key="trending" className="w-4 h-4 text-yellow-300 group-hover:animate-pulse" />
                ];
                return (
                  <li key={i} className="flex items-center gap-3 group">
                    {icons[i] || <Star className="w-4 h-4 text-yellow-300 group-hover:animate-pulse" />}
                    <span className="group-hover:text-yellow-200 transition-colors duration-300">{benefit}</span>
                </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Application; 