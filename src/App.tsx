import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navigation from "./components/layout/Navigation";
import Footer from "./components/layout/Footer";
import Index from "./pages/Index";
import Events from "./pages/Events";
import Gallery from "./pages/Gallery";
import About from "./pages/About";
import Ambassador from "./pages/Ambassador";
import Contact from "./pages/Contact";
import NotFound from "./pages/NotFound";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Terms from "./pages/Terms";
import ScrollToTop from "./components/layout/ScrollToTop";

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
              <Route path="/gallery" element={<Gallery language={language} />} />
              <Route path="/about" element={<About language={language} />} />
              <Route path="/ambassador" element={<Ambassador language={language} />} />
              <Route path="/contact" element={<Contact language={language} />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy language={language} />} />
              <Route path="/terms" element={<Terms language={language} />} />
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
