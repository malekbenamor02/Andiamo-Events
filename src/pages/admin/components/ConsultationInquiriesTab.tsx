import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TabsContent } from "@/components/ui/tabs";
import { MessageCircle, Settings } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  const [selectedInquiry, setSelectedInquiry] = useState<ConsultationInquiry | null>(null);

  return (
    <>
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
          <Settings className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search by full name, company, service, email, phone, source, or vision..."
            value={consultationInquirySearchTerm}
            onChange={(e) => setConsultationInquirySearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Full Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredConsultationInquiries.map((inquiry) => (
                <TableRow key={inquiry.id}>
                  <TableCell className="font-medium">{inquiry.full_name}</TableCell>
                  <TableCell>{inquiry.company || "-"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{inquiry.service}</Badge>
                  </TableCell>
                  <TableCell>{inquiry.contact_email || "-"}</TableCell>
                  <TableCell>{inquiry.contact_phone || "-"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(inquiry.created_at).toLocaleString()}
                      </span>
                      <Button size="sm" variant="outline" onClick={() => setSelectedInquiry(inquiry)}>
                        View
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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

      <Dialog open={!!selectedInquiry} onOpenChange={(open) => !open && setSelectedInquiry(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>B2B Lead Details</DialogTitle>
          </DialogHeader>
          {selectedInquiry && (
            <div className="space-y-3 text-sm">
              <div><span className="font-semibold">Date:</span> {new Date(selectedInquiry.created_at).toLocaleString()}</div>
              <div><span className="font-semibold">Full Name:</span> {selectedInquiry.full_name}</div>
              <div><span className="font-semibold">Company:</span> {selectedInquiry.company || "-"}</div>
              <div><span className="font-semibold">Service:</span> {selectedInquiry.service}</div>
              <div><span className="font-semibold">Email:</span> {selectedInquiry.contact_email || "-"}</div>
              <div><span className="font-semibold">Phone:</span> {selectedInquiry.contact_phone || "-"}</div>
              <div className="whitespace-pre-wrap"><span className="font-semibold">Vision:</span> {selectedInquiry.vision || "-"}</div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
