/**
 * Admin Dashboard — Audience Suggestions tab (table, read/unread filter, detail, delete).
 */

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Lightbulb, Trash2, Eye, Search, Mail, FileText, Calendar, Music, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AudienceSuggestion } from "../types";
import {
  AdminTabHeader,
  AdminTabEmpty,
  ADMIN_TABLE_HEAD,
  ADMIN_TABLE_WRAP,
  ADMIN_TABLE_ROW,
  ADMIN_FILTERS_PANEL,
  ADMIN_FILTER_LABEL,
  ADMIN_BTN_DELETE,
} from "./AdminTabShell";

export type SuggestionReadFilter = "all" | "read" | "unread";
export type SuggestionTypeFilter = "all" | "event" | "artist" | "venue";

export interface SuggestionsTabProps {
  filteredSuggestions: AudienceSuggestion[];
  suggestions: AudienceSuggestion[];
  suggestionSearchTerm: string;
  setSuggestionSearchTerm: (v: string) => void;
  readFilter: SuggestionReadFilter;
  setReadFilter: (v: SuggestionReadFilter) => void;
  typeFilter: SuggestionTypeFilter;
  setTypeFilter: (v: SuggestionTypeFilter) => void;
  selectedSuggestion: AudienceSuggestion | null;
  onView: (s: AudienceSuggestion) => void;
  onCloseDetail: () => void;
  suggestionToDelete: AudienceSuggestion | null;
  isDeleteDialogOpen: boolean;
  setIsDeleteDialogOpen: (v: boolean) => void;
  onOpenDelete: (s: AudienceSuggestion) => void;
  onCloseDelete: () => void;
  onConfirmDelete: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  event: "Event",
  artist: "Artist",
  venue: "Venue",
};

function TypeIcon({ type }: { type: string }) {
  switch (type) {
    case "event":
      return <Calendar className="w-4 h-4" />;
    case "artist":
      return <Music className="w-4 h-4" />;
    case "venue":
      return <MapPin className="w-4 h-4" />;
    default:
      return <Lightbulb className="w-4 h-4" />;
  }
}

function truncate(str: string | null | undefined, max: number): string {
  if (str == null || str === "") return "—";
  return str.length <= max ? str : str.slice(0, max) + "…";
}

export function SuggestionsTab({
  filteredSuggestions,
  suggestions,
  suggestionSearchTerm,
  setSuggestionSearchTerm,
  readFilter,
  setReadFilter,
  typeFilter,
  setTypeFilter,
  selectedSuggestion,
  onView,
  onCloseDetail,
  suggestionToDelete,
  isDeleteDialogOpen,
  setIsDeleteDialogOpen,
  onOpenDelete,
  onCloseDelete,
  onConfirmDelete,
}: SuggestionsTabProps) {
  const unreadCount = suggestions.filter((s) => !s.read_at).length;
  const readCount = suggestions.length - unreadCount;
  const eventCount = suggestions.filter((s) => s.suggestion_type === "event").length;
  const artistCount = suggestions.filter((s) => s.suggestion_type === "artist").length;
  const venueCount = suggestions.filter((s) => s.suggestion_type === "venue").length;

  return (
    <>
      <TabsContent value="suggestions" className="space-y-6">
        <AdminTabHeader
          title="Audience Suggestions"
          subtitle={`${filteredSuggestions.length} of ${suggestions.length} suggestions`}
        />

        <div className={ADMIN_FILTERS_PANEL}>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by title, details, email, or type..."
                value={suggestionSearchTerm}
                onChange={(e) => setSuggestionSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div>
              <span className={ADMIN_FILTER_LABEL}>Status</span>
              <div className="flex flex-wrap gap-2">
                {(["all", "unread", "read"] as const).map((filter) => (
                  <Button
                    key={filter}
                    variant={readFilter === filter ? "default" : "outline"}
                    size="sm"
                    onClick={() => setReadFilter(filter)}
                  >
                    {filter === "all" && "All"}
                    {filter === "unread" && `Unread (${unreadCount})`}
                    {filter === "read" && `Read (${readCount})`}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <span className={ADMIN_FILTER_LABEL}>Type</span>
              <div className="flex flex-wrap gap-2">
                {(["all", "event", "artist", "venue"] as const).map((filter) => (
                  <Button
                    key={filter}
                    variant={typeFilter === filter ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTypeFilter(filter)}
                  >
                    {filter === "all" && "All"}
                    {filter === "event" && `Event (${eventCount})`}
                    {filter === "artist" && `Artist (${artistCount})`}
                    {filter === "venue" && `Venue (${venueCount})`}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className={ADMIN_TABLE_WRAP}>
          <Table>
            <TableHeader>
              <TableRow className={ADMIN_TABLE_ROW}>
                <TableHead className={cn(ADMIN_TABLE_HEAD, "w-[100px]")}>Type</TableHead>
                <TableHead className={ADMIN_TABLE_HEAD}>Title</TableHead>
                <TableHead className={cn(ADMIN_TABLE_HEAD, "max-w-[200px] hidden md:table-cell")}>Details</TableHead>
                <TableHead className={cn(ADMIN_TABLE_HEAD, "hidden sm:table-cell")}>Email</TableHead>
                <TableHead className={cn(ADMIN_TABLE_HEAD, "w-[100px]")}>Date</TableHead>
                <TableHead className={cn(ADMIN_TABLE_HEAD, "w-[90px]")}>Status</TableHead>
                <TableHead className={cn(ADMIN_TABLE_HEAD, "w-[120px] text-right")}>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSuggestions.map((s) => (
                <TableRow
                  key={s.id}
                  className={cn(ADMIN_TABLE_ROW, "cursor-pointer")}
                  onClick={() => onView(s)}
                >
                  <TableCell>
                    <span className="flex items-center gap-1.5">
                      <TypeIcon type={s.suggestion_type} />
                      {TYPE_LABELS[s.suggestion_type] ?? s.suggestion_type}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium">{s.title}</TableCell>
                  <TableCell className="text-muted-foreground max-w-[200px] truncate hidden md:table-cell">
                    {truncate(s.details, 60)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm hidden sm:table-cell">
                    {s.email || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(s.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {s.read_at ? (
                      <Badge variant="secondary" className="bg-green-600/30 text-green-400 border-green-500/50">
                        Read
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-amber-500/25 text-amber-400 border-amber-500/50">
                        Unread
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onView(s)}
                      className="mr-1"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className={ADMIN_BTN_DELETE}
                      onClick={() => onOpenDelete(s)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {filteredSuggestions.length === 0 && suggestions.length > 0 && (
          <AdminTabEmpty
            message="No suggestions match the filters"
            hint="Try adjusting search or read filter."
          />
        )}

        {suggestions.length === 0 && (
          <AdminTabEmpty
            message="No suggestions yet"
            hint="Suggestions from the website will appear here."
          />
        )}
      </TabsContent>

      {/* Detail dialog */}
      <Dialog open={!!selectedSuggestion} onOpenChange={(open) => !open && onCloseDetail()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TypeIcon type={selectedSuggestion?.suggestion_type ?? ""} />
              {selectedSuggestion ? TYPE_LABELS[selectedSuggestion.suggestion_type] ?? selectedSuggestion.suggestion_type : ""} — {selectedSuggestion?.title}
            </DialogTitle>
          </DialogHeader>
          {selectedSuggestion && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Details
                </p>
                <p className="mt-1 whitespace-pre-wrap">{selectedSuggestion.details || "—"}</p>
              </div>
              {selectedSuggestion.email && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Mail className="w-4 h-4" /> Email
                  </p>
                  <a
                    href={`mailto:${selectedSuggestion.email}`}
                    className="text-primary hover:underline mt-1 inline-block"
                  >
                    {selectedSuggestion.email}
                  </a>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Submitted {new Date(selectedSuggestion.created_at).toLocaleString()}
                {selectedSuggestion.read_at && (
                  <> · Read {new Date(selectedSuggestion.read_at).toLocaleString()}</>
                )}
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => onOpenDelete(selectedSuggestion)}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete suggestion</DialogTitle>
          </DialogHeader>
          <p className="mb-4">
            Are you sure you want to delete this suggestion? This action cannot be undone.
          </p>
          {suggestionToDelete && (
            <div className="bg-muted/50 rounded-lg p-4 mb-4">
              <p className="font-semibold">{suggestionToDelete.title}</p>
              <p className="text-sm text-muted-foreground">
                {TYPE_LABELS[suggestionToDelete.suggestion_type]} · {new Date(suggestionToDelete.created_at).toLocaleDateString()}
              </p>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onCloseDelete}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onConfirmDelete}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
