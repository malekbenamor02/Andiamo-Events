import { useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface NotFoundContent {
  title?: string;
  subtitle?: string;
  linkText?: string;
  [key: string]: string | undefined;
}

const NotFound = () => {
  const location = useLocation();
  const [notFoundContent, setNotFoundContent] = useState<NotFoundContent>({});

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
          .select('*')
          .eq('key', 'not_found');

        if (error) throw error;
        if (data && data[0]) {
          setNotFoundContent(data[0].content as NotFoundContent);
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
  }, [location.pathname]);

  const content = notFoundContent.title ? notFoundContent : {
    title: "404",
    subtitle: "Oops! Page not found",
    linkText: "Return to Home"
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4 text-foreground">{content.title}</h1>
        <p className="text-xl text-muted-foreground mb-4">{content.subtitle}</p>
        <a href="/" className="text-primary hover:text-primary/80 underline">
          {content.linkText}
        </a>
      </div>
    </div>
  );
};

export default NotFound;
