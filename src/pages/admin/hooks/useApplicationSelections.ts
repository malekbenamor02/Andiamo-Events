/**
 * CRUD for ambassador application draft selections (admin API + service role).
 */

import { useCallback, useState } from 'react';
import { adminApi } from '@/lib/adminApi';
import type {
  AmbassadorApplicationSelection,
  AmbassadorApplicationSelectionItem,
} from '../types';

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
      const data = await adminApi.listApplicationSelections(includeArchived);
      const mapped = (data ?? []) as AmbassadorApplicationSelection[];
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
      const items = (await adminApi.listApplicationSelectionItems(
        selectionId,
      )) as AmbassadorApplicationSelectionItem[];
      setSelectionItems(items);
      setLoadedSelectionId(selectionId);
      return items;
    } finally {
      setLoadingItems(false);
    }
  }, []);

  const createSelection = useCallback(async (params: { name: string }) => {
    const created = (await adminApi.createApplicationSelection(
      params.name.trim(),
    )) as AmbassadorApplicationSelection;
    const withCount = { ...created, item_count: created.item_count ?? 0 };
    setSelections((prev) => [withCount, ...prev]);
    return withCount;
  }, []);

  const archiveSelection = useCallback(async (selectionId: string) => {
    await adminApi.archiveApplicationSelection(selectionId);
    setSelections((prev) => prev.filter((s) => s.id !== selectionId));
  }, []);

  const addApplicationsToSelection = useCallback(
    async (params: { selectionId: string; applicationIds: string[] }) => {
      if (params.applicationIds.length === 0) {
        return { inserted: [] as AmbassadorApplicationSelectionItem[], added: 0, skipped: 0 };
      }

      const result = await adminApi.addApplicationsToSelection(
        params.selectionId,
        params.applicationIds,
      );
      const inserted = (result.data ?? []) as AmbassadorApplicationSelectionItem[];
      const added = result.added ?? inserted.length;
      const skipped = result.skipped ?? params.applicationIds.length - added;

      if (inserted.length > 0) {
        setSelectionItems((prev) => [...inserted, ...prev]);
        setSelections((prev) =>
          prev.map((s) =>
            s.id === params.selectionId
              ? { ...s, item_count: (s.item_count ?? 0) + inserted.length }
              : s,
          ),
        );
      }

      return { inserted, added, skipped };
    },
    [],
  );

  const removeApplicationFromSelection = useCallback(
    async (selectionId: string, applicationId: string) => {
      await adminApi.removeApplicationFromSelection(selectionId, applicationId);

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

  const removeApplicationsFromSelection = useCallback(
    async (selectionId: string, applicationIds: string[]) => {
      if (applicationIds.length === 0) return 0;

      await adminApi.removeApplicationsFromSelection(selectionId, applicationIds);

      const idSet = new Set(applicationIds);
      setSelectionItems((prev) =>
        prev.filter(
          (item) =>
            !(item.selection_id === selectionId && idSet.has(item.application_id)),
        ),
      );
      setSelections((prev) =>
        prev.map((s) =>
          s.id === selectionId
            ? {
                ...s,
                item_count: Math.max(
                  0,
                  (s.item_count ?? applicationIds.length) - applicationIds.length,
                ),
              }
            : s,
        ),
      );

      return applicationIds.length;
    },
    [],
  );

  const fetchSelectionItemsSnapshot = useCallback(async (selectionId: string) => {
    return (await adminApi.listApplicationSelectionItems(
      selectionId,
    )) as AmbassadorApplicationSelectionItem[];
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
    removeApplicationsFromSelection,
    fetchSelectionItemsSnapshot,
    clearSelectionItems,
  };
}
