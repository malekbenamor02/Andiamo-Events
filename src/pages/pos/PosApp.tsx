import React from "react";
import { useParams, useLocation } from "react-router-dom";
import PosLogin from "./PosLogin";
import PosDashboard from "./PosDashboard";

interface PosAppProps {
  language: "en" | "fr";
}

export default function PosApp({ language }: PosAppProps) {
  const { outletSlug } = useParams<{ outletSlug: string }>();
  const location = useLocation();
  const isDashboard = location.pathname.includes("/dashboard");

  if (!outletSlug) {
    return <div className="min-h-screen bg-[#1A1A1A] flex items-center justify-center text-[#B0B0B0]">Invalid outlet</div>;
  }

  if (isDashboard) return <PosDashboard outletSlug={outletSlug} language={language} />;
  return <PosLogin outletSlug={outletSlug} language={language} />;
}
