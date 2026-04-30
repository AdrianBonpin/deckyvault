"use client";

import { useState, useEffect } from "react";
import { Bookmark, Plus, Trash2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface SavedFilter {
  id: string;
  name: string;
  filters: Record<string, any>;
}

interface SavedFiltersProps {
  currentFilters: Record<string, any>;
  onLoad: (filters: Record<string, any>) => void;
  className?: string;
}

export function SavedFilters({ currentFilters, onLoad, className }: SavedFiltersProps) {
  const [saved, setSaved] = useState<SavedFilter[]>([]);
  const [showSave, setShowSave] = useState(false);
  const [filterName, setFilterName] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchSaved = async () => {
    try {
      const res = await fetch("/api/saved-filters");
      if (res.ok) setSaved(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSaved();
  }, []);

  const saveCurrent = async () => {
    if (!filterName.trim()) return;

    const res = await fetch("/api/saved-filters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: filterName.trim(), filters: currentFilters }),
    });

    if (res.ok) {
      setFilterName("");
      setShowSave(false);
      fetchSaved();
    }
  };

  const deleteFilter = async (id: string) => {
    await fetch(`/api/saved-filters/${id}`, { method: "DELETE" });
    setSaved((prev) => prev.filter((f) => f.id !== id));
  };

  const hasActiveFilters = Object.values(currentFilters).some(
    (v) => v !== undefined && v !== "" && v !== "any"
  );

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-medium text-zinc-300">
          <Bookmark className="h-4 w-4" />
          Saved Filters
        </span>
        {hasActiveFilters && (
          <button
            onClick={() => setShowSave(!showSave)}
            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
          >
            <Plus className="h-3 w-3" />
            Save Current
          </button>
        )}
      </div>

      {showSave && (
        <div className="flex gap-2">
          <input
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
            placeholder="Filter name..."
            className="flex-1 rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm"
            onKeyDown={(e) => e.key === "Enter" && saveCurrent()}
          />
          <button
            onClick={saveCurrent}
            disabled={!filterName.trim()}
            className="rounded-md bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-500 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      )}

      {!loading && saved.length > 0 && (
        <div className="space-y-1">
          {saved.map((filter) => (
            <div
              key={filter.id}
              className="group flex items-center justify-between rounded-md border border-zinc-800 px-2 py-1.5 hover:bg-zinc-800/50"
            >
              <button
                onClick={() => onLoad(filter.filters)}
                className="flex-1 text-left text-sm text-zinc-300 hover:text-zinc-100"
              >
                {filter.name}
              </button>
              <button
                onClick={() => deleteFilter(filter.id)}
                className="text-zinc-500 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {!loading && saved.length === 0 && (
        <p className="text-xs text-zinc-500">No saved filters yet</p>
      )}
    </div>
  );
}
