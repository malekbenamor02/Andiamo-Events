import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { User, Star, Users, Sparkles, Zap, Heart, Mail, Phone, MapPin, Instagram, FileText, Calendar, Award, Target, Gift, Crown, TrendingUp, Users2, Clock, CheckCircle } from "lucide-react";
// @ts-ignore
import DOMPurify from 'dompurify';

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
      // Check for existing phone/email in ambassadors
      const { data: existingAmb } = await supabase
        .from('ambassadors')
        .select('id')
        .or(`phone.eq.${formData.phoneNumber},email.eq.${formData.email}`)
        .maybeSingle();
      // Check for existing phone/email in applications
      const { data: existingApp } = await supabase
        .from('ambassador_applications')
        .select('id')
        .or(`phone_number.eq.${formData.phoneNumber},email.eq.${formData.email}`)
        .maybeSingle();

      if (existingAmb || existingApp) {
        toast({
          title: 'Already Applied', 
          description: 'You have already applied or are already an ambassador.', 
          variant: 'destructive' 
        });
        return;
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
            : 'opacity-0 translate-y-8 scale-95'
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
            : 'opacity-0 translate-y-8 scale-95'
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
                        <Input 
                          id="motivation" 
                          value={formData.motivation} 
                          onChange={e => setFormData({ ...formData, motivation: e.target.value })} 
                          className="pl-10"
                          placeholder="Tell us why you want to be an ambassador..."
                        />
                        <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
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