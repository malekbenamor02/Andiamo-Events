import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getApiBaseUrl } from "@/lib/api-routes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Store } from "lucide-react";

interface PosLoginProps {
  outletSlug: string;
  language: "en" | "fr";
}

export default function PosLogin({ outletSlug, language }: PosLoginProps) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const r = await fetch(`${getApiBaseUrl()}/api/pos/${outletSlug}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.success) {
        navigate(`/pos/${outletSlug}/dashboard`, { replace: true });
        return;
      }
      setError(d.error || (r.status === 401 ? (language === "en" ? "Invalid credentials" : "Identifiants invalides") : "Error"));
    } finally {
      setLoading(false);
    }
  };

  const t = language === "en"
    ? { title: "Point de Vente", subtitle: "Sign in", email: "Email", password: "Password", signIn: "Sign in" }
    : { title: "Point de Vente", subtitle: "Connexion", email: "Email", password: "Mot de passe", signIn: "Connexion" };

  return (
    <div className="min-h-screen bg-[#1A1A1A] flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-[#1F1F1F] border-[#2A2A2A]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Store className="w-6 h-6" style={{ color: "#E21836" }} />
            {t.title}
          </CardTitle>
          <p className="text-[#B0B0B0] text-sm">{t.subtitle}</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="pos-email" className="text-[#B0B0B0]">{t.email}</Label>
              <Input id="pos-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required className="mt-1 bg-[#252525] border-[#2A2A2A] text-white" autoComplete="email" />
            </div>
            <div>
              <Label htmlFor="pos-password" className="text-[#B0B0B0]">{t.password}</Label>
              <Input id="pos-password" type="password" value={password} onChange={e => setPassword(e.target.value)} required className="mt-1 bg-[#252525] border-[#2A2A2A] text-white" autoComplete="current-password" />
            </div>
            {error && <p className="text-[#EF4444] text-sm">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full bg-[#E21836] hover:bg-[#c4142e]">{loading ? "…" : t.signIn}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
