/**
 * Admin Dashboard — Logs & Analytics tab.
 * Extracted from Dashboard.tsx for maintainability.
 */

import React from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TabsContent } from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Calendar } from "@/components/ui/calendar";
import { Database, Filter, RefreshCw, Eye, X, ShieldAlert } from "lucide-react";
import { Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { AdminLog, LogsFilters, LogsPagination } from "../types";

const DEFAULT_LOGS_FILTERS: LogsFilters = {
  type: [],
  category: "",
  userRole: "",
  startDate: null,
  endDate: null,
  search: "",
  sortBy: "time",
  order: "desc",
};

export interface CspReport {
  id: string;
  document_uri: string;
  referrer?: string;
  violated_directive: string;
  effective_directive?: string;
  blocked_uri: string;
  source_file?: string;
  line_number?: number;
  column_number?: number;
  created_at: string;
}

export interface LogsTabProps {
  language: "en" | "fr";
  logs: AdminLog[];
  loading: boolean;
  logsFilters: LogsFilters;
  setLogsFilters: (v: LogsFilters | ((prev: LogsFilters) => LogsFilters)) => void;
  logsPagination: LogsPagination;
  setLogsPagination: (v: LogsPagination | ((prev: LogsPagination) => LogsPagination)) => void;
  autoRefresh: boolean;
  setAutoRefresh: (v: boolean) => void;
  selectedLog: AdminLog | null;
  setSelectedLog: (v: AdminLog | null) => void;
  isLogDrawerOpen: boolean;
  setIsLogDrawerOpen: (v: boolean) => void;
  onRefresh: (reset?: boolean) => void;
  cspReports?: CspReport[];
  loadingCspReports?: boolean;
  onRefreshCspReports?: () => void;
}

export function LogsTab({
  language,
  logs,
  loading,
  logsFilters,
  setLogsFilters,
  logsPagination,
  setLogsPagination,
  autoRefresh,
  setAutoRefresh,
  selectedLog,
  setSelectedLog,
  isLogDrawerOpen,
  setIsLogDrawerOpen,
  onRefresh,
  cspReports = [],
  loadingCspReports = false,
  onRefreshCspReports,
}: LogsTabProps) {
  return (
    <TabsContent value="logs" className="space-y-6">
      <div className="flex justify-between items-center animate-in slide-in-from-top-4 fade-in duration-700">
        <div>
          <h2 className="text-2xl font-bold text-gradient-neon animate-in slide-in-from-left-4 duration-1000">
            {language === "en" ? "Site Logs & Analytics" : "Journaux et Analytiques du Site"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {language === "en"
              ? "Comprehensive view of all system logs, security events, and activity"
              : "Vue complète de tous les journaux système, événements de sécurité et activités"}
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border">
            <Switch
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
              id="auto-refresh"
            />
            <Label htmlFor="auto-refresh" className="text-sm cursor-pointer">
              {language === "en" ? "Auto-refresh" : "Actualisation auto"}
            </Label>
          </div>
          <Button
            onClick={() => onRefresh(true)}
            disabled={loading}
            variant="outline"
            className="animate-in slide-in-from-right-4 duration-1000"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            {language === "en" ? "Refresh" : "Actualiser"}
          </Button>
        </div>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-primary" />
            {language === "en" ? "Filters" : "Filtres"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>{language === "en" ? "Log Type" : "Type de Log"}</Label>
              <Select
                value={logsFilters.type[0] || "all"}
                onValueChange={(value) => {
                  setLogsFilters((prev) => ({
                    ...prev,
                    type: value && value !== "all" ? [value] : [],
                  }));
                  setTimeout(() => onRefresh(true), 100);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={language === "en" ? "All types" : "Tous les types"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{language === "en" ? "All types" : "Tous les types"}</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="action">Action</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{language === "en" ? "Category" : "Catégorie"}</Label>
              <Input
                placeholder={language === "en" ? "Filter by category" : "Filtrer par catégorie"}
                value={logsFilters.category}
                onChange={(e) => setLogsFilters((prev) => ({ ...prev, category: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onRefresh(true);
                }}
              />
            </div>

            <div className="space-y-2">
              <Label>{language === "en" ? "User Role" : "Rôle Utilisateur"}</Label>
              <Select
                value={logsFilters.userRole || "all"}
                onValueChange={(value) => {
                  setLogsFilters((prev) => ({
                    ...prev,
                    userRole: value && value !== "all" ? value : "",
                  }));
                  setTimeout(() => onRefresh(true), 100);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={language === "en" ? "All roles" : "Tous les rôles"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{language === "en" ? "All roles" : "Tous les rôles"}</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="ambassador">Ambassador</SelectItem>
                  <SelectItem value="guest">Guest</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{language === "en" ? "Search" : "Recherche"}</Label>
              <div className="flex gap-2">
                <Input
                  placeholder={language === "en" ? "Search messages..." : "Rechercher messages..."}
                  value={logsFilters.search}
                  onChange={(e) => setLogsFilters((prev) => ({ ...prev, search: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onRefresh(true);
                  }}
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    setLogsFilters(DEFAULT_LOGS_FILTERS);
                    setTimeout(() => onRefresh(true), 100);
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{language === "en" ? "Start Date" : "Date de début"}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !logsFilters.startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {logsFilters.startDate ? format(logsFilters.startDate, "PPP") : (
                      <span>{language === "en" ? "Pick a date" : "Choisir une date"}</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={logsFilters.startDate || undefined}
                    onSelect={(date) => {
                      setLogsFilters((prev) => ({ ...prev, startDate: date || null }));
                      if (date) setTimeout(() => onRefresh(true), 100);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>{language === "en" ? "End Date" : "Date de fin"}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !logsFilters.endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {logsFilters.endDate ? format(logsFilters.endDate, "PPP") : (
                      <span>{language === "en" ? "Pick a date" : "Choisir une date"}</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={logsFilters.endDate || undefined}
                    onSelect={(date) => {
                      setLogsFilters((prev) => ({ ...prev, endDate: date || null }));
                      if (date) setTimeout(() => onRefresh(true), 100);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" />
            {language === "en" ? "Activity Logs" : "Journaux d'Activité"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {language === "en"
              ? `Showing ${logs.length} of ${logsPagination.total} logs`
              : `Affichage de ${logs.length} sur ${logsPagination.total} logs`}
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">
                {language === "en" ? "Loading logs..." : "Chargement des logs..."}
              </span>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{language === "en" ? "No logs found" : "Aucun log trouvé"}</p>
              <p className="text-xs mt-2">
                {language === "en"
                  ? "Try adjusting your filters or date range"
                  : "Essayez d'ajuster vos filtres ou votre plage de dates"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{language === "en" ? "Time" : "Heure"}</TableHead>
                      <TableHead>{language === "en" ? "Type" : "Type"}</TableHead>
                      <TableHead>{language === "en" ? "Category" : "Catégorie"}</TableHead>
                      <TableHead>{language === "en" ? "Source" : "Source"}</TableHead>
                      <TableHead>{language === "en" ? "User" : "Utilisateur"}</TableHead>
                      <TableHead>{language === "en" ? "Message" : "Message"}</TableHead>
                      <TableHead>{language === "en" ? "Actions" : "Actions"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow
                        key={log.id}
                        className={cn(
                          "hover:bg-muted/30 transition-colors cursor-pointer",
                          log.log_type === "error" && "bg-red-500/5"
                        )}
                        onClick={() => {
                          setSelectedLog(log);
                          setIsLogDrawerOpen(true);
                        }}
                      >
                        <TableCell className="text-sm text-muted-foreground">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                {format(new Date(log.created_at), "MMM dd, yyyy HH:mm:ss")}
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{new Date(log.created_at).toISOString()}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              log.log_type === "error"
                                ? "destructive"
                                : log.log_type === "warning"
                                  ? "default"
                                  : log.log_type === "success"
                                    ? "default"
                                    : "secondary"
                            }
                            className={cn(
                              log.log_type === "error" && "bg-red-500",
                              log.log_type === "warning" && "bg-yellow-500",
                              log.log_type === "success" && "bg-green-500"
                            )}
                          >
                            {log.log_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{log.category}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {log.source}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{log.user_type || "guest"}</Badge>
                        </TableCell>
                        <TableCell className="max-w-md">
                          <p className="truncate text-sm">{log.message}</p>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLog(log);
                              setIsLogDrawerOpen(true);
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between pt-4">
                <div className="text-sm text-muted-foreground">
                  {language === "en"
                    ? `Showing ${logsPagination.offset + 1}-${Math.min(logsPagination.offset + logs.length, logsPagination.total)} of ${logsPagination.total}`
                    : `Affichage de ${logsPagination.offset + 1}-${Math.min(logsPagination.offset + logs.length, logsPagination.total)} sur ${logsPagination.total}`}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setLogsPagination((prev) => ({
                        ...prev,
                        offset: Math.max(0, prev.offset - prev.limit),
                      }));
                      setTimeout(() => onRefresh(), 100);
                    }}
                    disabled={logsPagination.offset === 0}
                  >
                    {language === "en" ? "Previous" : "Précédent"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setLogsPagination((prev) => ({ ...prev, offset: prev.offset + prev.limit }));
                      setTimeout(() => onRefresh(), 100);
                    }}
                    disabled={!logsPagination.hasMore}
                  >
                    {language === "en" ? "Next" : "Suivant"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-500" />
            {language === "en" ? "CSP Violations" : "Violations CSP"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {language === "en"
              ? "Content Security Policy violation reports from browsers"
              : "Rapports de violations CSP envoyés par les navigateurs"}
          </p>
          {onRefreshCspReports && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={onRefreshCspReports}
              disabled={loadingCspReports}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loadingCspReports ? "animate-spin" : ""}`} />
              {language === "en" ? "Refresh" : "Actualiser"}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {loadingCspReports ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">
                {language === "en" ? "Loading CSP reports..." : "Chargement des rapports CSP..."}
              </span>
            </div>
          ) : cspReports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ShieldAlert className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{language === "en" ? "No CSP violations reported" : "Aucune violation CSP signalée"}</p>
              <p className="text-xs mt-2">
                {language === "en"
                  ? "Browser will send reports when CSP rules are violated"
                  : "Le navigateur enverra des rapports lorsque les règles CSP sont violées"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === "en" ? "Time" : "Heure"}</TableHead>
                    <TableHead>{language === "en" ? "Directive" : "Directive"}</TableHead>
                    <TableHead>{language === "en" ? "Blocked URI" : "URI bloquée"}</TableHead>
                    <TableHead>{language === "en" ? "Document" : "Document"}</TableHead>
                    <TableHead>{language === "en" ? "Source" : "Source"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cspReports.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(r.created_at), "MMM dd, HH:mm:ss")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {r.violated_directive}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate font-mono text-xs" title={r.blocked_uri}>
                        {r.blocked_uri}
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate text-xs" title={r.document_uri}>
                        {r.document_uri}
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.source_file && r.line_number != null
                          ? `${r.source_file}:${r.line_number}`
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Drawer open={isLogDrawerOpen} onOpenChange={setIsLogDrawerOpen}>
        <DrawerContent className="max-h-[80vh]">
          <DrawerHeader>
            <DrawerTitle>
              {language === "en" ? "Log Details" : "Détails du Log"}
            </DrawerTitle>
            <DrawerDescription>{selectedLog?.message}</DrawerDescription>
          </DrawerHeader>
          {selectedLog && (
            <div className="px-4 pb-4 overflow-y-auto">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      {language === "en" ? "Type" : "Type"}
                    </Label>
                    <Badge className="mt-1">{selectedLog.log_type}</Badge>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      {language === "en" ? "Category" : "Catégorie"}
                    </Label>
                    <p className="mt-1 text-sm">{selectedLog.category}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      {language === "en" ? "Source" : "Source"}
                    </Label>
                    <p className="mt-1 text-sm">{selectedLog.source}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      {language === "en" ? "User Type" : "Type d'Utilisateur"}
                    </Label>
                    <p className="mt-1 text-sm">{selectedLog.user_type || "guest"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      {language === "en" ? "Created At" : "Créé le"}
                    </Label>
                    <p className="mt-1 text-sm">
                      {new Date(selectedLog.created_at).toLocaleString()}
                    </p>
                  </div>
                  {selectedLog.ip_address && (
                    <div>
                      <Label className="text-xs text-muted-foreground">IP Address</Label>
                      <p className="mt-1 text-sm">{selectedLog.ip_address}</p>
                    </div>
                  )}
                  {selectedLog.request_method && (
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        {language === "en" ? "Request Method" : "Méthode de Requête"}
                      </Label>
                      <p className="mt-1 text-sm">{selectedLog.request_method}</p>
                    </div>
                  )}
                  {selectedLog.request_path && (
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        {language === "en" ? "Request Path" : "Chemin de Requête"}
                      </Label>
                      <p className="mt-1 text-sm font-mono text-xs">{selectedLog.request_path}</p>
                    </div>
                  )}
                  {selectedLog.response_status != null && (
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        {language === "en" ? "Response Status" : "Statut de Réponse"}
                      </Label>
                      <Badge
                        className={cn(
                          "mt-1",
                          selectedLog.response_status >= 200 &&
                            selectedLog.response_status < 300 &&
                            "bg-green-500",
                          selectedLog.response_status >= 400 &&
                            selectedLog.response_status < 500 &&
                            "bg-yellow-500",
                          selectedLog.response_status >= 500 && "bg-red-500"
                        )}
                      >
                        {selectedLog.response_status}
                      </Badge>
                    </div>
                  )}
                </div>
                {selectedLog.details && (
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      {language === "en" ? "Details (JSON)" : "Détails (JSON)"}
                    </Label>
                    <pre className="mt-2 p-4 bg-muted/50 rounded-lg text-xs overflow-auto max-h-64">
                      {JSON.stringify(selectedLog.details, null, 2)}
                    </pre>
                  </div>
                )}
                {selectedLog.error_stack && (
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      {language === "en" ? "Error Stack" : "Pile d'Erreur"}
                    </Label>
                    <pre className="mt-2 p-4 bg-red-500/10 rounded-lg text-xs overflow-auto max-h-64 font-mono">
                      {selectedLog.error_stack}
                    </pre>
                  </div>
                )}
                {selectedLog.user_agent && (
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      {language === "en" ? "User Agent" : "Agent Utilisateur"}
                    </Label>
                    <p className="mt-1 text-xs font-mono break-all">{selectedLog.user_agent}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </TabsContent>
  );
}
