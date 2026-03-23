/**
 * Admin Dashboard â€” Marketing tab (SMS + Email).
 * Extracted from Dashboard.tsx for maintainability.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import Loader from "@/components/ui/Loader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { PhoneCall, Mail, CreditCard, Download, Upload, Send, RefreshCw, FileText, Info, Phone, CheckCircle, XCircle, Clock, Pencil, BarChart2, Pause } from "lucide-react";
import { BulkSmsSelector } from "@/components/admin/BulkSmsSelector";
import { EmailCampaignEditor } from "@/components/admin/marketing/EmailCampaignEditor";
import { EmailCampaignLauncher } from "@/components/admin/marketing/EmailCampaignLauncher";
import { EmailCampaignStats } from "@/components/admin/marketing/EmailCampaignStats";
import { API_ROUTES, buildFullApiUrl } from "@/lib/api-routes";
import type { MarketingCampaign } from "@/types/bulk-sms";

export interface MarketingTabProps {
  language: "en" | "fr";
  marketingSubTab: "sms" | "email";
  setMarketingSubTab: (v: "sms" | "email") => void;
  emailSubscribers: Array<{ id: string; email: string; subscribed_at: string; language?: string }>;
  fetchEmailSubscribers: () => void;
  loadingBalance: boolean;
  smsBalance: { balance?: unknown } | null;
  fetchSmsBalance: () => void;
  testPhoneNumber: string;
  setTestPhoneNumber: (v: string) => void;
  testSmsMessage: string;
  setTestSmsMessage: (v: string) => void;
  handleSendTestSms: () => void;
  sendingTestSms: boolean;
  phoneSubscribers: Array<{ id: string; phone_number: string; subscribed_at: string; city?: string }>;
  handleExportPhones: () => void;
  showImportDialog: boolean;
  setShowImportDialog: (v: boolean) => void;
  handleImportPhonesFromExcel: (file: File) => void;
  importingPhones: boolean;
  loadingLogs: boolean;
  smsLogs: Array<{ id: string; phone_number: string; message: string; status: string; error_message?: string; sent_at?: string; created_at: string; api_response?: unknown; source?: string }>;
  fetchSmsLogs: () => void;
  fetchPhoneSubscribers: () => void;
  loadingEmailSubscribers: boolean;
  handleExportEmails: () => void;
  showEmailImportDialog: boolean;
  setShowEmailImportDialog: (v: boolean) => void;
  handleImportEmailsFromExcel: (file: File) => void;
  importingEmails: boolean;
  emailSubject: string;
  setEmailSubject: (v: string) => void;
  emailContent: string;
  setEmailContent: (v: string) => void;
  testEmailAddress: string;
  setTestEmailAddress: (v: string) => void;
  handleSendTestEmail: () => void;
  sendingTestEmail: boolean;
  emailDelaySeconds: number;
  setEmailDelaySeconds: (v: number) => void;
  handleSendBulkEmails: () => void;
  sendingBulkEmails: boolean;
  getSourceDisplayName: (source: unknown, lang: string) => string;
}

export function MarketingTab(p: MarketingTabProps) {
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [sendingOneBatchId, setSendingOneBatchId] = useState<string | null>(null);
  const [resumingId, setResumingId] = useState<string | null>(null);
  const cancelResumeRef = useRef(false);
  const [emailEditorOpen, setEmailEditorOpen] = useState(false);
  const [emailEditorCampaignId, setEmailEditorCampaignId] = useState<string | null>(null);
  const [launchDraftId, setLaunchDraftId] = useState<string | null>(null);
  const [statsCampaignId, setStatsCampaignId] = useState<string | null>(null);
  const campaignsFetchGenRef = useRef(0);

  const fetchCampaigns = useCallback(async () => {
    const gen = ++campaignsFetchGenRef.current;
    const url = buildFullApiUrl(API_ROUTES.MARKETING_CAMPAIGNS);
    if (!url) return;
    try {
      const res = await fetch(url, {
        credentials: "include",
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" }
      });
      const data = await res.json();
      if (gen !== campaignsFetchGenRef.current) return;
      if (data.success && Array.isArray(data.data)) setCampaigns(data.data);
    } catch {
      if (gen === campaignsFetchGenRef.current) setCampaigns([]);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  useEffect(() => {
    if (p.marketingSubTab === "email") fetchCampaigns();
  }, [p.marketingSubTab, fetchCampaigns]);

  const pauseCampaign = async (campaignId: string) => {
    try {
      await fetch(buildFullApiUrl(API_ROUTES.MARKETING_CAMPAIGN(campaignId)), {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "paused" }),
      });
      await fetchCampaigns();
    } catch {
      /* ignore */
    }
  };

  const resumeEmailScheduling = async (campaignId: string) => {
    try {
      await fetch(buildFullApiUrl(API_ROUTES.MARKETING_CAMPAIGN(campaignId)), {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "scheduled" }),
      });
      await fetchCampaigns();
    } catch {
      /* ignore */
    }
  };

  /** SMS campaigns only — email sending is driven by server cron + daily cap. */
  const handleSendOneBatchSms = async (campaignId: string) => {
    if (sendingOneBatchId || resumingId) return;
    setSendingOneBatchId(campaignId);
    try {
      await fetch(buildFullApiUrl(API_ROUTES.MARKETING_CAMPAIGN_SEND_BATCH(campaignId)), {
        method: "POST",
        credentials: "include",
      });
      await fetchCampaigns();
    } finally {
      setSendingOneBatchId(null);
    }
  };

  const handleResumeAutoSms = async (c: MarketingCampaign) => {
    if (c.type !== "sms" || (c.counts?.pending ?? 0) <= 0 || resumingId || sendingOneBatchId) return;
    cancelResumeRef.current = false;
    setResumingId(c.id);
    const batchDelayMs =
      c.batch_delay_minutes != null && c.batch_delay_minutes >= 0
        ? Math.round(c.batch_delay_minutes * 60 * 1000)
        : 2 * 60 * 1000;
    try {
      if (c.status === "paused") {
        await fetch(buildFullApiUrl(API_ROUTES.MARKETING_CAMPAIGN(c.id)), {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "sending" as const }),
        });
        await fetchCampaigns();
      }
      for (;;) {
        if (cancelResumeRef.current) break;
        const res = await fetch(buildFullApiUrl(API_ROUTES.MARKETING_CAMPAIGN_SEND_BATCH(c.id)), {
          method: "POST",
          credentials: "include",
        });
        const data = await res.json();
        await fetchCampaigns();
        if (!data.success) break;
        const remaining = data.data?.remaining ?? 0;
        if (remaining <= 0) break;
        await new Promise((r) => setTimeout(r, batchDelayMs));
      }
    } finally {
      setResumingId(null);
      cancelResumeRef.current = false;
    }
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString(p.language === "en" ? "en-US" : "fr-FR", {
      dateStyle: "short",
      timeStyle: "short",
    });

  return (
    <TabsContent value="marketing" className="space-y-6">
                {/* Campaign results: always visible */}
                <Card>
                  <CardHeader className="pb-2 flex flex-row flex-wrap items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">
                        {p.language === "en" ? "Campaign results" : "Résultats des campagnes"}
                      </CardTitle>
                      <CardDescription>
                        {p.language === "en"
                          ? "Sent / failed / remaining. Email sends run on your Supabase schedule (marketing-email-tick), up to the per-day cap (UTC), then continue the next day. Pause / Resume scheduling for email."
                          : "Envoyés / échoués / restants. Les emails partent via le job Supabase (marketing-email-tick), plafond/jour UTC. Pause / Reprendre l’envoi planifié pour l’email."}
                      </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => fetchCampaigns()}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      {p.language === "en" ? "Refresh" : "Actualiser"}
                    </Button>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    {campaigns.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        {p.language === "en" ? "No campaigns yet." : "Aucune campagne pour le moment."}
                      </p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-muted-foreground">
                            <th className="py-2 pr-2">{p.language === "en" ? "Date" : "Date"}</th>
                            <th className="py-2 pr-2">{p.language === "en" ? "Type" : "Type"}</th>
                            <th className="py-2 pr-2 min-w-[140px]">{p.language === "en" ? "Subject / name" : "Sujet / nom"}</th>
                            <th className="py-2 pr-2">{p.language === "en" ? "Status" : "Statut"}</th>
                            <th className="py-2 pr-1 text-green-600">OK</th>
                            <th className="py-2 pr-1 text-destructive">Fail</th>
                            <th className="py-2 pr-1">{p.language === "en" ? "Pending" : "En attente"}</th>
                            <th className="py-2 pr-2">{p.language === "en" ? "Total" : "Total"}</th>
                            <th className="py-2">{p.language === "en" ? "Actions" : "Actions"}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {campaigns.map((c) => {
                            const pending = c.counts?.pending ?? 0;
                            const canResume =
                              pending > 0 &&
                              (c.status === "sending" || c.status === "scheduled" || c.status === "paused");
                            const canResumeSms = canResume && c.type === "sms";
                            const emailPausedResume =
                              c.type === "email" && c.status === "paused" && pending > 0;
                            const canPause =
                              c.type === "email" &&
                              pending > 0 &&
                              (c.status === "sending" || c.status === "scheduled");
                            return (
                              <tr key={c.id} className="border-b border-border/60">
                                <td className="py-2 pr-2 whitespace-nowrap">{fmtDate(c.created_at)}</td>
                                <td className="py-2 pr-2 uppercase">{c.type}</td>
                                <td
                                  className="py-2 pr-2 max-w-[200px] truncate"
                                  title={
                                    c.type === "email"
                                      ? [c.name?.trim(), c.subject].filter(Boolean).join(" — ") || ""
                                      : c.body
                                        ? c.body.slice(0, 80) + (c.body.length > 80 ? "…" : "")
                                        : c.name || ""
                                  }
                                >
                                  {c.type === "email"
                                    ? (c.name?.trim()
                                        ? `${c.name.trim()} · ${c.subject || "—"}`
                                        : c.subject || "—")
                                    : c.name || (c.body ? (c.body.length > 50 ? c.body.slice(0, 50) + "…" : c.body) : "SMS")}
                                </td>
                                <td className="py-2 pr-2">{c.status}</td>
                                <td className="py-2 pr-1">{c.counts?.sent ?? 0}</td>
                                <td className="py-2 pr-1">{c.counts?.failed ?? 0}</td>
                                <td className="py-2 pr-1">{pending}</td>
                                <td className="py-2 pr-2">{c.counts?.total ?? 0}</td>
                                <td className="py-2">
                                  <div className="flex flex-wrap gap-1">
                                    {c.type === "email" && c.status === "draft" && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setEmailEditorCampaignId(c.id);
                                          setEmailEditorOpen(true);
                                        }}
                                      >
                                        <Pencil className="w-3 h-3 mr-1" />
                                        {p.language === "en" ? "Edit" : "Modifier"}
                                      </Button>
                                    )}
                                    {c.type === "email" && (c.counts?.total ?? 0) > 0 && c.status !== "draft" && (
                                      <Button
                                        size="sm"
                                        variant={statsCampaignId === c.id ? "secondary" : "ghost"}
                                        onClick={() =>
                                          setStatsCampaignId((id) => (id === c.id ? null : c.id))
                                        }
                                      >
                                        <BarChart2 className="w-3 h-3 mr-1" />
                                        {p.language === "en" ? "Stats" : "Stats"}
                                      </Button>
                                    )}
                                    {canPause && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={!!resumingId || !!sendingOneBatchId}
                                        onClick={() => pauseCampaign(c.id)}
                                      >
                                        <Pause className="w-3 h-3 mr-1" />
                                        {p.language === "en" ? "Pause" : "Pause"}
                                      </Button>
                                    )}
                                    {emailPausedResume && (
                                      <Button
                                        size="sm"
                                        variant="secondary"
                                        disabled={!!resumingId || !!sendingOneBatchId}
                                        onClick={() => resumeEmailScheduling(c.id)}
                                      >
                                        {p.language === "en" ? "Resume scheduling" : "Reprendre l’envoi planifié"}
                                      </Button>
                                    )}
                                    {canResumeSms && (
                                      <>
                                        <Button
                                          size="sm"
                                          variant="secondary"
                                          disabled={!!resumingId || !!sendingOneBatchId}
                                          onClick={() => handleResumeAutoSms(c)}
                                        >
                                          {resumingId === c.id ? (
                                            <><Loader size="sm" className="mr-1" />{p.language === "en" ? "Auto…" : "Auto…"}</>
                                          ) : (
                                            p.language === "en" ? "Resume auto" : "Reprendre auto"
                                          )}
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          disabled={!!resumingId || !!sendingOneBatchId}
                                          onClick={() => handleSendOneBatchSms(c.id)}
                                        >
                                          {sendingOneBatchId === c.id ? (
                                            <Loader size="sm" />
                                          ) : (
                                            p.language === "en" ? "Send next group" : "Envoyer le groupe suivant"
                                          )}
                                        </Button>
                                        {resumingId === c.id && (
                                          <Button size="sm" variant="ghost" onClick={() => { cancelResumeRef.current = true; }}>
                                            {p.language === "en" ? "Stop" : "Arrêt"}
                                          </Button>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                    {statsCampaignId && (
                      <div className="mt-4 px-2">
                        <EmailCampaignStats
                          language={p.language}
                          campaignId={statsCampaignId}
                          onClose={() => setStatsCampaignId(null)}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Sub-tabs for SMS and Email Marketing */}
                <Tabs value={p.marketingSubTab} onValueChange={(value) => {
                  p.setMarketingSubTab(value as 'sms' | 'email');
                  // Fetch email subscribers when switching to email tab
                  if (value === 'email' && p.emailSubscribers.length === 0) {
                    p.fetchEmailSubscribers();
                  }
                }} className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="sms" className="flex items-center gap-2">
                      <PhoneCall className="w-4 h-4" />
                      {p.language === 'en' ? 'SMS Marketing' : 'Marketing SMS'}
                    </TabsTrigger>
                    <TabsTrigger value="email" className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      {p.language === 'en' ? 'Email Marketing' : 'Marketing Email'}
                    </TabsTrigger>
                  </TabsList>

                  {/* SMS Marketing Tab */}
                  <TabsContent value="sms" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full px-2">
                  {/* SMS Balance Card */}
                  <div className="animate-in slide-in-from-bottom-4 fade-in duration-700">
                    <Card className="shadow-lg h-full flex flex-col">
                      <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                          <CreditCard className="w-5 h-5 text-primary" />
                          {p.language === 'en' ? 'SMS Balance' : 'Solde SMS'}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="flex-1 flex flex-col space-y-4">
                        {p.loadingBalance ? (
                          <div className="flex flex-col items-center justify-center py-8 space-y-3">
                            <Loader size="lg" />
                            <p className="text-sm text-muted-foreground font-heading">
                              {p.language === 'en' ? 'Checking balance...' : 'VÃ©rification du solde...'}
                            </p>
                          </div>
                        ) : p.smsBalance?.balance ? (
                          <>
                            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border">
                              <div className="flex-1">
                                <p className="text-sm text-muted-foreground font-heading">{p.language === 'en' ? 'Current Balance' : 'Solde Actuel'}</p>
                                {typeof p.smsBalance.balance === 'object' ? (
                                    <div className="mt-1">
                                    <p className="text-2xl font-heading font-bold text-primary">
                                        {p.smsBalance.balance.balance || p.smsBalance.balance.solde || p.smsBalance.balance.credit || 'N/A'}
                                      </p>
                                      {p.smsBalance.balance.balance === 0 || p.smsBalance.balance.solde === 0 || p.smsBalance.balance.credit === 0 ? (
                                      <p className="text-xs text-red-500 mt-1 font-heading">
                                          Ã¢Å¡Â Ã¯Â¸Â {p.language === 'en' ? 'Insufficient balance!' : 'Solde insuffisant!'}
                                        </p>
                                      ) : null}
                                    </div>
                                  ) : (
                                  <p className="text-2xl font-heading font-bold text-primary mt-1">
                                      {p.smsBalance.balance}
                                      {p.smsBalance.balance === '0' || p.smsBalance.balance === 0 ? (
                                        <span className="text-xs text-red-500 ml-2">
                                          Ã¢Å¡Â Ã¯Â¸Â {p.language === 'en' ? 'Insufficient!' : 'Insuffisant!'}
                                        </span>
                                      ) : null}
                                  </p>
                                )}
                              </div>
                            </div>
                            <Button
                              onClick={p.fetchSmsBalance}
                              disabled={p.loadingBalance}
                              variant="outline"
                              size="sm"
                              className="w-full font-heading"
                            >
                                <RefreshCw className="w-4 h-4 mr-2" />
                              {p.language === 'en' ? 'Refresh Balance' : 'Actualiser le Solde'}
                            </Button>
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-8 space-y-4">
                            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                              <CreditCard className="w-8 h-8 text-primary" />
                            </div>
                            <p className="text-sm text-muted-foreground text-center font-heading">
                              {p.language === 'en' 
                                ? 'Click the button below to check your SMS balance' 
                                : 'Cliquez sur le bouton ci-dessous pour vÃƒÂ©rifier votre solde SMS'}
                            </p>
                            <Button
                              onClick={p.fetchSmsBalance}
                              disabled={p.loadingBalance}
                              className="w-full font-heading btn-gradient"
                              size="lg"
                            >
                              <CreditCard className="w-5 h-5 mr-2" />
                              {p.language === 'en' ? 'Check SMS Balance' : 'VÃƒÂ©rifier le Solde SMS'}
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Test SMS Card */}
                  <div className="animate-in slide-in-from-bottom-4 fade-in duration-700 delay-200">
                    <Card className="shadow-lg h-full flex flex-col">
                      <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                          <PhoneCall className="w-5 h-5 text-primary" />
                          {p.language === 'en' ? 'Test SMS' : 'SMS Test'}
                        </CardTitle>
                        <p className="text-sm text-foreground/70 mt-2">
                          {p.language === 'en' 
                            ? 'Test SMS functionality with a specific phone number'
                            : 'Tester la fonctionnalitÃƒÂ© SMS avec un numÃƒÂ©ro de tÃƒÂ©lÃƒÂ©phone spÃƒÂ©cifique'}
                        </p>
                      </CardHeader>
                      <CardContent className="flex-1 flex flex-col space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="testPhone">{p.language === 'en' ? 'Phone Number' : 'NumÃƒÂ©ro de TÃƒÂ©lÃƒÂ©phone'} *</Label>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground font-heading">+216</span>
                            <Input
                              id="testPhone"
                              type="text"
                              value={p.testPhoneNumber}
                              onChange={(e) => p.setTestPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 8))}
                              placeholder="21234567"
                              className="flex-1 font-heading"
                              maxLength={8}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground font-heading">
                            {p.language === 'en' ? 'Enter 8 digits (e.g., 21234567)' : 'Entrez 8 chiffres (ex: 21234567)'}
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="testMessage">{p.language === 'en' ? 'Test Message' : 'Message Test'} *</Label>
                          <Textarea
                            id="testMessage"
                            value={p.testSmsMessage}
                            onChange={(e) => p.setTestSmsMessage(e.target.value)}
                            placeholder=""
                            className="min-h-[100px] text-sm bg-background text-foreground font-heading"
                          />
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{p.language === 'en' ? 'Characters' : 'CaractÃƒÂ¨res'}: {p.testSmsMessage.length}</span>
                            <span>{p.language === 'en' ? 'Approx. messages' : 'Messages approx.'}: {Math.ceil(p.testSmsMessage.length / 160)}</span>
                          </div>
                        </div>
                        <Button
                          onClick={p.handleSendTestSms}
                          disabled={p.sendingTestSms || !p.testPhoneNumber.trim() || !p.testSmsMessage.trim()}
                          className="w-full font-heading btn-gradient"
                          size="lg"
                        >
                          {p.sendingTestSms ? (
                            <>
                              <Loader size="sm" className="mr-2" />
                              {p.language === 'en' ? 'Sending...' : 'Envoi...'}
                            </>
                          ) : (
                            <>
                              <Send className="w-5 h-5 mr-2" />
                              {p.language === 'en' ? 'Send Test SMS' : 'Envoyer SMS Test'}
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Export/Import Phone Subscribers Card */}
                  <div className="animate-in slide-in-from-bottom-4 fade-in duration-700 delay-400">
                    <Card className="shadow-lg h-full flex flex-col">
                      <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                          <Download className="w-5 h-5 text-primary" />
                          {p.language === 'en' ? 'Export/Import Phone Subscribers' : 'Exporter/Importer AbonnÃ©s'}
                        </CardTitle>
                        <p className="text-sm text-foreground/70 mt-2">
                          {p.language === 'en' 
                            ? `Export or import phone subscribers from Excel`
                            : `Exporter ou importer des abonnÃƒÂ©s tÃƒÂ©lÃƒÂ©phone depuis Excel`}
                        </p>
                      </CardHeader>
                      <CardContent className="flex-1 flex flex-col space-y-4">
                        {/* Subscriber Count */}
                        <div className="p-3 bg-muted/30 rounded-lg border border-border">
                          <div className="text-sm font-semibold text-foreground mb-1">
                            {p.language === 'en' ? 'Subscribers Count' : "Nombre d'AbonnÃ©s"}
                          </div>
                          <div className="text-2xl font-bold text-primary">
                            {p.phoneSubscribers.length}
                          </div>
                        </div>

                        {/* Export/Import Buttons */}
                        <div className="flex gap-2">
                          <Button
                            onClick={p.handleExportPhones}
                            disabled={p.phoneSubscribers.length === 0}
                            variant="outline"
                            size="sm"
                            className="flex-1"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            {p.language === 'en' ? 'Export Excel' : 'Exporter Excel'}
                          </Button>
                          <Dialog open={p.showImportDialog} onOpenChange={p.setShowImportDialog}>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                              >
                                <Upload className="w-4 h-4 mr-2" />
                                {p.language === 'en' ? 'Import Excel' : 'Importer Excel'}
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>
                                  {p.language === 'en' ? 'Import Phone Numbers from Excel' : 'Importer des NumÃƒÂ©ros depuis Excel'}
                                </DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                {/* Instructions */}
                                <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                                  <div className="flex items-start gap-2">
                                    <Info className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                                    <div className="space-y-2 text-sm">
                                      <p className="font-semibold">
                                        {p.language === 'en' ? 'Excel File Format:' : 'Format du Fichier Excel:'}
                                      </p>
                                      <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-2">
                                        <li>
                                          {p.language === 'en' 
                                            ? 'First column: Phone Number (8 digits, starts with 2, 4, 5, or 9)'
                                            : 'PremiÃƒÂ¨re colonne: NumÃƒÂ©ro de tÃƒÂ©lÃƒÂ©phone (8 chiffres, commence par 2, 4, 5 ou 9)'}
                                        </li>
                                        <li>
                                          {p.language === 'en' 
                                            ? 'First row should be headers (will be skipped)'
                                            : 'La premiÃƒÂ¨re ligne doit contenir les en-tÃƒÂªtes (sera ignorÃƒÂ©e)'}
                                        </li>
                                        <li>
                                          {p.language === 'en' 
                                            ? 'Duplicate numbers will be automatically skipped'
                                            : 'Les numÃƒÂ©ros en double seront automatiquement ignorÃƒÂ©s'}
                                        </li>
                                        <li>
                                          {p.language === 'en' 
                                            ? 'Subscription time will be set automatically to import time'
                                            : 'La date d\'abonnement sera dÃƒÂ©finie automatiquement ÃƒÂ  l\'heure d\'importation'}
                                        </li>
                                      </ul>
                                      <div className="mt-3 p-2 bg-background rounded border border-border">
                                        <p className="font-semibold text-xs mb-1">
                                          {p.language === 'en' ? 'Example:' : 'Exemple:'}
                                        </p>
                                        <pre className="text-xs text-muted-foreground">
                                          {p.language === 'en' 
                                            ? 'Phone Number\n27169458\n98765432'
                                            : 'NumÃƒÂ©ro de TÃƒÂ©lÃƒÂ©phone\n27169458\n98765432'}
                                        </pre>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* File Upload */}
                                <div className="space-y-2">
                                  <Label>
                                    {p.language === 'en' ? 'Select Excel File (.xlsx)' : 'SÃƒÂ©lectionner un Fichier Excel (.xlsx)'}
                                  </Label>
                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="file"
                                      accept=".xlsx,.xls"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          p.handleImportPhonesFromExcel(file);
                                        }
                                      }}
                                      disabled={p.importingPhones}
                                      className="flex-1"
                                    />
                                  </div>
                                  {p.importingPhones && (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                      <Loader size="sm" />
                                      {p.language === 'en' ? 'Importing...' : 'Importation...'}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Bulk SMS Selector */}
                  <div className="animate-in slide-in-from-bottom-4 fade-in duration-700 delay-600 lg:col-span-2">
                    <BulkSmsSelector
                      language={p.language}
                      onSendComplete={() => {
                        p.fetchSmsLogs();
                        p.fetchPhoneSubscribers();
                      }}
                      onCampaignProgress={fetchCampaigns}
                    />
                  </div>

                  {/* SMS Logs Card */}
                  <div className="animate-in slide-in-from-bottom-4 fade-in duration-700 lg:col-span-3">
                    <Card className="shadow-lg h-full flex flex-col">
                      <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                          <FileText className="w-5 h-5 text-primary" />
                          {p.language === 'en' ? 'SMS Logs' : 'Journal SMS'}
                        </CardTitle>
                        <p className="text-sm text-foreground/70 mt-2">
                          {p.language === 'en' 
                            ? 'Recent SMS sending history and errors'
                            : 'Historique rÃƒÂ©cent d\'envoi SMS et erreurs'}
                        </p>
                      </CardHeader>
                      <CardContent className="flex-1 flex flex-col space-y-4">
                        {p.loadingLogs ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader size="md" />
                          </div>
                        ) : (
                          <>
                            <div className="flex justify-end">
                              <Button
                                onClick={p.fetchSmsLogs}
                                variant="outline"
                                size="sm"
                              >
                                <RefreshCw className="w-4 h-4 mr-2" />
                                {p.language === 'en' ? 'Refresh' : 'Actualiser'}
                              </Button>
                            </div>
                            {p.smsLogs.length === 0 ? (
                              <div className="text-center py-8 text-muted-foreground">
                                <p>{p.language === 'en' ? 'No SMS logs yet' : 'Aucun journal SMS pour le moment'}</p>
                              </div>
                            ) : (
                              <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar">
                                {p.smsLogs.map((log) => {
                                  const logWithApiResponse = log as typeof log & { api_response?: any };
                                  
                                  // Parse API response to check actual status
                                  let apiResponseParsed: any = null;
                                  let actualStatus = log.status;
                                  let apiMessage = '';
                                  
                                  if (logWithApiResponse.api_response) {
                                    try {
                                      apiResponseParsed = typeof logWithApiResponse.api_response === 'string' 
                                        ? JSON.parse(logWithApiResponse.api_response)
                                        : logWithApiResponse.api_response;
                                      
                                      // Check if API says success but log says failed (fix incorrect status)
                                      if (apiResponseParsed.code === 'ok' || 
                                          apiResponseParsed.code === '200' ||
                                          (apiResponseParsed.message && apiResponseParsed.message.toLowerCase().includes('successfully'))) {
                                        actualStatus = 'sent';
                                        apiMessage = apiResponseParsed.message || 'Successfully sent';
                                      }
                                    } catch (e) {
                                      // Keep original status if parsing fails
                                    }
                                  }
                                  
                                  const isSuccess = actualStatus === 'sent';
                                  
                                  return (
                                  <div
                                    key={log.id}
                                    className={`p-4 rounded-lg border transition-all duration-300 hover:shadow-md ${
                                      isSuccess
                                        ? 'bg-green-500/10 border-green-500/30 hover:border-green-500/50'
                                        : log.status === 'failed'
                                        ? 'bg-red-500/10 border-red-500/30 hover:border-red-500/50'
                                        : 'bg-yellow-500/10 border-yellow-500/30 hover:border-yellow-500/50'
                                    }`}
                                  >
                                    <div className="flex items-start gap-3">
                                      {/* Status Icon */}
                                      <div className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                                        isSuccess 
                                          ? 'bg-green-500/20' 
                                          : log.status === 'failed'
                                          ? 'bg-red-500/20'
                                          : 'bg-yellow-500/20'
                                      }`}>
                                        {isSuccess ? (
                                          <CheckCircle className="w-5 h-5 text-green-500" />
                                        ) : log.status === 'failed' ? (
                                          <XCircle className="w-5 h-5 text-red-500" />
                                        ) : (
                                          <Clock className="w-5 h-5 text-yellow-500" />
                                        )}
                                      </div>
                                      
                                      <div className="flex-1 min-w-0">
                                        {/* Header with Status and Phone */}
                                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                                          <Badge
                                            variant={isSuccess ? 'default' : log.status === 'failed' ? 'destructive' : 'secondary'}
                                            className={
                                              isSuccess
                                                ? 'bg-green-500/20 text-green-300 border-green-500/30'
                                                : log.status === 'failed'
                                                ? 'bg-red-500/20 text-red-300 border-red-500/30'
                                                : 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
                                            }
                                          >
                                            {isSuccess
                                              ? (p.language === 'en' ? 'Sent' : 'EnvoyÃƒÂ©')
                                              : log.status === 'failed'
                                              ? (p.language === 'en' ? 'Failed' : 'Ãƒâ€°chouÃƒÂ©')
                                              : (p.language === 'en' ? 'Pending' : 'En Attente')}
                                          </Badge>
                                          <div className="flex items-center gap-1.5 text-sm font-medium">
                                            <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                                            <span className="font-mono">+216 {log.phone_number}</span>
                                          </div>
                                          {(log as any).source && (
                                            <Badge variant="outline" className="text-xs">
                                              {p.getSourceDisplayName((log as any).source as any, p.language)}
                                            </Badge>
                                          )}
                                        </div>
                                        
                                        {/* Message */}
                                        <div className="mb-3">
                                          <p className="text-sm text-foreground/90 leading-relaxed">
                                            {log.message}
                                          </p>
                                        </div>
                                        
                                        {/* Success Message (if API says success) */}
                                        {isSuccess && apiMessage && (
                                          <div className="mb-2 p-2 bg-green-500/20 rounded-md border border-green-500/30">
                                            <div className="flex items-center gap-1.5 text-xs text-green-300">
                                              <CheckCircle className="w-3.5 h-3.5" />
                                              <span className="font-medium">{apiMessage}</span>
                                            </div>
                                          </div>
                                        )}
                                        
                                        {/* Error Message */}
                                        {log.error_message && !isSuccess && (
                                          <div className="mb-2 p-2 bg-red-500/20 rounded-md border border-red-500/30">
                                            <div className="flex items-start gap-1.5">
                                              <XCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />
                                              <div className="text-xs text-red-300">
                                                <span className="font-medium">{p.language === 'en' ? 'Error' : 'Erreur'}: </span>
                                                <span>{log.error_message}</span>
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                        
                                        {/* API Response Details */}
                                        {logWithApiResponse.api_response && (
                                          <details className="mt-2 group">
                                            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors flex items-center gap-1.5 list-none">
                                              <FileText className="w-3.5 h-3.5" />
                                              <span>{p.language === 'en' ? 'View API Response' : 'Voir RÃƒÂ©ponse API'}</span>
                                              <span className="ml-auto text-muted-foreground/50 group-open:hidden">Ã¢â€“Â¼</span>
                                              <span className="ml-auto text-muted-foreground/50 hidden group-open:inline">Ã¢â€“Â²</span>
                                            </summary>
                                            <div className="mt-2 p-3 bg-muted/50 rounded-md border border-border">
                                              <pre className="text-xs font-mono text-foreground/80 overflow-auto max-h-40 whitespace-pre-wrap break-words">
                                                {typeof logWithApiResponse.api_response === 'string' 
                                                  ? logWithApiResponse.api_response 
                                                  : JSON.stringify(logWithApiResponse.api_response, null, 2)}
                                              </pre>
                                            </div>
                                          </details>
                                        )}
                                        
                                        {/* Timestamp */}
                                        <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
                                          <Clock className="w-3.5 h-3.5" />
                                          <span>
                                            {log.sent_at
                                              ? new Date(log.sent_at).toLocaleString(p.language === 'en' ? 'en-US' : 'fr-FR', {
                                                  year: 'numeric',
                                                  month: 'short',
                                                  day: 'numeric',
                                                  hour: '2-digit',
                                                  minute: '2-digit',
                                                  second: '2-digit'
                                                })
                                              : new Date(log.created_at).toLocaleString(p.language === 'en' ? 'en-US' : 'fr-FR', {
                                                  year: 'numeric',
                                                  month: 'short',
                                                  day: 'numeric',
                                                  hour: '2-digit',
                                                  minute: '2-digit',
                                                  second: '2-digit'
                                                })}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  );
                                })}
                              </div>
                            )}
                          </>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
                  </TabsContent>

                  {/* Email Marketing Tab */}
                  <TabsContent value="email" className="space-y-6">
                <div className="px-2 flex flex-wrap gap-2">
                  <Button
                    className="btn-gradient"
                    onClick={() => {
                      setEmailEditorCampaignId(null);
                      setEmailEditorOpen(true);
                    }}
                  >
                    {p.language === "en" ? "New email campaign" : "Nouvelle campagne email"}
                  </Button>
                </div>
                {emailEditorOpen && (
                  <div className="px-2">
                    <EmailCampaignEditor
                      language={p.language}
                      campaignId={emailEditorCampaignId}
                      onClose={() => setEmailEditorOpen(false)}
                      onSaved={() => {
                        fetchCampaigns();
                      }}
                    />
                  </div>
                )}
                <div className="px-2">
                  <EmailCampaignLauncher
                    language={p.language}
                    campaigns={campaigns}
                    selectedDraftId={launchDraftId}
                    onSelectDraft={setLaunchDraftId}
                    onLaunchComplete={() => {
                      fetchCampaigns();
                      setLaunchDraftId(null);
                    }}
                  />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full px-2">
                  {/* Email Subscribers Card */}
                  <div className="animate-in slide-in-from-bottom-4 fade-in duration-700 delay-400">
                    <Card className="shadow-lg h-full flex flex-col">
                      <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                          <Mail className="w-5 h-5 text-primary" />
                          {p.language === 'en' ? 'Email Marketing' : 'Marketing Email'}
                        </CardTitle>
                        <p className="text-sm text-foreground/70 mt-2">
                          {p.language === 'en' 
                            ? `Send emails to all newsletter subscribers`
                            : `Envoyer des emails ÃƒÂ  tous les abonnÃƒÂ©s newsletter`}
                        </p>
                      </CardHeader>
                      <CardContent className="flex-1 flex flex-col space-y-4">
                        {/* Subscriber Count */}
                        <div className="p-3 bg-muted/30 rounded-lg border border-border">
                          <div className="text-sm font-semibold text-foreground mb-1">
                            {p.language === 'en' ? 'Subscribers Count' : "Nombre d'AbonnÃ©s"}
                          </div>
                          <div className="text-2xl font-bold text-primary">
                            {p.loadingEmailSubscribers ? (
                              <Loader size="md" />
                            ) : (
                              p.emailSubscribers.length
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {p.language === 'en' 
                              ? 'This email will be sent to all newsletter subscribers'
                              : 'Cet email sera envoyÃƒÂ© ÃƒÂ  tous les abonnÃƒÂ©s newsletter'}
                          </div>
                        </div>

                        {/* Export/Import Buttons */}
                        <div className="flex gap-2">
                          <Button
                            onClick={p.handleExportEmails}
                            disabled={p.emailSubscribers.length === 0 || p.loadingEmailSubscribers}
                            variant="outline"
                            size="sm"
                            className="flex-1"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            {p.language === 'en' ? 'Export Excel' : 'Exporter Excel'}
                          </Button>
                          <Dialog open={p.showEmailImportDialog} onOpenChange={p.setShowEmailImportDialog}>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                              >
                                <Upload className="w-4 h-4 mr-2" />
                                {p.language === 'en' ? 'Import Excel' : 'Importer Excel'}
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>
                                  {p.language === 'en' ? 'Import Email Addresses from Excel' : 'Importer des Adresses Email depuis Excel'}
                                </DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                {/* Instructions */}
                                <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                                  <div className="flex items-start gap-2">
                                    <Info className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                                    <div className="space-y-2 text-sm">
                                      <p className="font-semibold">
                                        {p.language === 'en' ? 'Excel File Format:' : 'Format du Fichier Excel:'}
                                      </p>
                                      <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-2">
                                        <li>
                                          {p.language === 'en' 
                                            ? 'First column: Email Address (valid email format required)'
                                            : 'PremiÃƒÂ¨re colonne: Adresse Email (format email valide requis)'}
                                        </li>
                                        <li>
                                          {p.language === 'en' 
                                            ? 'First row should be headers (will be skipped)'
                                            : 'La premiÃƒÂ¨re ligne doit contenir les en-tÃƒÂªtes (sera ignorÃƒÂ©e)'}
                                        </li>
                                        <li>
                                          {p.language === 'en' 
                                            ? 'Duplicate emails will be automatically skipped'
                                            : 'Les emails en double seront automatiquement ignorÃƒÂ©s'}
                                        </li>
                                        <li>
                                          {p.language === 'en' 
                                            ? 'Subscription time will be set automatically to import time'
                                            : 'La date d\'abonnement sera dÃƒÂ©finie automatiquement ÃƒÂ  l\'heure d\'importation'}
                                        </li>
                                      </ul>
                                      <div className="mt-3 p-2 bg-background rounded border border-border">
                                        <p className="font-semibold text-xs mb-1">
                                          {p.language === 'en' ? 'Example:' : 'Exemple:'}
                                        </p>
                                        <pre className="text-xs text-muted-foreground">
                                          {p.language === 'en' 
                                            ? 'Email\nuser@example.com\nsubscriber@example.com'
                                            : 'Email\nuser@example.com\nsubscriber@example.com'}
                                        </pre>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* File Upload */}
                                <div className="space-y-2">
                                  <Label>
                                    {p.language === 'en' ? 'Select Excel File (.xlsx)' : 'SÃƒÂ©lectionner un Fichier Excel (.xlsx)'}
                                  </Label>
                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="file"
                                      accept=".xlsx,.xls"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          p.handleImportEmailsFromExcel(file);
                                        }
                                      }}
                                      disabled={p.importingEmails}
                                      className="flex-1"
                                    />
                                  </div>
                                  {p.importingEmails && (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                      <Loader size="sm" />
                                      {p.language === 'en' ? 'Importing...' : 'Importation...'}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
                  </TabsContent>
                </Tabs>
    </TabsContent>
  );
}
