import React, { useState, useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { getApiBaseUrl } from "@/lib/api-routes";
import { API_ROUTES } from "@/lib/api-routes";
import ScannerLogin from "./ScannerLogin";
import ScannerEvents from "./ScannerEvents";
import ScannerScan from "./ScannerScan";
import ScannerHistory from "./ScannerHistory";

interface ScannerAppProps {
  language: "en" | "fr";
}

export default function ScannerApp({ language }: ScannerAppProps) {
  const location = useLocation();
  const [status, setStatus] = useState<"loading" | "disabled" | "enabled">("loading");

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${getApiBaseUrl()}${API_ROUTES.SCAN_SYSTEM_STATUS}`, { credentials: "include" });
        const d = await r.json().catch(() => ({}));
        setStatus(d.enabled ? "enabled" : "disabled");
      } catch {
        setStatus("disabled");
      }
    })();
  }, [location.pathname]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#1A1A1A] flex items-center justify-center">
        <p className="text-[#B0B0B0]">Loading…</p>
      </div>
    );
  }

  if (status === "disabled") {
    return (
      <div className="min-h-screen bg-[#1A1A1A] flex flex-col items-center justify-center p-6">
        <h1 className="text-xl font-semibold text-white mb-2">{language === "en" ? "Scan system is off" : "Le scan est désactivé"}</h1>
        <p className="text-[#B0B0B0] text-center">{language === "en" ? "Scan don't start yet. A super admin must turn it on." : "Le scan n'a pas encore démarré. Un super admin doit l'activer."}</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<ScannerEvents />} />
      <Route path="/login" element={<ScannerLogin />} />
      <Route path="/events" element={<ScannerEvents />} />
      <Route path="/scan" element={<ScannerScan />} />
      <Route path="/history" element={<ScannerHistory />} />
      <Route path="*" element={<ScannerEvents />} />
    </Routes>
  );
}
