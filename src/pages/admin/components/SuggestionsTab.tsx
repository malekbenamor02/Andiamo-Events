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
import { Lightbulb, Trash2, Eye, Settings, Mail, FileText, Calendar, Music, MapPin } from "lucide-react";
import type { AudienceSuggestion } from "../types";

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
        <div className="flex justify-between items-center animate-in slide-in-from-top-4 fade-in duration-700">
          <h2 className="text-2xl font-bold text-gradient-neon animate-in slide-in-from-left-4 duration-1000">
            Audience Suggestions
          </h2>
          <div className="flex items-center gap-4 animate-in slide-in-from-right-4 duration-1000 delay-300">
            <Badge variant="secondary" className="animate-pulse">
              {filteredSuggestions.length} of {suggestions.length} suggestions
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 animate-in slide-in-from-bottom-4 duration-500 delay-400">
          <div className="relative group flex-1 min-w-[200px]">
            <Settings className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search by title, details, email, or type..."
              value={suggestionSearchTerm}
              onChange={(e) => setSuggestionSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground self-center mr-1">Status:</span>
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
          <div className="flex gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground self-center mr-1">Type:</span>
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

        <div className="rounded-md border animate-in slide-in-from-bottom-4 duration-500 delay-500">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Type</TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="max-w-[200px] hidden md:table-cell">Details</TableHead>
                <TableHead className="hidden sm:table-cell">Email</TableHead>
                <TableHead className="w-[100px]">Date</TableHead>
                <TableHead className="w-[90px]">Status</TableHead>
                <TableHead className="w-[120px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSuggestions.map((s) => (
                <TableRow
                  key={s.id}
                  className="cursor-pointer hover:bg-muted/50"
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
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
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
          <div className="text-center py-12 animate-in fade-in duration-500">
            <Lightbulb className="w-16 h-16 text-muted-foreground mx-auto mb-4 animate-pulse" />
            <h3 className="text-lg font-semibold mb-2">No suggestions match the filters</h3>
            <p className="text-muted-foreground">Try adjusting search or read filter.</p>
          </div>
        )}

        {suggestions.length === 0 && (
          <div className="text-center py-12 animate-in fade-in duration-500">
            <Lightbulb className="w-16 h-16 text-muted-foreground mx-auto mb-4 animate-pulse" />
            <h3 className="text-lg font-semibold mb-2">No suggestions yet</h3>
            <p className="text-muted-foreground">Suggestions from the website will appear here.</p>
          </div>
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
