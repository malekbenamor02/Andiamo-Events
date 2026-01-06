import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import Navigation from "./components/layout/Navigation";
import Footer from "./components/layout/Footer";
import MaintenanceMode from "./components/layout/MaintenanceMode";
import Index from "./pages/Index";
import Events from "./pages/Events";

import About from "./pages/About";
import Contact from "./pages/Contact";
import NotFound from "./pages/NotFound";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Terms from "./pages/Terms";
import RefundPolicy from "./pages/RefundPolicy";
import ScrollToTop from "./components/layout/ScrollToTop";
import Auth from "./pages/ambassador/Auth";
import AdminLogin from "./pages/admin/Login";
import AdminDashboard from "./pages/admin/Dashboard";
import ProtectedAdminRoute from "./components/auth/ProtectedAdminRoute";
import AmbassadorDashboard from "./pages/ambassador/Dashboard";
import ProtectedAmbassadorRoute from "./components/auth/ProtectedAmbassadorRoute";

import AmbassadorApplication from "./pages/ambassador/Application";
import PassPurchase from "./pages/PassPurchase";
import CODOrder from "./pages/CODOrder";
import GalleryEvent from "./pages/GalleryEvent";
import UpcomingEvent from "./pages/UpcomingEvent";
import OnlinePayment from "./pages/OnlinePayment";
// import PaymentProcessing from "./pages/PaymentProcessing";
import DisableInspect from "./components/security/DisableInspect";
import ErrorBoundary from "./components/ErrorBoundary";
import { FaviconLoader } from "./components/FaviconLoader";
import PhoneCapturePopup from "./components/PhoneCapturePopup";
import { usePhoneCapture } from "./hooks/usePhoneCapture";

// Configure React Query with smart caching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale-while-revalidate: show cached data immediately, fetch fresh in background
      staleTime: 5 * 60 * 1000, // 5 minutes - data is fresh for 5 min
      gcTime: 30 * 60 * 1000, // 30 minutes - keep unused data in cache for 30 min (formerly cacheTime)
      refetchOnWindowFocus: false, // Don't refetch on window focus (reduce API calls)
      refetchOnReconnect: true, // Refetch when internet reconnects
      retry: 1, // Retry failed requests once
    },
  },
});

const AppContent = ({ language, toggleLanguage }: { language: 'en' | 'fr'; toggleLanguage: () => void }) => {
  const location = useLocation();
  const shouldShowPhonePopup = usePhoneCapture(location.pathname);
  const [isPhonePopupOpen, setIsPhonePopupOpen] = useState(false);

  // Sync hook state with popup state
  useEffect(() => {
    if (shouldShowPhonePopup) {
      setIsPhonePopupOpen(true);
    } else {
      setIsPhonePopupOpen(false);
    }
  }, [shouldShowPhonePopup]);

  return (
    <>
      <FaviconLoader />
      <DisableInspect />
      <ScrollToTop />
      <MaintenanceMode language={language}>
        <div className="min-h-screen bg-background">
          <Navigation language={language} toggleLanguage={toggleLanguage} />
          <Routes>
            <Route path="/" element={<Index language={language} />} />
            <Route path="/events" element={<Events language={language} />} />
            <Route path="/gallery/:eventSlug" element={<GalleryEvent language={language} />} />
            <Route path="/event/:eventSlug" element={<UpcomingEvent language={language} />} />
            <Route path="/pass-purchase" element={<PassPurchase language={language} />} />
            <Route path="/cod-order" element={<CODOrder language={language} />} />
            <Route path="/online-payment" element={<OnlinePayment language={language} />} />
            {/* <Route path="/payment-processing" element={<PaymentProcessing language={language} />} /> */}
    
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
            <Route path="/refund-policy" element={<RefundPolicy language={language} />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <Footer language={language} />
        </div>
      </MaintenanceMode>
      <PhoneCapturePopup
        language={language}
        isOpen={isPhonePopupOpen && shouldShowPhonePopup}
        onClose={() => setIsPhonePopupOpen(false)}
      />
    </>
  );
};

const App = () => {
  const [language, setLanguage] = useState<'en' | 'fr'>('en');
  
  const toggleLanguage = () => {
    setLanguage(prev => prev === 'en' ? 'fr' : 'en');
  };

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppContent language={language} toggleLanguage={toggleLanguage} />
          </BrowserRouter>
          <Analytics />
          <SpeedInsights />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
