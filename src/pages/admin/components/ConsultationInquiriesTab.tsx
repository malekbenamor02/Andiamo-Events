import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TabsContent } from "@/components/ui/tabs";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ConsultationInquiry } from "../types";
import {
  AdminTabHeader,
  AdminTabEmpty,
  ADMIN_TABLE_HEAD,
  ADMIN_TABLE_WRAP,
  ADMIN_TABLE_ROW,
  ADMIN_FILTERS_PANEL,
} from "./AdminTabShell";

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
        <AdminTabHeader
          title="B2B Leads"
          subtitle={`${filteredConsultationInquiries.length} of ${consultationInquiries.length} inquiries`}
        />

        <div className={ADMIN_FILTERS_PANEL}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by full name, company, service, email, phone, or vision..."
              value={consultationInquirySearchTerm}
              onChange={(e) => setConsultationInquirySearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className={ADMIN_TABLE_WRAP}>
          <Table>
            <TableHeader>
              <TableRow className={ADMIN_TABLE_ROW}>
                <TableHead className={ADMIN_TABLE_HEAD}>Full Name</TableHead>
                <TableHead className={ADMIN_TABLE_HEAD}>Company</TableHead>
                <TableHead className={ADMIN_TABLE_HEAD}>Service</TableHead>
                <TableHead className={ADMIN_TABLE_HEAD}>Email</TableHead>
                <TableHead className={ADMIN_TABLE_HEAD}>Phone</TableHead>
                <TableHead className={ADMIN_TABLE_HEAD}>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredConsultationInquiries.map((inquiry) => (
                <TableRow key={inquiry.id} className={ADMIN_TABLE_ROW}>
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
          <AdminTabEmpty
            message="No inquiries found"
            hint="Try adjusting your search terms."
          />
        )}

        {consultationInquiries.length === 0 && (
          <AdminTabEmpty
            message="No inquiries yet"
            hint="Consultation submissions from the subdomain will appear here."
          />
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
