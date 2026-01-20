import React, { useEffect } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import PosLogin from "./PosLogin";
import PosDashboard from "./PosDashboard";

interface PosAppProps {
  language: "en" | "fr";
}

export default function PosApp({ language }: PosAppProps) {
  const { outletSlug } = useParams<{ outletSlug: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const isDashboard = location.pathname.includes("/dashboard");

  // Canonical login URL: /pos/:slug/login — redirect /pos/:slug to /pos/:slug/login so the link always shows the login form (no outlet check)
  useEffect(() => {
    if (outletSlug && location.pathname === `/pos/${outletSlug}`) {
      navigate(`/pos/${outletSlug}/login`, { replace: true });
    }
  }, [outletSlug, location.pathname, navigate]);

  if (!outletSlug) {
    return <div className="min-h-screen bg-[#1A1A1A] flex items-center justify-center text-[#B0B0B0]">Invalid outlet</div>;
  }

  if (isDashboard) return <PosDashboard outletSlug={outletSlug} language={language} />;
  // Login form: shown for /pos/:slug and /pos/:slug/login regardless of whether the outlet exists in DB (outlet is validated only on submit)
  return <PosLogin outletSlug={outletSlug} language={language} />;
}
