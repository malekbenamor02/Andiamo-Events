import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { User, Star, Users, Sparkles } from "lucide-react";
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
          title: 'Phone or email already used',
          description: 'An ambassador or application with this phone or email already exists.',
          variant: 'destructive',
        });
        setIsSubmitting(false);
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
          motivation: sanitizedMotivation || null,
          status: 'pending'
        });
      if (error) throw error;
      setSubmitted(true);
      toast({ title: t.success });
      setFormData({
        fullName: '', age: '', phoneNumber: '', email: '', city: '', socialLink: '', motivation: ''
      });
    } catch (error) {
      toast({ title: 'Error', description: (error as any).message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-dark flex flex-col items-center justify-start p-0 md:p-8">
      {/* Hero Section */}
      <div className="w-full max-w-3xl mx-auto text-center py-12 px-4 md:px-0">
        <div className="flex flex-col items-center gap-4">
          <Sparkles className="w-12 h-12 text-primary animate-pulse" />
          <h1 className="text-4xl md:text-5xl font-extrabold text-gradient-neon mb-2">{t.heroTitle}</h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">{t.heroSubtitle}</p>
        </div>
      </div>
      {/* Main Content: Form + Benefits */}
      <div className="w-full max-w-5xl mx-auto bg-card/80 rounded-2xl shadow-xl flex flex-col md:flex-row overflow-hidden">
        {/* Form Section */}
        <div className="flex-1 p-6 md:p-10">
          <Card className="shadow-none glass bg-transparent">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-2xl font-bold text-gradient-neon">{t.formTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              {submitted ? (
                <div className="text-center space-y-4">
                  <p className="text-green-500 font-semibold">{t.success}</p>
                  <Button asChild variant="outline" className="w-full">
                    <Link to="/ambassador/auth">{t.login}</Link>
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fullName">{t.fullName}</Label>
                      <Input id="fullName" value={formData.fullName} onChange={e => setFormData({ ...formData, fullName: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="age">{t.age}</Label>
                      <Input id="age" type="number" min="16" max="99" value={formData.age} onChange={e => setFormData({ ...formData, age: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">{t.phone}</Label>
                      <Input id="phone" type="tel" value={formData.phoneNumber} onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">{t.email}</Label>
                      <Input id="email" type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} required />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="city">{t.city}</Label>
                      <Input id="city" value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} required />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="socialLink">{t.socialLink}</Label>
                      <Input id="socialLink" type="url" value={formData.socialLink} onChange={e => setFormData({ ...formData, socialLink: e.target.value })} required />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="motivation">{t.motivation}</Label>
                      <Input id="motivation" value={formData.motivation} onChange={e => setFormData({ ...formData, motivation: e.target.value })} />
                    </div>
                  </div>
                  <Button type="submit" className="w-full btn-gradient mt-2" disabled={isSubmitting}>
                    {isSubmitting ? t.submitting : t.submit}
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
        {/* Benefits Section */}
        <div className="hidden md:flex flex-col justify-center items-center bg-gradient-neon text-white w-full max-w-xs p-8 gap-6">
          <div className="flex flex-col items-center gap-2">
            <Users className="w-10 h-10 text-white/80" />
            <h2 className="text-xl font-bold mb-2">{language === 'en' ? 'Why Join?' : 'Pourquoi rejoindre ?'}</h2>
            <ul className="space-y-3 text-left text-base">
              {t.benefits.map((benefit, i) => (
                <li key={i} className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-300" />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Application; 