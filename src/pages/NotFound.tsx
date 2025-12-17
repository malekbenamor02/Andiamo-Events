import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft, Search, Sparkles, Zap, Star, Heart } from "lucide-react";

interface NotFoundContent {
  title?: string;
  subtitle?: string;
  linkText?: string;
  [key: string]: string | undefined;
}

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [notFoundContent, setNotFoundContent] = useState<NotFoundContent>({});
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    // Log 404 error
    logger.warning(`404 Error: Page not found - ${location.pathname}`, {
      category: 'error',
      details: {
        path: location.pathname,
        type: '404'
      }
    });

    const fetchContent = async () => {
      try {
        const { data, error } = await supabase
          .from('site_content')
          .select('content')
          .eq('key', 'not_found')
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching not found content:', error);
        } else if (data && data.content) {
          setNotFoundContent(data.content as NotFoundContent);
        }
      } catch (error) {
        console.error('Error fetching not found content:', error);
        logger.error('Error fetching 404 page content', error, {
          category: 'database',
          details: { path: location.pathname }
        });
      }
    };

    fetchContent();
    
    // Trigger animation
    setTimeout(() => setAnimated(true), 100);
  }, [location.pathname]);

  const content = notFoundContent.title ? notFoundContent : {
    title: "404",
    subtitle: "Oops! Page not found",
    linkText: "Return to Home"
  };

  return (
    <div className="min-h-screen bg-background pt-16 relative overflow-hidden flex items-center justify-center">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Gradient Orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-primary/20 rounded-full blur-3xl animate-pulse delay-1000" style={{ animationDuration: '5s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary/15 rounded-full blur-3xl animate-pulse delay-2000" style={{ animationDuration: '6s' }} />
        
        {/* Floating Icons */}
        <div className="absolute top-20 left-20 animate-float">
          <Sparkles className="w-8 h-8 text-primary/30" />
        </div>
        <div className="absolute top-40 right-32 animate-float delay-1000">
          <Star className="w-6 h-6 text-primary/30" />
        </div>
        <div className="absolute bottom-32 left-40 animate-float delay-2000">
          <Zap className="w-7 h-7 text-primary/30" />
        </div>
        <div className="absolute bottom-20 right-20 animate-float delay-500">
          <Heart className="w-5 h-5 text-primary/30" />
        </div>
        
        {/* Grid Pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)`,
          backgroundSize: '30px 30px',
        }} />
      </div>

      {/* Main Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className={`transform transition-all duration-1000 ease-out ${
          animated ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-12 scale-95'
        }`}>
          {/* 404 Number - Large and Animated */}
          <div className="relative mb-8">
            <h1 className="text-9xl md:text-[12rem] font-heading font-bold text-gradient-neon leading-none mb-4 animate-pulse-glow">
              404
            </h1>
            {/* Glow effect behind 404 */}
            <div className="absolute inset-0 text-9xl md:text-[12rem] font-heading font-bold text-primary/20 blur-2xl -z-10 animate-pulse" />
          </div>

          {/* Error Message */}
          <div className="space-y-6 mb-12">
            <div className="inline-block mb-4">
              <span className="text-sm md:text-base font-semibold text-primary px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
                Page Not Found
              </span>
            </div>
            
            <h2 className="text-3xl md:text-5xl font-heading font-bold text-gradient-neon mb-4">
              {content.title === "404" ? "Lost in the Night?" : content.title}
            </h2>
            
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              {content.subtitle || "The page you're looking for doesn't exist or has been moved. Let's get you back to the party!"}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
            <Button
              onClick={() => navigate('/')}
              size="lg"
              className="btn-gradient text-lg px-8 py-6 font-heading font-semibold transform hover:scale-105 transition-all duration-300 hover:shadow-2xl"
            >
              <Home className="w-5 h-5 mr-2" />
              {content.linkText || "Go Home"}
            </Button>
            
            <Button
              onClick={() => navigate(-1)}
              variant="outline"
              size="lg"
              className="text-lg px-8 py-6 font-heading font-semibold border-2 border-primary/30 hover:border-primary hover:bg-primary/10 transform hover:scale-105 transition-all duration-300"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Go Back
            </Button>
          </div>

          {/* Quick Links */}
          <div className="mt-16 pt-8 border-t border-border/20">
            <p className="text-sm text-muted-foreground mb-4">Or explore our site:</p>
            <div className="flex flex-wrap justify-center gap-3">
              {[
                { name: "Events", path: "/events" },
                { name: "About", path: "/about" },
                { name: "Contact", path: "/contact" },
                { name: "Ambassador", path: "/ambassador" }
              ].map((link) => (
                <Button
                  key={link.path}
                  variant="ghost"
                  onClick={() => navigate(link.path)}
                  className="font-heading hover:text-primary transition-colors"
                >
                  {link.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Decorative Elements */}
          <div className="absolute -top-10 -left-10 w-20 h-20 bg-primary/10 rounded-full blur-xl animate-pulse" />
          <div className="absolute -bottom-10 -right-10 w-16 h-16 bg-primary/10 rounded-full blur-xl animate-pulse delay-1000" />
        </div>
      </div>
    </div>
  );
};

export default NotFound;
