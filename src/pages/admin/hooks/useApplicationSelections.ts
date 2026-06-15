/**
 * CRUD for ambassador application draft selections.
 */

import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type {
  AmbassadorApplicationSelection,
  AmbassadorApplicationSelectionItem,
} from '../types';

const SELECTION_COLUMNS =
  'id, name, status, created_at, updated_at, created_by_admin_id, created_by_name';

const ITEM_COLUMNS =
  'id, selection_id, application_id, added_at, added_by_admin_id, added_by_name';

export type FetchSelectionsOptions = {
  includeArchived?: boolean;
  /** When true, keep showing cached drafts and refresh in the background. */
  silent?: boolean;
};

export function useApplicationSelections() {
  const [selections, setSelections] = useState<AmbassadorApplicationSelection[]>([]);
  const [selectionItems, setSelectionItems] = useState<AmbassadorApplicationSelectionItem[]>([]);
  const [loadedSelectionId, setLoadedSelectionId] = useState<string | null>(null);
  const [loadingSelections, setLoadingSelections] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);

  const fetchSelections = useCallback(async (options?: boolean | FetchSelectionsOptions) => {
    const opts: FetchSelectionsOptions =
      typeof options === 'boolean' ? { includeArchived: options } : (options ?? {});
    const { includeArchived = false, silent = false } = opts;

    if (!silent) {
      setLoadingSelections(true);
    }
    try {
      let query = supabase
        .from('ambassador_application_selections')
        .select(`${SELECTION_COLUMNS}, ambassador_application_selection_items(count)`)
        .order('created_at', { ascending: false });

      if (!includeArchived) {
        query = query.eq('status', 'draft');
      }

      const { data, error } = await query;
      if (error) throw error;

      const mapped: AmbassadorApplicationSelection[] = (data ?? []).map((row) => {
        const rawItems = (row as Record<string, unknown>).ambassador_application_selection_items;
        let count = 0;
        if (Array.isArray(rawItems) && rawItems[0] && typeof rawItems[0] === 'object') {
          count = (rawItems[0] as { count: number }).count ?? 0;
        } else if (rawItems && typeof rawItems === 'object' && 'count' in (rawItems as object)) {
          count = (rawItems as { count: number }).count ?? 0;
        }

        const { ambassador_application_selection_items: _items, ...rest } = row as Record<
          string,
          unknown
        >;
        return { ...(rest as AmbassadorApplicationSelection), item_count: count };
      });

      setSelections(mapped);
      return mapped;
    } finally {
      if (!silent) {
        setLoadingSelections(false);
      }
    }
  }, []);

  const fetchSelectionItems = useCallback(async (selectionId: string) => {
    setLoadingItems(true);
    setSelectionItems([]);
    setLoadedSelectionId(null);
    try {
      const { data, error } = await supabase
        .from('ambassador_application_selection_items')
        .select(ITEM_COLUMNS)
        .eq('selection_id', selectionId)
        .order('added_at', { ascending: false });

      if (error) throw error;
      const items = (data ?? []) as AmbassadorApplicationSelectionItem[];
      setSelectionItems(items);
      setLoadedSelectionId(selectionId);
      return items;
    } finally {
      setLoadingItems(false);
    }
  }, []);

  const createSelection = useCallback(
    async (params: {
      name: string;
      createdByAdminId: string | null;
      createdByName: string | null;
    }) => {
      const { data, error } = await supabase
        .from('ambassador_application_selections')
        .insert({
          name: params.name.trim(),
          status: 'draft',
          created_by_admin_id: params.createdByAdminId,
          created_by_name: params.createdByName,
        })
        .select(SELECTION_COLUMNS)
        .single();

      if (error) throw error;
      const created = { ...(data as AmbassadorApplicationSelection), item_count: 0 };
      setSelections((prev) => [created, ...prev]);
      return created;
    },
    [],
  );

  const archiveSelection = useCallback(async (selectionId: string) => {
    const { error } = await supabase
      .from('ambassador_application_selections')
      .update({ status: 'archived' })
      .eq('id', selectionId);

    if (error) throw error;
    setSelections((prev) => prev.filter((s) => s.id !== selectionId));
  }, []);

  const addApplicationsToSelection = useCallback(
    async (params: {
      selectionId: string;
      applicationIds: string[];
      addedByAdminId: string | null;
      addedByName: string | null;
    }) => {
      if (params.applicationIds.length === 0) {
        return { inserted: [] as AmbassadorApplicationSelectionItem[], added: 0, skipped: 0 };
      }

      const { data: existingRows, error: existingError } = await supabase
        .from('ambassador_application_selection_items')
        .select('application_id')
        .eq('selection_id', params.selectionId)
        .in('application_id', params.applicationIds);

      if (existingError) throw existingError;

      const existingIds = new Set(
        (existingRows ?? []).map((row) => row.application_id as string),
      );
      const newIds = params.applicationIds.filter((id) => !existingIds.has(id));
      const skipped = params.applicationIds.length - newIds.length;

      if (newIds.length === 0) {
        return { inserted: [] as AmbassadorApplicationSelectionItem[], added: 0, skipped };
      }

      const rows = newIds.map((applicationId) => ({
        selection_id: params.selectionId,
        application_id: applicationId,
        added_by_admin_id: params.addedByAdminId,
        added_by_name: params.addedByName,
      }));

      const { data, error } = await supabase
        .from('ambassador_application_selection_items')
        .insert(rows)
        .select(ITEM_COLUMNS);

      if (error) throw error;
      const inserted = (data ?? []) as AmbassadorApplicationSelectionItem[];

      setSelectionItems((prev) => [...inserted, ...prev]);
      setSelections((prev) =>
        prev.map((s) =>
          s.id === params.selectionId
            ? { ...s, item_count: (s.item_count ?? 0) + inserted.length }
            : s,
        ),
      );

      return { inserted, added: inserted.length, skipped };
    },
    [],
  );

  const removeApplicationFromSelection = useCallback(
    async (selectionId: string, applicationId: string) => {
      const { error } = await supabase
        .from('ambassador_application_selection_items')
        .delete()
        .eq('selection_id', selectionId)
        .eq('application_id', applicationId);

      if (error) throw error;

      setSelectionItems((prev) =>
        prev.filter(
          (item) =>
            !(item.selection_id === selectionId && item.application_id === applicationId),
        ),
      );
      setSelections((prev) =>
        prev.map((s) =>
          s.id === selectionId
            ? { ...s, item_count: Math.max(0, (s.item_count ?? 1) - 1) }
            : s,
        ),
      );
    },
    [],
  );

  const fetchSelectionItemsSnapshot = useCallback(async (selectionId: string) => {
    const { data, error } = await supabase
      .from('ambassador_application_selection_items')
      .select(ITEM_COLUMNS)
      .eq('selection_id', selectionId)
      .order('added_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as AmbassadorApplicationSelectionItem[];
  }, []);

  const clearSelectionItems = useCallback(() => {
    setSelectionItems([]);
    setLoadedSelectionId(null);
  }, []);

  return {
    selections,
    selectionItems,
    loadedSelectionId,
    loadingSelections,
    loadingItems,
    fetchSelections,
    fetchSelectionItems,
    createSelection,
    archiveSelection,
    addApplicationsToSelection,
    removeApplicationFromSelection,
    fetchSelectionItemsSnapshot,
    clearSelectionItems,
  };
}
