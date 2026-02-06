/**
 * Admin Dashboard — Marketing tab (SMS + Email).
 * Extracted from Dashboard.tsx for maintainability.
 */

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { PhoneCall, Mail, CreditCard, Download, Upload, Send, RefreshCw, FileText, Info, Phone, CheckCircle, XCircle, Clock } from "lucide-react";
import { BulkSmsSelector } from "@/components/admin/BulkSmsSelector";

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
  return (
    <TabsContent value="marketing" className="space-y-6">
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
                            <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground font-heading">
                              {p.language === 'en' ? 'Checking balance...' : 'Vérification du solde...'}
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
                                          âš ï¸ {p.language === 'en' ? 'Insufficient balance!' : 'Solde insuffisant!'}
                                        </p>
                                      ) : null}
                                    </div>
                                  ) : (
                                  <p className="text-2xl font-heading font-bold text-primary mt-1">
                                      {p.smsBalance.balance}
                                      {p.smsBalance.balance === '0' || p.smsBalance.balance === 0 ? (
                                        <span className="text-xs text-red-500 ml-2">
                                          âš ï¸ {p.language === 'en' ? 'Insufficient!' : 'Insuffisant!'}
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
                                : 'Cliquez sur le bouton ci-dessous pour vÃ©rifier votre solde SMS'}
                            </p>
                            <Button
                              onClick={p.fetchSmsBalance}
                              disabled={p.loadingBalance}
                              className="w-full font-heading btn-gradient"
                              size="lg"
                            >
                              <CreditCard className="w-5 h-5 mr-2" />
                              {p.language === 'en' ? 'Check SMS Balance' : 'VÃ©rifier le Solde SMS'}
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
                            : 'Tester la fonctionnalitÃ© SMS avec un numÃ©ro de tÃ©lÃ©phone spÃ©cifique'}
                        </p>
                      </CardHeader>
                      <CardContent className="flex-1 flex flex-col space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="testPhone">{p.language === 'en' ? 'Phone Number' : 'NumÃ©ro de TÃ©lÃ©phone'} *</Label>
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
                            <span>{p.language === 'en' ? 'Characters' : 'CaractÃ¨res'}: {p.testSmsMessage.length}</span>
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
                              <RefreshCw className="w-5 h-5 animate-spin mr-2" />
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
                          {p.language === 'en' ? 'Export/Import Phone Subscribers' : 'Exporter/Importer Abonnés'}
                        </CardTitle>
                        <p className="text-sm text-foreground/70 mt-2">
                          {p.language === 'en' 
                            ? `Export or import phone subscribers from Excel`
                            : `Exporter ou importer des abonnÃ©s tÃ©lÃ©phone depuis Excel`}
                        </p>
                      </CardHeader>
                      <CardContent className="flex-1 flex flex-col space-y-4">
                        {/* Subscriber Count */}
                        <div className="p-3 bg-muted/30 rounded-lg border border-border">
                          <div className="text-sm font-semibold text-foreground mb-1">
                            {p.language === 'en' ? 'Subscribers Count' : "Nombre d'Abonnés"}
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
                                  {p.language === 'en' ? 'Import Phone Numbers from Excel' : 'Importer des NumÃ©ros depuis Excel'}
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
                                            : 'PremiÃ¨re colonne: NumÃ©ro de tÃ©lÃ©phone (8 chiffres, commence par 2, 4, 5 ou 9)'}
                                        </li>
                                        <li>
                                          {p.language === 'en' 
                                            ? 'First row should be headers (will be skipped)'
                                            : 'La premiÃ¨re ligne doit contenir les en-tÃªtes (sera ignorÃ©e)'}
                                        </li>
                                        <li>
                                          {p.language === 'en' 
                                            ? 'Duplicate numbers will be automatically skipped'
                                            : 'Les numÃ©ros en double seront automatiquement ignorÃ©s'}
                                        </li>
                                        <li>
                                          {p.language === 'en' 
                                            ? 'Subscription time will be set automatically to import time'
                                            : 'La date d\'abonnement sera dÃ©finie automatiquement Ã  l\'heure d\'importation'}
                                        </li>
                                      </ul>
                                      <div className="mt-3 p-2 bg-background rounded border border-border">
                                        <p className="font-semibold text-xs mb-1">
                                          {p.language === 'en' ? 'Example:' : 'Exemple:'}
                                        </p>
                                        <pre className="text-xs text-muted-foreground">
                                          {p.language === 'en' 
                                            ? 'Phone Number\n27169458\n98765432'
                                            : 'NumÃ©ro de TÃ©lÃ©phone\n27169458\n98765432'}
                                        </pre>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* File Upload */}
                                <div className="space-y-2">
                                  <Label>
                                    {p.language === 'en' ? 'Select Excel File (.xlsx)' : 'SÃ©lectionner un Fichier Excel (.xlsx)'}
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
                                      <RefreshCw className="w-4 h-4 animate-spin" />
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
                            : 'Historique rÃ©cent d\'envoi SMS et erreurs'}
                        </p>
                      </CardHeader>
                      <CardContent className="flex-1 flex flex-col space-y-4">
                        {p.loadingLogs ? (
                          <div className="flex items-center justify-center py-8">
                            <RefreshCw className="w-6 h-6 animate-spin text-primary" />
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
                                              ? (p.language === 'en' ? 'Sent' : 'EnvoyÃ©')
                                              : log.status === 'failed'
                                              ? (p.language === 'en' ? 'Failed' : 'Ã‰chouÃ©')
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
                                              <span>{p.language === 'en' ? 'View API Response' : 'Voir RÃ©ponse API'}</span>
                                              <span className="ml-auto text-muted-foreground/50 group-open:hidden">â–¼</span>
                                              <span className="ml-auto text-muted-foreground/50 hidden group-open:inline">â–²</span>
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
                            : `Envoyer des emails Ã  tous les abonnÃ©s newsletter`}
                        </p>
                      </CardHeader>
                      <CardContent className="flex-1 flex flex-col space-y-4">
                        {/* Subscriber Count */}
                        <div className="p-3 bg-muted/30 rounded-lg border border-border">
                          <div className="text-sm font-semibold text-foreground mb-1">
                            {p.language === 'en' ? 'Subscribers Count' : "Nombre d'Abonnés"}
                          </div>
                          <div className="text-2xl font-bold text-primary">
                            {p.loadingEmailSubscribers ? (
                              <RefreshCw className="w-6 h-6 animate-spin" />
                            ) : (
                              p.emailSubscribers.length
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {p.language === 'en' 
                              ? 'This email will be sent to all newsletter subscribers'
                              : 'Cet email sera envoyÃ© Ã  tous les abonnÃ©s newsletter'}
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
                                            : 'PremiÃ¨re colonne: Adresse Email (format email valide requis)'}
                                        </li>
                                        <li>
                                          {p.language === 'en' 
                                            ? 'First row should be headers (will be skipped)'
                                            : 'La premiÃ¨re ligne doit contenir les en-tÃªtes (sera ignorÃ©e)'}
                                        </li>
                                        <li>
                                          {p.language === 'en' 
                                            ? 'Duplicate emails will be automatically skipped'
                                            : 'Les emails en double seront automatiquement ignorÃ©s'}
                                        </li>
                                        <li>
                                          {p.language === 'en' 
                                            ? 'Subscription time will be set automatically to import time'
                                            : 'La date d\'abonnement sera dÃ©finie automatiquement Ã  l\'heure d\'importation'}
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
                                    {p.language === 'en' ? 'Select Excel File (.xlsx)' : 'SÃ©lectionner un Fichier Excel (.xlsx)'}
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
                                      <RefreshCw className="w-4 h-4 animate-spin" />
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

                  {/* Email Composition Card */}
                  <div className="animate-in slide-in-from-bottom-4 fade-in duration-700 delay-600">
                    <Card className="shadow-lg h-full flex flex-col">
                      <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                          <Mail className="w-5 h-5 text-primary" />
                          {p.language === 'en' ? 'Compose Email' : 'Composer Email'}
                        </CardTitle>
                        <p className="text-sm text-foreground/70 mt-2">
                          {p.language === 'en' 
                            ? `Create and send bulk emails to subscribers`
                            : `CrÃ©er et envoyer des emails en masse aux abonnÃ©s`}
                        </p>
                      </CardHeader>
                      <CardContent className="flex-1 flex flex-col space-y-4">
                        {/* Email Subject */}
                        <div className="space-y-2">
                          <Label>{p.language === 'en' ? 'Subject' : 'Sujet'} *</Label>
                          <Input
                            value={p.emailSubject}
                            onChange={(e) => p.setEmailSubject(e.target.value)}
                            placeholder={p.language === 'en' ? 'Enter email subject...' : 'Entrez le sujet de l\'email...'}
                            className="bg-background text-foreground"
                          />
                        </div>

                        {/* Email Content */}
                        <div className="space-y-2 flex-1 flex flex-col">
                          <Label>{p.language === 'en' ? 'Email Content' : 'Contenu Email'} *</Label>
                          <Textarea
                            value={p.emailContent}
                            onChange={(e) => p.setEmailContent(e.target.value)}
                            placeholder={p.language === 'en' ? 'Enter your email content (HTML supported)...' : 'Entrez le contenu de votre email (HTML supportÃ©)...'}
                            className="min-h-[300px] text-sm bg-background text-foreground"
                          />
                          <div className="text-xs text-muted-foreground">
                            {p.language === 'en' 
                              ? 'Your content will be wrapped in our email template. HTML tags are supported: <p>, <h1>, <strong>, <a>, etc.'
                              : 'Votre contenu sera enveloppÃ© dans notre modÃ¨le d\'email. Les balises HTML sont supportÃ©es: <p>, <h1>, <strong>, <a>, etc.'}
                          </div>
                        </div>

                        {/* Test Email Section */}
                        <div className="p-4 bg-muted/30 rounded-lg border border-border space-y-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Mail className="w-4 h-4 text-primary" />
                            <Label className="font-semibold">
                              {p.language === 'en' ? 'Test Email' : 'Email de Test'}
                            </Label>
                          </div>
                          <div className="space-y-2">
                            <Input
                              type="email"
                              value={p.testEmailAddress}
                              onChange={(e) => p.setTestEmailAddress(e.target.value)}
                              placeholder={p.language === 'en' ? 'Enter test email address...' : 'Entrez l\'adresse email de test...'}
                              className="bg-background text-foreground"
                            />
                            <Button
                              onClick={p.handleSendTestEmail}
                              disabled={p.sendingTestEmail || !p.testEmailAddress.trim() || !p.emailSubject.trim() || !p.emailContent.trim()}
                              variant="outline"
                              size="sm"
                              className="w-full"
                            >
                              {p.sendingTestEmail ? (
                                <>
                                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                                  {p.language === 'en' ? 'Sending Test...' : 'Envoi du Test...'}
                                </>
                              ) : (
                                <>
                                  <Send className="w-4 h-4 mr-2" />
                                  {p.language === 'en' ? 'Send Test Email' : 'Envoyer Email de Test'}
                                </>
                              )}
                            </Button>
                            <div className="text-xs text-muted-foreground">
                              {p.language === 'en' 
                                ? 'Send a test email to preview how it will look before sending to all subscribers'
                                : 'Envoyez un email de test pour prÃ©visualiser son apparence avant de l\'envoyer Ã  tous les abonnÃ©s'}
                            </div>
                          </div>
                        </div>

                        {/* Delay Setting */}
                        <div className="space-y-2">
                          <Label>
                            {p.language === 'en' ? 'Delay Between Emails (seconds)' : 'DÃ©lai Entre les Emails (secondes)'}
                          </Label>
                          <Input
                            type="number"
                            min="1"
                            max="60"
                            value={p.emailDelaySeconds}
                            onChange={(e) => p.setEmailDelaySeconds(Math.max(1, Math.min(60, parseInt(e.target.value) || 2)))}
                            className="bg-background text-foreground"
                          />
                          <div className="text-xs text-muted-foreground">
                            {p.language === 'en' 
                              ? `Each email will be sent ${p.emailDelaySeconds} second(s) after the previous one`
                              : `Chaque email sera envoyÃ© ${p.emailDelaySeconds} seconde(s) aprÃ¨s le prÃ©cÃ©dent`}
                          </div>
                        </div>

                        {/* Send Button */}
                        <Button
                          onClick={p.handleSendBulkEmails}
                          disabled={p.sendingBulkEmails || !p.emailSubject.trim() || !p.emailContent.trim() || p.emailSubscribers.length === 0}
                          className="w-full btn-gradient"
                          size="lg"
                        >
                          {p.sendingBulkEmails ? (
                            <>
                              <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                              {p.language === 'en' ? 'Sending Emails...' : 'Envoi des Emails...'}
                            </>
                          ) : (
                            <>
                              <Send className="w-5 h-5 mr-2" />
                              {p.language === 'en' 
                                ? `Send to ${p.emailSubscribers.length} Subscribers`
                                : `Envoyer Ã  ${p.emailSubscribers.length} AbonnÃ©s`}
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                </div>
                  </TabsContent>
                </Tabs>
    </TabsContent>
  );
}
