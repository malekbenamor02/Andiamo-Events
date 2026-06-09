import { useState, useEffect, Suspense, lazy } from "react";
import { HelmetProvider, Helmet } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { JsonLdOrganization, JsonLdLocalBusiness, JsonLdWebSite } from "@/components/JsonLd";
import Navigation from "./components/layout/Navigation";
import Footer from "./components/layout/Footer";
import MaintenanceMode from "./components/layout/MaintenanceMode";
import LoadingScreen from "./components/ui/LoadingScreen";

// Lazy with recovery: on chunk load / MIME type error (e.g. stale cache after deploy), reload once.
const CHUNK_RELOAD_KEY = "andiamo_chunk_reload";
function lazyWithChunkRecovery<T extends React.ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isChunkError =
        /Loading chunk \d+ failed|ChunkLoadError|MIME type|text\/html.*JavaScript/i.test(msg);
      const isNetworkLike =
        /failed to fetch|network error|networkerror|load failed|dynamically imported module|importing a module script failed/i.test(
          msg
        );
      if ((isChunkError || isNetworkLike) && !sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
        sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
        window.location.reload();
        return new Promise(() => {});
      }
      sessionStorage.removeItem(CHUNK_RELOAD_KEY);
      throw err;
    }
  });
}

// Homepage is eager-loaded (most common entry) to avoid Suspense loader before hero loader.
import Index from "./pages/Index";

// Route-level code splitting for other main pages
const Events = lazyWithChunkRecovery(() => import("./pages/Events"));
const About = lazyWithChunkRecovery(() => import("./pages/About"));
const Contact = lazyWithChunkRecovery(() => import("./pages/Contact"));
const NotFound = lazyWithChunkRecovery(() => import("./pages/NotFound"));
const Terms = lazyWithChunkRecovery(() => import("./pages/Terms"));
const Academy = lazyWithChunkRecovery(() => import("./pages/Academy"));
const AcademyRegistration = lazyWithChunkRecovery(() => import("./pages/AcademyRegistration"));
const AcademyTerms = lazyWithChunkRecovery(() => import("./pages/AcademyTerms"));
const AcademyPaymentProcessing = lazyWithChunkRecovery(() => import("./pages/AcademyPaymentProcessing"));
const AcademyRegistrationConfirmation = lazyWithChunkRecovery(() => import("./pages/AcademyRegistrationConfirmation"));
import ScrollToTop from "./components/layout/ScrollToTop";
// Auth / dashboard sections (loaded on demand)
const Auth = lazyWithChunkRecovery(() => import("./pages/ambassador/Auth"));
const AdminLogin = lazyWithChunkRecovery(() => import("./pages/admin/Login"));
const AdminDashboard = lazyWithChunkRecovery(() => import("./pages/admin/Dashboard"));
import ProtectedAdminRoute from "./components/auth/ProtectedAdminRoute";
const AmbassadorDashboard = lazyWithChunkRecovery(() => import("./pages/ambassador/Dashboard"));
import ProtectedAmbassadorRoute from "./components/auth/ProtectedAmbassadorRoute";

const AmbassadorApplication = lazyWithChunkRecovery(() => import("./pages/ambassador/Application"));
const Suggestions = lazyWithChunkRecovery(() => import("./pages/Suggestions"));
const Careers = lazyWithChunkRecovery(() => import("./pages/Careers"));
const PassPurchase = lazyWithChunkRecovery(() => import("./pages/PassPurchase"));
const PaymentProcessing = lazyWithChunkRecovery(() => import("./pages/PaymentProcessing"));
const GalleryEvent = lazyWithChunkRecovery(() => import("./pages/GalleryEvent"));
const UpcomingEvent = lazyWithChunkRecovery(() => import("./pages/UpcomingEvent"));
const ScannerApp = lazyWithChunkRecovery(() => import("./pages/scanner/ScannerApp"));
const PosApp = lazyWithChunkRecovery(() => import("./pages/pos/PosApp"));
import type { PosAppProps } from "./pages/pos/PosApp";
import DisableInspect from "./components/security/DisableInspect";
import ErrorBoundary from "./components/ErrorBoundary";
import PhoneCapturePopup from "./components/PhoneCapturePopup";
import { usePhoneCapture } from "./hooks/usePhoneCapture";
import { trackPageView } from "./lib/ga";
import { trackMetaPageView } from "./lib/meta";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { useTheme } from "next-themes";

const THEME_STORAGE_KEY = "andiamo-theme-mode";

const readPersistedTheme = (): "light" | "dark" | null => {
  if (typeof document === "undefined") return null;

  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") {
      return stored;
    }
  } catch {
    // Some mobile webviews/private modes block localStorage.
  }

  const cookieMatch = document.cookie.match(/(?:^|;\s*)andiamo-theme-mode=(light|dark)(?:;|$)/);
  if (cookieMatch?.[1] === "light" || cookieMatch?.[1] === "dark") {
    return cookieMatch[1];
  }

  return null;
};

const persistTheme = (theme: "light" | "dark") => {
  if (typeof document === "undefined") return;

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore storage errors and use cookie fallback.
  }

  document.cookie = `${THEME_STORAGE_KEY}=${theme}; path=/; max-age=31536000; samesite=lax`;
};

// In-app browsers (Instagram, Facebook, etc.) use WebViews that can tear down native
// objects; Vercel Speed Insights' button metadata code then throws "Java object is gone".
// Skip loading Speed Insights there to avoid the error (we still load Analytics).
const isInAppBrowser =
  typeof navigator !== "undefined" &&
  /Instagram|FBAN|FBAV|FB_IAB|Twitter|Line\/|Snapchat|Pinterest|LinkedInApp/i.test(
    navigator.userAgent || ""
  );

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

const AppContent = ({
  language,
  toggleLanguage,
  theme,
  toggleTheme,
}: {
  language: 'en' | 'fr';
  toggleLanguage: () => void;
  theme: "dark" | "light";
  toggleTheme: () => void;
}) => {
  const location = useLocation();
  const shouldShowPhonePopup = usePhoneCapture(location.pathname);
  const [isPhonePopupOpen, setIsPhonePopupOpen] = useState(false);
  const isScanner = location.pathname.startsWith("/scanner");
  const isPos = location.pathname.startsWith("/pos");

  // Sync hook state with popup state
  useEffect(() => {
    if (shouldShowPhonePopup) {
      setIsPhonePopupOpen(true);
    } else {
      setIsPhonePopupOpen(false);
    }
  }, [shouldShowPhonePopup]);

  // Track SPA page views in Google Analytics and Meta Pixel when the route changes
  useEffect(() => {
    const path = location.pathname + location.search;
    trackPageView(path);
    trackMetaPageView(path);
  }, [location.pathname, location.search]);

  return (
    <>
      <Helmet>
        <html lang={language === "fr" ? "fr" : "en"} />
        <meta property="og:locale" content={language === "fr" ? "fr_FR" : "en_US"} />
        <meta property="og:locale:alternate" content={language === "fr" ? "en_US" : "fr_FR"} />
      </Helmet>
      <DisableInspect />
      <ScrollToTop />
      {!isScanner && !isPos && (
          <>
            <JsonLdWebSite />
            <JsonLdOrganization />
            <JsonLdLocalBusiness />
          </>
        )}
      <MaintenanceMode language={language}>
        <div className="min-h-screen bg-background flex flex-col">
          {!isScanner && !isPos && (
            <Navigation
              language={language}
              toggleLanguage={toggleLanguage}
              theme={theme}
              toggleTheme={toggleTheme}
            />
          )}
          <ErrorBoundary embedded language={language}>
          <Suspense fallback={<LoadingScreen />}>
            <Routes>
              <Route path="/scanner/*" element={<ScannerApp language={language} />} />
              <Route path="/pos/:outletSlug/*" element={<PosApp {...({ language, toggleLanguage } satisfies PosAppProps)} />} />
              <Route path="/" element={<Index language={language} />} />
              <Route path="/events" element={<Events language={language} />} />
              <Route path="/gallery/:eventSlug" element={<GalleryEvent language={language} />} />
              <Route path="/event/:eventSlug" element={<UpcomingEvent language={language} />} />
              <Route path="/pass-purchase" element={<PassPurchase language={language} />} />
              <Route path="/payment-processing" element={<PaymentProcessing language={language} />} />

              <Route path="/about" element={<About language={language} />} />
              <Route path="/careers" element={<Careers language={language} />} />
              <Route path="/careers/:slug/apply" element={<Careers language={language} />} />
              <Route path="/careers/:slug" element={<Careers language={language} />} />
              <Route path="/ambassador" element={<AmbassadorApplication language={language} />} />
              <Route path="/ambassador/auth" element={<Auth language={language} />} />

              <Route
                path="/ambassador/dashboard"
                element={
                  <ProtectedAmbassadorRoute language={language}>
                    <AmbassadorDashboard language={language} />
                  </ProtectedAmbassadorRoute>
                }
              />
              <Route path="/admin/login" element={<AdminLogin language={language} />} />
              <Route
                path="/admin"
                element={
                  <ProtectedAdminRoute language={language}>
                    <AdminDashboard language={language} />
                  </ProtectedAdminRoute>
                }
              />
              <Route path="/contact" element={<Contact language={language} />} />
              <Route path="/suggestions" element={<Suggestions language={language} />} />
              <Route path="/terms" element={<Terms language={language} />} />
              <Route path="/academy" element={<Academy language={language} />} />
              <Route path="/academy/register" element={<AcademyRegistration language={language} />} />
              <Route path="/academy/register/confirmation" element={<AcademyRegistrationConfirmation language={language} />} />
              <Route path="/academy/payment-processing" element={<AcademyPaymentProcessing language={language} />} />
              <Route path="/academy/terms" element={<AcademyTerms language={language} />} />
              {/* Friendly URL route for event pass purchase: /event-slug */}
              <Route path="/:eventSlug" element={<PassPurchase language={language} />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          </ErrorBoundary>
          {!isScanner && !isPos && <Footer language={language} />}
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
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const persistedTheme = readPersistedTheme();
    if (persistedTheme) {
      if (theme !== persistedTheme) {
        setTheme(persistedTheme);
      }
      return;
    }

    // First visit: force and persist dark mode as the product default.
    persistTheme("dark");
    if (theme !== "dark") {
      setTheme("dark");
    }
  }, [setTheme, theme]);
  
  const toggleLanguage = () => {
    setLanguage(prev => prev === 'en' ? 'fr' : 'en');
  };

  const toggleTheme = () => {
    const currentTheme = theme === "dark" ? "dark" : "light";
    const nextTheme = currentTheme === "light" ? "dark" : "light";
    persistTheme(nextTheme);
    setTheme(nextTheme);
  };

  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <Analytics />
          {!isInAppBrowser && <SpeedInsights />}
          <BrowserRouter>
            <AppContent
              language={language}
              toggleLanguage={toggleLanguage}
              theme={theme === "light" ? "light" : "dark"}
              toggleTheme={toggleTheme}
            />
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
};

export default App;
