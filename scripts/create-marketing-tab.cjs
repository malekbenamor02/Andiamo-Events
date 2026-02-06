/**
 * Creates MarketingTab.tsx from the extracted content.
 * Replaces variable refs with props.xxx
 */
const fs = require("fs");
const path = require("path");

const rawPath = path.join(__dirname, "..", "marketing-tab-raw.txt");
let content = fs.readFileSync(rawPath, "utf8");

// Variables used in the Marketing tab - replace with props.xxx
const replacements = [
  ["marketingSubTab", "p.marketingSubTab"],
  ["setMarketingSubTab", "p.setMarketingSubTab"],
  ["emailSubscribers", "p.emailSubscribers"],
  ["fetchEmailSubscribers", "p.fetchEmailSubscribers"],
  ["loadingBalance", "p.loadingBalance"],
  ["smsBalance", "p.smsBalance"],
  ["fetchSmsBalance", "p.fetchSmsBalance"],
  ["testPhoneNumber", "p.testPhoneNumber"],
  ["setTestPhoneNumber", "p.setTestPhoneNumber"],
  ["testSmsMessage", "p.testSmsMessage"],
  ["setTestSmsMessage", "p.setTestSmsMessage"],
  ["handleSendTestSms", "p.handleSendTestSms"],
  ["sendingTestSms", "p.sendingTestSms"],
  ["phoneSubscribers", "p.phoneSubscribers"],
  ["handleExportPhones", "p.handleExportPhones"],
  ["showImportDialog", "p.showImportDialog"],
  ["setShowImportDialog", "p.setShowImportDialog"],
  ["handleImportPhonesFromExcel", "p.handleImportPhonesFromExcel"],
  ["importingPhones", "p.importingPhones"],
  ["loadingLogs", "p.loadingLogs"],
  ["smsLogs", "p.smsLogs"],
  ["fetchSmsLogs", "p.fetchSmsLogs"],
  ["fetchPhoneSubscribers", "p.fetchPhoneSubscribers"],
  ["loadingEmailSubscribers", "p.loadingEmailSubscribers"],
  ["handleExportEmails", "p.handleExportEmails"],
  ["showEmailImportDialog", "p.showEmailImportDialog"],
  ["setShowEmailImportDialog", "p.setShowEmailImportDialog"],
  ["handleImportEmailsFromExcel", "p.handleImportEmailsFromExcel"],
  ["importingEmails", "p.importingEmails"],
  ["emailSubject", "p.emailSubject"],
  ["setEmailSubject", "p.setEmailSubject"],
  ["emailContent", "p.emailContent"],
  ["setEmailContent", "p.setEmailContent"],
  ["testEmailAddress", "p.testEmailAddress"],
  ["setTestEmailAddress", "p.setTestEmailAddress"],
  ["handleSendTestEmail", "p.handleSendTestEmail"],
  ["sendingTestEmail", "p.sendingTestEmail"],
  ["emailDelaySeconds", "p.emailDelaySeconds"],
  ["setEmailDelaySeconds", "p.setEmailDelaySeconds"],
  ["handleSendBulkEmails", "p.handleSendBulkEmails"],
  ["sendingBulkEmails", "p.sendingBulkEmails"],
  ["language", "p.language"],
  ["getSourceDisplayName", "p.getSourceDisplayName"],
];

// Sort by length descending to avoid partial replacements (e.g. setMarketingSubTab before marketingSubTab)
replacements.sort((a, b) => b[0].length - a[0].length);

for (const [from, to] of replacements) {
  const regex = new RegExp("\\b" + from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "g");
  content = content.replace(regex, to);
}

// Fix p.setEmailDelaySeconds in onChange - the setter receives a value
content = content.replace(/onChange=\{\(e\) => p\.setEmailDelaySeconds\(Math\.max\(1, Math\.min\(60, parseInt\(e\.target\.value\) \|\| 2\)\)\)\}/g,
  'onChange={(e) => p.setEmailDelaySeconds(Math.max(1, Math.min(60, parseInt(e.target.value) || 2)))}');

const componentContent = `/**
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
${content}
  );
}
`;

const outPath = path.join(__dirname, "..", "src", "pages", "admin", "components", "MarketingTab.tsx");
fs.writeFileSync(outPath, componentContent, "utf8");
console.log("Created MarketingTab.tsx");
console.log("Note: Verify getSourceDisplayName is passed - it comes from @/lib/phone-numbers");
