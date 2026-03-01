/**
 * Admin Dashboard — AIO Events Submissions tab.
 * Extracted from Dashboard.tsx for maintainability.
 */

import React from "react";
import Loader from "@/components/ui/Loader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TabsContent } from "@/components/ui/tabs";
import { Download, RefreshCw, Database } from "lucide-react";
import { format } from "date-fns";
import type { AioEventsSubmission, AioEventsPagination } from "../types";

export interface AioEventsTabProps {
  language: "en" | "fr";
  submissions: AioEventsSubmission[];
  loading: boolean;
  pagination: AioEventsPagination;
  setPagination: (v: AioEventsPagination | ((prev: AioEventsPagination) => AioEventsPagination)) => void;
  onExport: () => void;
  onRefresh: (resetOffset?: boolean) => void;
}

export function AioEventsTab({
  language,
  submissions,
  loading,
  pagination,
  setPagination,
  onExport,
  onRefresh,
}: AioEventsTabProps) {
  return (
    <TabsContent value="aio-events" className="space-y-6">
      <div className="flex justify-between items-center animate-in slide-in-from-top-4 fade-in duration-700">
        <div>
          <h2 className="text-2xl font-bold text-gradient-neon animate-in slide-in-from-left-4 duration-1000">
            AIO Events Submissions
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {language === "en"
              ? "View all AIO Events form submissions"
              : "Voir toutes les soumissions du formulaire AIO Events"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={onExport}
            disabled={loading}
            variant="outline"
            className="animate-in slide-in-from-right-4 duration-1000"
          >
            {loading ? <Loader size="sm" className="mr-2" /> : <Download className="w-4 h-4 mr-2" />}
            {language === "en" ? "Export Excel" : "Exporter Excel"}
          </Button>
          <Button
            onClick={() => onRefresh(true)}
            disabled={loading}
            variant="outline"
            className="animate-in slide-in-from-right-4 duration-1000"
          >
            {loading ? <Loader size="sm" className="mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            {language === "en" ? "Refresh" : "Actualiser"}
          </Button>
        </div>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" />
            {language === "en" ? "Submissions" : "Soumissions"}
            <Badge variant="secondary" className="ml-2">
              {pagination.total}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-3">
              <Loader size="lg" />
              <span className="text-muted-foreground">
                {language === "en" ? "Loading submissions..." : "Chargement des soumissions..."}
              </span>
            </div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {language === "en" ? "No submissions found" : "Aucune soumission trouvée"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === "en" ? "Name" : "Nom"}</TableHead>
                    <TableHead>{language === "en" ? "Email" : "Email"}</TableHead>
                    <TableHead>{language === "en" ? "Phone" : "Téléphone"}</TableHead>
                    <TableHead>{language === "en" ? "City" : "Ville"}</TableHead>
                    <TableHead>{language === "en" ? "Event" : "Événement"}</TableHead>
                    <TableHead>{language === "en" ? "Passes" : "Passes"}</TableHead>
                    <TableHead>{language === "en" ? "Total" : "Total"}</TableHead>
                    <TableHead>{language === "en" ? "Date" : "Date"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submissions.map((submission) => (
                    <TableRow key={submission.id}>
                      <TableCell className="font-medium">{submission.full_name || "-"}</TableCell>
                      <TableCell className="font-mono text-xs">{submission.email || "-"}</TableCell>
                      <TableCell className="font-mono text-xs">{submission.phone || "-"}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{submission.city || "-"}</span>
                          {submission.ville && (
                            <span className="text-xs text-muted-foreground">{submission.ville}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col max-w-[200px]">
                          <span className="font-medium truncate">{submission.event_name || "-"}</span>
                          {submission.event_date && (
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(submission.event_date), "MMM dd, yyyy")}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{submission.total_quantity || 0}</span>
                          {submission.selected_passes &&
                            Array.isArray(submission.selected_passes) &&
                            submission.selected_passes.length > 0 && (
                              <span className="text-xs text-muted-foreground">
                                {submission.selected_passes.map((p, idx) => (
                                  <span key={idx}>
                                    {p.name || p.passName || "Pass"} × {p.quantity || 1}
                                    {idx < submission.selected_passes!.length - 1 ? ", " : ""}
                                  </span>
                                ))}
                              </span>
                            )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {submission.total_price
                          ? `${submission.total_price.toFixed(2)} TND`
                          : "-"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {submission.submitted_at
                          ? format(new Date(submission.submitted_at), "MMM dd, yyyy HH:mm")
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {pagination.total > 0 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                {language === "en"
                  ? `Showing ${pagination.offset + 1} to ${Math.min(pagination.offset + pagination.limit, pagination.total)} of ${pagination.total} submissions`
                  : `Affichage de ${pagination.offset + 1} à ${Math.min(pagination.offset + pagination.limit, pagination.total)} sur ${pagination.total} soumissions`}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newOffset = Math.max(0, pagination.offset - pagination.limit);
                    setPagination((prev) => ({ ...prev, offset: newOffset }));
                    onRefresh(false);
                  }}
                  disabled={pagination.offset === 0 || loading}
                >
                  {language === "en" ? "Previous" : "Précédent"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newOffset = pagination.offset + pagination.limit;
                    setPagination((prev) => ({ ...prev, offset: newOffset }));
                    onRefresh(false);
                  }}
                  disabled={!pagination.hasMore || loading}
                >
                  {language === "en" ? "Next" : "Suivant"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  );
}
