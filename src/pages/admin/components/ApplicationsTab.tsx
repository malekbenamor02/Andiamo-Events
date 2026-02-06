/**
 * Admin Dashboard — Ambassador Applications tab.
 * Extracted from Dashboard.tsx for maintainability.
 */

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { TabsContent } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Download,
  Trash2,
  Settings,
  X,
  Phone,
  Mail,
  MapPin,
  Calendar as CalendarIcon,
  FileText,
  CheckCircle,
  XCircle,
  Mail as MailIcon,
  AlertCircle,
  Copy,
} from "lucide-react";
import { Instagram, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { CITIES, SOUSSE_VILLES, TUNIS_VILLES } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import type { AmbassadorApplication, Ambassador, SelectedMotivation } from "../types";

function isInstagramUrl(url: string) {
  return (
    url.startsWith("https://www.instagram.com/") ||
    url.startsWith("https://instagram.com/")
  );
}

function SocialLinkIcon({ url }: { url: string }) {
  if (isInstagramUrl(url)) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center text-primary hover:text-primary/80 transition-colors"
        title="View Instagram Profile"
      >
        <Instagram className="w-4 h-4" />
      </a>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary hover:underline transition-colors"
      title={url}
    >
      <ExternalLink className="w-4 h-4" />
    </a>
  );
}

export interface ApplicationsTabTranslation {
  approve: string;
  reject: string;
  processing: string;
  pending: string;
  approved: string;
  rejected: string;
  noApplications: string;
}

export interface ApplicationsTabProps {
  language: "en" | "fr";
  t: ApplicationsTabTranslation;
  filteredApplications: AmbassadorApplication[];
  applications: AmbassadorApplication[];
  ambassadors: Ambassador[];
  applicationSearchTerm: string;
  setApplicationSearchTerm: (v: string) => void;
  applicationStatusFilter: string;
  setApplicationStatusFilter: (v: string) => void;
  applicationCityFilter: string;
  setApplicationCityFilter: (v: string) => void;
  applicationVilleFilter: string;
  setApplicationVilleFilter: (v: string) => void;
  applicationDateFrom: Date | undefined;
  setApplicationDateFrom: (v: Date | undefined) => void;
  applicationDateTo: Date | undefined;
  setApplicationDateTo: (v: Date | undefined) => void;
  animatedApplications: Set<string>;
  emailStatus: Record<string, "sent" | "failed" | "pending">;
  emailFailedApplications: Set<string>;
  selectedMotivation: SelectedMotivation | null;
  setSelectedMotivation: (v: SelectedMotivation | null) => void;
  isMotivationDialogOpen: boolean;
  setIsMotivationDialogOpen: (v: boolean) => void;
  getStatusBadge: (status: string) => React.ReactNode;
  onExportExcel: () => Promise<void>;
  onCleanupOrphaned: () => void;
  onApprove: (app: AmbassadorApplication) => void;
  onReject: (app: AmbassadorApplication) => void;
  onResendEmail: (app: AmbassadorApplication) => void;
  onCopyCredentials: (app: AmbassadorApplication) => void;
  processingId: string | null;
  orphanedCount: number;
}

export function ApplicationsTab({
  language,
  t,
  filteredApplications,
  applications,
  ambassadors,
  applicationSearchTerm,
  setApplicationSearchTerm,
  applicationStatusFilter,
  setApplicationStatusFilter,
  applicationCityFilter,
  setApplicationCityFilter,
  applicationVilleFilter,
  setApplicationVilleFilter,
  applicationDateFrom,
  setApplicationDateFrom,
  applicationDateTo,
  setApplicationDateTo,
  animatedApplications,
  emailStatus,
  emailFailedApplications,
  selectedMotivation,
  setSelectedMotivation,
  isMotivationDialogOpen,
  setIsMotivationDialogOpen,
  getStatusBadge,
  onExportExcel,
  onCleanupOrphaned,
  onApprove,
  onReject,
  onResendEmail,
  onCopyCredentials,
  processingId,
  orphanedCount,
}: ApplicationsTabProps) {
  const { toast } = useToast();

  return (
    <TabsContent value="applications" className="space-y-6">
      <div className="flex justify-between items-center animate-in slide-in-from-top-4 fade-in duration-700">
        <h2 className="text-2xl font-bold text-gradient-neon animate-in slide-in-from-left-4 duration-1000">
          Ambassador Applications
        </h2>
        <div className="flex items-center gap-3 animate-in slide-in-from-right-4 duration-1000 delay-300">
          <Button
            variant="outline"
            size="sm"
            onClick={onExportExcel}
            className="transform hover:scale-105 transition-all duration-300"
            style={{
              background: "#1F1F1F",
              borderColor: "#2A2A2A",
              color: "#FFFFFF",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#E21836";
              e.currentTarget.style.borderColor = "#E21836";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#1F1F1F";
              e.currentTarget.style.borderColor = "#2A2A2A";
            }}
          >
            <Download className="w-4 h-4 mr-2" />
            {language === "en" ? "Export to Excel" : "Exporter vers Excel"}
          </Button>
          <Badge
            className="animate-pulse"
            style={{
              background: "rgba(0, 207, 255, 0.15)",
              color: "#00CFFF",
            }}
          >
            {filteredApplications.length} Applications
          </Badge>
          {orphanedCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={onCleanupOrphaned}
              className="text-xs"
            >
              <Trash2 className="w-3 h-3 mr-1" />
              {language === "en"
                ? `Cleanup ${orphanedCount} Orphaned`
                : `Nettoyer ${orphanedCount} Orphelines`}
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-4 animate-in slide-in-from-bottom-4 fade-in duration-700 delay-500">
        <div className="relative">
          <Settings className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search by name, email, or phone..."
            value={applicationSearchTerm}
            onChange={(e) => setApplicationSearchTerm(e.target.value)}
            className="pl-10 transition-all duration-300 focus:scale-105"
          />
        </div>

        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium text-muted-foreground">
              {language === "en" ? "Status:" : "Statut:"}
            </Label>
            <Select
              value={applicationStatusFilter}
              onValueChange={setApplicationStatusFilter}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue
                  placeholder={
                    language === "en" ? "All Statuses" : "Tous les Statuts"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {language === "en" ? "All Statuses" : "Tous les Statuts"}
                </SelectItem>
                <SelectItem value="pending">
                  {language === "en" ? "Pending" : "En Attente"}
                </SelectItem>
                <SelectItem value="approved">
                  {language === "en" ? "Approved" : "Approuvé"}
                </SelectItem>
                <SelectItem value="rejected">
                  {language === "en" ? "Rejected" : "Rejeté"}
                </SelectItem>
                <SelectItem value="suspended">
                  {language === "en" ? "Suspended" : "Suspendu"}
                </SelectItem>
                <SelectItem value="removed">
                  {language === "en" ? "Removed" : "Retiré"}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium text-muted-foreground">
              {language === "en" ? "City:" : "Ville:"}
            </Label>
            <Select
              value={applicationCityFilter}
              onValueChange={(value) => {
                setApplicationCityFilter(value);
                if (value !== "all") setApplicationVilleFilter("all");
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue
                  placeholder={
                    language === "en" ? "All Cities" : "Toutes les Villes"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {language === "en" ? "All Cities" : "Toutes les Villes"}
                </SelectItem>
                {CITIES.map((city) => (
                  <SelectItem key={city} value={city}>
                    {city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(applicationCityFilter === "Sousse" ||
            applicationCityFilter === "Tunis" ||
            applicationCityFilter === "all") && (
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium text-muted-foreground">
                {language === "en"
                  ? "Ville (Neighborhood):"
                  : "Quartier:"}
              </Label>
              <div className="relative">
                <Select
                  value={applicationVilleFilter}
                  onValueChange={setApplicationVilleFilter}
                  disabled={
                    applicationCityFilter !== "Sousse" &&
                    applicationCityFilter !== "Tunis" &&
                    applicationCityFilter !== "all"
                  }
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue
                      placeholder={
                        language === "en"
                          ? "All Villes"
                          : "Tous les Quartiers"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    side="bottom"
                    sideOffset={4}
                    avoidCollisions={false}
                    className="[&[data-side=top]]:!hidden"
                  >
                    <SelectItem value="all">
                      {language === "en" ? "All Villes" : "Tous les Quartiers"}
                    </SelectItem>
                    {applicationCityFilter === "Sousse" &&
                      SOUSSE_VILLES.map((ville) => (
                        <SelectItem key={ville} value={ville}>
                          {ville}
                        </SelectItem>
                      ))}
                    {applicationCityFilter === "Tunis" &&
                      TUNIS_VILLES.map((ville) => (
                        <SelectItem key={ville} value={ville}>
                          {ville}
                        </SelectItem>
                      ))}
                    {applicationCityFilter === "all" && (
                      <>
                        {SOUSSE_VILLES.map((ville) => (
                          <SelectItem
                            key={`sousse-${ville}`}
                            value={ville}
                          >
                            {ville} (Sousse)
                          </SelectItem>
                        ))}
                        {TUNIS_VILLES.map((ville) => (
                          <SelectItem key={`tunis-${ville}`} value={ville}>
                            {ville} (Tunis)
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {(applicationStatusFilter !== "pending" ||
            applicationCityFilter !== "all" ||
            applicationVilleFilter !== "all") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setApplicationStatusFilter("pending");
                setApplicationCityFilter("all");
                setApplicationVilleFilter("all");
              }}
              className="text-xs"
            >
              <X className="w-3 h-3 mr-1" />
              {language === "en" ? "Clear Filters" : "Effacer les Filtres"}
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium text-foreground/70 whitespace-nowrap">
              {language === "en" ? "From Date:" : "Date de début:"}
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[200px] justify-start text-left font-normal border-border/50 bg-background hover:bg-muted/30 hover:border-primary/30 transition-all duration-300 shadow-sm",
                    !applicationDateFrom && "text-muted-foreground",
                    applicationDateFrom && "border-primary/50 bg-primary/5"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                  <span className="truncate">
                    {applicationDateFrom ? (
                      format(applicationDateFrom, "PPP")
                    ) : (
                      <span className="text-muted-foreground">
                        {language === "en"
                          ? "Pick a date"
                          : "Choisir une date"}
                      </span>
                    )}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={applicationDateFrom}
                  onSelect={(date) => setApplicationDateFrom(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium text-foreground/70 whitespace-nowrap">
              {language === "en" ? "To Date:" : "Date de fin:"}
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[200px] justify-start text-left font-normal border-border/50 bg-background hover:bg-muted/30 hover:border-primary/30 transition-all duration-300 shadow-sm",
                    !applicationDateTo && "text-muted-foreground",
                    applicationDateTo && "border-primary/50 bg-primary/5",
                    !applicationDateFrom && "opacity-50 cursor-not-allowed"
                  )}
                  disabled={!applicationDateFrom}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                  <span className="truncate">
                    {applicationDateTo ? (
                      format(applicationDateTo, "PPP")
                    ) : (
                      <span className="text-muted-foreground">
                        {language === "en"
                          ? "Pick a date"
                          : "Choisir une date"}
                      </span>
                    )}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={applicationDateTo}
                  onSelect={(date) => setApplicationDateTo(date)}
                  disabled={(date) =>
                    applicationDateFrom ? date < applicationDateFrom : false
                  }
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {(applicationDateFrom || applicationDateTo) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setApplicationDateFrom(undefined);
                setApplicationDateTo(undefined);
              }}
              className="text-xs border-border/50 hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive transition-all duration-300 shadow-sm"
            >
              <X className="w-3 h-3 mr-1.5" />
              {language === "en" ? "Clear Dates" : "Effacer les Dates"}
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-md border border-border overflow-hidden">
        <div className="overflow-x-hidden">
          <Table className="[&>div]:overflow-x-hidden">
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold text-xs px-2 py-2 h-auto">
                  Name
                </TableHead>
                <TableHead className="font-semibold text-xs px-2 py-2 h-auto">
                  Age
                </TableHead>
                <TableHead className="font-semibold text-xs px-2 py-2 h-auto">
                  Phone
                </TableHead>
                <TableHead className="font-semibold text-xs px-2 py-2 h-auto">
                  Email
                </TableHead>
                <TableHead className="font-semibold text-xs px-2 py-2 h-auto">
                  City
                </TableHead>
                <TableHead className="font-semibold text-xs px-2 py-2 h-auto">
                  {language === "en" ? "Ville" : "Quartier"}
                </TableHead>
                <TableHead className="font-semibold text-xs px-2 py-2 h-auto">
                  Status
                </TableHead>
                <TableHead className="font-semibold text-xs px-2 py-2 h-auto">
                  Applied
                </TableHead>
                <TableHead className="font-semibold text-xs px-2 py-2 h-auto">
                  Details
                </TableHead>
                <TableHead className="font-semibold text-xs px-2 py-2 h-auto text-right">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredApplications.map((application) => (
                <TableRow
                  key={application.id}
                  className={cn(
                    "transform transition-all duration-300 hover:bg-muted/30",
                    animatedApplications.has(application.id) &&
                      "animate-in fade-in duration-300"
                  )}
                >
                  <TableCell className="font-medium text-xs px-2 py-2">
                    {application.full_name}
                  </TableCell>
                  <TableCell className="text-xs px-2 py-2">
                    {application.age}
                  </TableCell>
                  <TableCell className="text-xs px-2 py-2">
                    <div className="flex items-center space-x-1">
                      <Phone className="w-3 h-3 text-muted-foreground" />
                      <span>{application.phone_number}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs px-2 py-2">
                    {application.email ? (
                      <div
                        className="flex items-center space-x-1 group cursor-pointer"
                        onClick={() => {
                          navigator.clipboard.writeText(application.email!);
                          toast({
                            title: "Email Copied!",
                            description: `${application.email} copied to clipboard`,
                          });
                        }}
                        title="Click to copy email"
                      >
                        <MailIcon className="w-3 h-3 text-primary group-hover:text-primary/80 transition-colors" />
                        <span className="text-xs break-all max-w-[100px] truncate text-primary group-hover:text-primary/80 transition-colors">
                          {application.email}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs px-2 py-2">
                    <div className="flex items-center space-x-1">
                      <MapPin className="w-3 h-3 text-muted-foreground" />
                      <span>{application.city}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs px-2 py-2">
                    {application.ville ? (
                      <span className="text-xs">{application.ville}</span>
                    ) : (application.city === "Sousse" ||
                        application.city === "Tunis") ? (
                      (() => {
                        const matchingAmbassador = ambassadors.find(
                          (amb) =>
                            amb.phone === application.phone_number ||
                            (application.email &&
                              amb.email === application.email)
                        );
                        return matchingAmbassador?.ville ? (
                          <span className="text-xs text-muted-foreground italic">
                            {matchingAmbassador.ville}*
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            -
                          </span>
                        );
                      })()
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs px-2 py-2">
                    <div className="flex items-center gap-2">
                      {getStatusBadge(application.status)}
                      {application.status === "approved" && (
                        <div
                          className="flex items-center"
                          title={
                            emailStatus[application.id] === "sent"
                              ? language === "en"
                                ? "Email sent successfully"
                                : "Email envoyé avec succès"
                              : emailStatus[application.id] === "failed"
                                ? language === "en"
                                  ? "Email failed to send"
                                  : "Échec de l'envoi de l'email"
                                : emailStatus[application.id] === "pending"
                                  ? language === "en"
                                    ? "Email sending..."
                                    : "Envoi de l'email..."
                                  : language === "en"
                                    ? "Email status unknown"
                                    : "Statut de l'email inconnu"
                          }
                        >
                          {emailStatus[application.id] === "sent" ? (
                            <CheckCircle className="w-3 h-3 text-green-500" />
                          ) : emailStatus[application.id] === "failed" ? (
                            <XCircle className="w-3 h-3 text-red-500" />
                          ) : emailStatus[application.id] === "pending" ? (
                            <div className="w-3 h-3 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                          ) : emailFailedApplications.has(application.id) ? (
                            <XCircle className="w-3 h-3 text-red-500" />
                          ) : (
                            <MailIcon className="w-3 h-3 text-muted-foreground" />
                          )}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs px-2 py-2">
                    <div className="flex items-center space-x-1">
                      <CalendarIcon className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs">
                        {new Date(
                          application.created_at
                        ).toLocaleDateString()}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs px-2 py-2">
                    <div className="flex items-center gap-2">
                      {application.motivation && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedMotivation({
                              application,
                              motivation: application.motivation!,
                            });
                            setIsMotivationDialogOpen(true);
                          }}
                          className="inline-flex items-center justify-center p-0 m-0 border-0 bg-transparent hover:opacity-80 transition-opacity cursor-pointer"
                          title={
                            language === "en"
                              ? "Click to view motivation"
                              : "Cliquer pour voir la motivation"
                          }
                        >
                          <FileText className="w-3 h-3 text-primary" />
                        </button>
                      )}
                      {application.social_link && (
                        <div className="flex items-center">
                          <SocialLinkIcon url={application.social_link} />
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-xs px-2 py-2">
                    <div className="flex items-center justify-end gap-1">
                      {application.status === "pending" && (
                        <>
                          <Button
                            onClick={() => onApprove(application)}
                            disabled={processingId === application.id}
                            size="sm"
                            style={{
                              background: "#22C55E",
                              color: "#FFFFFF",
                              fontSize: "0.7rem",
                              padding: "0.25rem 0.5rem",
                              height: "auto",
                            }}
                            className="transform hover:scale-105 transition-all duration-300"
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.background = "#16A34A")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.background = "#22C55E")
                            }
                          >
                            {processingId === application.id ? (
                              <>
                                <div className="w-2.5 h-2.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" />
                                <span className="text-xs">{t.processing}</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle className="w-2.5 h-2.5 mr-1" />
                                <span className="text-xs">{t.approve}</span>
                              </>
                            )}
                          </Button>
                          <Button
                            onClick={() => onReject(application)}
                            disabled={processingId === application.id}
                            variant="destructive"
                            size="sm"
                            style={{
                              fontSize: "0.7rem",
                              padding: "0.25rem 0.5rem",
                              height: "auto",
                            }}
                            className="transform hover:scale-105 transition-all duration-300"
                          >
                            {processingId === application.id ? (
                              <>
                                <div className="w-2.5 h-2.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" />
                                <span className="text-xs">{t.processing}</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="w-2.5 h-2.5 mr-1" />
                                <span className="text-xs">{t.reject}</span>
                              </>
                            )}
                          </Button>
                        </>
                      )}
                      {application.status === "approved" && (
                        <div className="flex gap-1">
                          <Button
                            onClick={() => onResendEmail(application)}
                            disabled={processingId === application.id}
                            size="sm"
                            style={{
                              background: "#3B82F6",
                              color: "#FFFFFF",
                              fontSize: "0.7rem",
                              padding: "0.25rem 0.5rem",
                              height: "auto",
                            }}
                            className="transform hover:scale-105 transition-all duration-300"
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.background = "#2563EB")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.background = "#3B82F6")
                            }
                            title={
                              emailStatus[application.id] === "failed"
                                ? language === "en"
                                  ? "Email failed - Click to resend"
                                  : "Échec de l'email - Cliquez pour renvoyer"
                                : emailStatus[application.id] === "sent"
                                  ? language === "en"
                                    ? "Email sent - Click to resend"
                                    : "Email envoyé - Cliquez pour renvoyer"
                                  : language === "en"
                                    ? "Resend approval email"
                                    : "Renvoyer l'email d'approbation"
                            }
                          >
                            {processingId === application.id ? (
                              <>
                                <div className="w-2.5 h-2.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" />
                                <span className="text-xs">
                                  {language === "en"
                                    ? "Sending..."
                                    : "Envoi..."}
                                </span>
                              </>
                            ) : emailStatus[application.id] === "failed" ? (
                              <>
                                <AlertCircle className="w-2.5 h-2.5 mr-1" />
                                <span className="text-xs">
                                  {language === "en" ? "Resend" : "Renvoyer"}
                                </span>
                              </>
                            ) : emailStatus[application.id] === "sent" ? (
                              <>
                                <MailIcon className="w-2.5 h-2.5 mr-1" />
                                <span className="text-xs">
                                  {language === "en" ? "Resend" : "Renvoyer"}
                                </span>
                              </>
                            ) : (
                              <>
                                <MailIcon className="w-2.5 h-2.5 mr-1" />
                                <span className="text-xs">
                                  {language === "en" ? "Resend" : "Renvoyer"}
                                </span>
                              </>
                            )}
                          </Button>
                          <Button
                            onClick={() => onCopyCredentials(application)}
                            size="sm"
                            variant="outline"
                            style={{
                              fontSize: "0.7rem",
                              padding: "0.25rem 0.4rem",
                              height: "auto",
                              minWidth: "auto",
                            }}
                            className="transform hover:scale-105 transition-all duration-300 p-1"
                            title={
                              language === "en"
                                ? "Copy credentials to clipboard"
                                : "Copier les identifiants dans le presse-papiers"
                            }
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredApplications.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8">
                    {applicationSearchTerm ? (
                      <div className="space-y-2">
                        <p className="text-muted-foreground animate-pulse">
                          No applications found matching "
                          {applicationSearchTerm}"
                        </p>
                        <Button
                          variant="outline"
                          onClick={() => setApplicationSearchTerm("")}
                          className="transform hover:scale-105 transition-all duration-300"
                        >
                          Clear Search
                        </Button>
                      </div>
                    ) : (
                      <p className="text-muted-foreground animate-pulse">
                        {t.noApplications}
                      </p>
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog
        open={isMotivationDialogOpen}
        onOpenChange={setIsMotivationDialogOpen}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {language === "en"
                ? "Application Motivation"
                : "Motivation de la Candidature"}
            </DialogTitle>
          </DialogHeader>
          {selectedMotivation && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">
                  {language === "en" ? "Applicant:" : "Candidat:"}
                </p>
                <p className="text-lg font-semibold">
                  {selectedMotivation.application.full_name}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">
                  {language === "en" ? "Motivation:" : "Motivation:"}
                </p>
                <div className="p-4 bg-muted/50 rounded-lg border border-border max-h-[60vh] overflow-y-auto">
                  <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                    {selectedMotivation.motivation}
                  </p>
                </div>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 mt-4">
            <DialogClose asChild>
              <Button variant="outline">
                {language === "en" ? "Close" : "Fermer"}
              </Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </TabsContent>
  );
}
