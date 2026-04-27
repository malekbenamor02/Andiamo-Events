import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TabsContent } from "@/components/ui/tabs";
import { Building2, FileText, Mail, MessageCircle, Phone, Settings, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { ConsultationInquiry } from "../types";

export interface ConsultationInquiriesTabProps {
  consultationInquiries: ConsultationInquiry[];
  filteredConsultationInquiries: ConsultationInquiry[];
  consultationInquirySearchTerm: string;
  setConsultationInquirySearchTerm: (value: string) => void;
}

export function ConsultationInquiriesTab({
  consultationInquiries,
  filteredConsultationInquiries,
  consultationInquirySearchTerm,
  setConsultationInquirySearchTerm,
}: ConsultationInquiriesTabProps) {
  const { toast } = useToast();

  return (
    <TabsContent value="consultation-inquiries" className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gradient-neon">B2B Leads</h2>
        <div className="flex items-center gap-4">
          <Badge variant="secondary" className="animate-pulse">
            {filteredConsultationInquiries.length} of {consultationInquiries.length} inquiries
          </Badge>
        </div>
      </div>

      <div className="relative group">
        <Settings className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4 transition-transform duration-300 group-hover:rotate-90" />
        <Input
          placeholder="Search by full name, company, service, email, phone, source, or vision..."
          value={consultationInquirySearchTerm}
          onChange={(e) => setConsultationInquirySearchTerm(e.target.value)}
          className="pl-10 transition-all duration-300 focus:scale-105 focus:shadow-lg focus:shadow-primary/20"
        />
      </div>

      <div className="grid grid-cols-1 gap-6">
        {filteredConsultationInquiries.map((inquiry) => (
          <div
            key={inquiry.id}
            className="bg-card rounded-xl p-6 shadow-lg transform transition-all duration-700 ease-out hover:scale-105 hover:shadow-xl hover:shadow-primary/10"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center animate-in zoom-in-95 duration-500 delay-300">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{inquiry.full_name}</h3>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Building2 className="w-4 h-4" />
                    <p>{inquiry.company || "No company"}</p>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <Badge variant="outline" className="mb-2">
                  {new Date(inquiry.created_at).toLocaleDateString()}
                </Badge>
                <p className="text-xs text-muted-foreground">{new Date(inquiry.created_at).toLocaleTimeString()}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{inquiry.service}</Badge>
                <Badge variant="outline">{inquiry.submission_channel}</Badge>
                <Badge variant="outline">{inquiry.source}</Badge>
                {inquiry.country && <Badge variant="outline">{inquiry.country}</Badge>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                <p className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span>{inquiry.contact_email || "No email provided"}</span>
                </p>
                <p className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span>{inquiry.contact_phone || "No phone provided"}</span>
                </p>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 border-l-4 border-primary/20">
                <p className="text-sm font-medium text-primary mb-2 flex items-center">
                  <FileText className="w-4 h-4 mr-2 animate-pulse" />
                  Vision
                </p>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{inquiry.vision || "No vision submitted."}</p>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const inquiryText =
                    `Full Name: ${inquiry.full_name}\n` +
                    `Company: ${inquiry.company || "-"}\n` +
                    `Service: ${inquiry.service}\n` +
                    `Email: ${inquiry.contact_email || "-"}\n` +
                    `Phone: ${inquiry.contact_phone || "-"}\n` +
                    `Country: ${inquiry.country || "-"}\n` +
                    `Source: ${inquiry.source}\n` +
                    `Submission Channel: ${inquiry.submission_channel}\n` +
                    `Date: ${new Date(inquiry.created_at).toLocaleString()}\n` +
                    `Vision: ${inquiry.vision || "-"}`;
                  navigator.clipboard.writeText(inquiryText);
                  toast({
                    title: "Copied to clipboard",
                    description: "Inquiry details copied successfully.",
                  });
                }}
                className="transform hover:scale-105 hover:shadow-md transition-all duration-300 group"
              >
                <FileText className="w-4 h-4 mr-2 transition-transform duration-300 group-hover:rotate-12" />
                Copy Details
              </Button>
              {inquiry.contact_email && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    window.open(
                      `mailto:${inquiry.contact_email}?subject=${encodeURIComponent(`Consultation follow-up: ${inquiry.service}`)}`,
                      "_blank",
                    );
                  }}
                  className="transform hover:scale-105 hover:shadow-md transition-all duration-300 group"
                >
                  <Mail className="w-4 h-4 mr-2 transition-transform duration-300 group-hover:scale-110" />
                  Reply
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredConsultationInquiries.length === 0 && consultationInquiries.length > 0 && (
        <div className="text-center py-12">
          <MessageCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4 animate-pulse" />
          <h3 className="text-lg font-semibold mb-2">No inquiries found</h3>
          <p className="text-muted-foreground">Try adjusting your search terms.</p>
        </div>
      )}

      {consultationInquiries.length === 0 && (
        <div className="text-center py-12">
          <MessageCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4 animate-pulse" />
          <h3 className="text-lg font-semibold mb-2">No inquiries yet</h3>
          <p className="text-muted-foreground">Consultation submissions from the subdomain will appear here.</p>
        </div>
      )}
    </TabsContent>
  );
}
