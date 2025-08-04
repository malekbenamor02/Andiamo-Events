import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Navigation from "./components/layout/Navigation";
import Footer from "./components/layout/Footer";
import Index from "./pages/Index";
import Events from "./pages/Events";

import About from "./pages/About";
import Contact from "./pages/Contact";
import NotFound from "./pages/NotFound";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Terms from "./pages/Terms";
import ScrollToTop from "./components/layout/ScrollToTop";
import Auth from "./pages/ambassador/Auth";
import AdminLogin from "./pages/admin/Login";
import AdminDashboard from "./pages/admin/Dashboard";
import ProtectedAdminRoute from "./components/auth/ProtectedAdminRoute";
import AmbassadorDashboard from "./pages/ambassador/Dashboard";
import ProtectedAmbassadorRoute from "./components/auth/ProtectedAmbassadorRoute";

import AmbassadorApplication from "./pages/ambassador/Application";
import PassPurchase from "./pages/PassPurchase";
import LoadingDemo from "./pages/LoadingDemo";

const queryClient = new QueryClient();

const App = () => {
  const [language, setLanguage] = useState<'en' | 'fr'>('en');
  
  const toggleLanguage = () => {
    setLanguage(prev => prev === 'en' ? 'fr' : 'en');
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTop />
          <div className="min-h-screen bg-background">
            <Navigation language={language} toggleLanguage={toggleLanguage} />
            <Routes>
              <Route path="/" element={<Index language={language} />} />
              <Route path="/events" element={<Events language={language} />} />
              <Route path="/pass-purchase" element={<PassPurchase language={language} />} />
      
              <Route path="/about" element={<About language={language} />} />
              <Route path="/ambassador" element={<AmbassadorApplication language={language} />} />
              <Route path="/ambassador/auth" element={<Auth language={language} />} />

              <Route path="/ambassador/dashboard" element={
                <ProtectedAmbassadorRoute language={language}>
                  <AmbassadorDashboard language={language} />
                </ProtectedAmbassadorRoute>
              } />
              <Route path="/admin/login" element={<AdminLogin language={language} />} />
              <Route path="/admin" element={
                <ProtectedAdminRoute language={language}>
                  <AdminDashboard language={language} />
                </ProtectedAdminRoute>
              } />
              <Route path="/contact" element={<Contact language={language} />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy language={language} />} />
              <Route path="/terms" element={<Terms language={language} />} />
              <Route path="/loading-demo" element={<LoadingDemo />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            <Footer language={language} />
          </div>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
