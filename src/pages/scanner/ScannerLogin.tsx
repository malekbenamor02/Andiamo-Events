import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiBaseUrl } from "@/lib/api-routes";
import { API_ROUTES } from "@/lib/api-routes";

export default function ScannerLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Email and password required");
      return;
    }
    setLoading(true);
    try {
      const r = await fetch(`${getApiBaseUrl()}${API_ROUTES.SCANNER_LOGIN}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
        credentials: "include",
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.success) {
        navigate("/scanner/events", { replace: true });
        return;
      }
      setError(d.error || "Invalid credentials");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1A1A1A] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl bg-[#1F1F1F] border border-[#2A2A2A] p-6">
        <h1 className="text-xl font-semibold text-white mb-4 text-center">Scanner Login</h1>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label className="text-[#B0B0B0]">Email</Label>
            <Input className="mt-1 bg-[#252525] border-[#2A2A2A] text-white" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required />
          </div>
          <div>
            <Label className="text-[#B0B0B0]">Password</Label>
            <Input className="mt-1 bg-[#252525] border-[#2A2A2A] text-white" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
          </div>
          {error && <p className="text-sm text-[#EF4444]">{error}</p>}
          <Button type="submit" className="w-full bg-[#E21836] hover:bg-[#c4142e]" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</Button>
        </form>
      </div>
    </div>
  );
}
