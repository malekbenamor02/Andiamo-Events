import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { logPageView } from "@/lib/logger";

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
    
    // Log page view
    logPageView(pathname, 'guest');
  }, [pathname]);

  return null;
};

export default ScrollToTop; 