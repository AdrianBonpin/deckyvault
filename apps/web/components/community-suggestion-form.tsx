"use client";

import { useState } from "react";
import { MessageSquarePlus, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface CommunitySuggestionFormProps {
  gameId: string;
  gameTitle: string;
  editableFields: Array<{
    name: string;
    label: string;
    currentValue: string;
  }>;
  className?: string;
}

export function CommunitySuggestionForm({
  gameId,
  gameTitle,
  editableFields,
  className,
}: CommunitySuggestionFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedField, setSelectedField] = useState("");
  const [proposedValue, setProposedValue] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!selectedField || !proposedValue.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/community-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId,
          fieldName: selectedField,
          proposedValue: proposedValue.trim(),
          reason: reason.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit suggestion");
      }

      setSuccess(true);
      setTimeout(() => {
        setIsOpen(false);
        setSuccess(false);
        setSelectedField("");
        setProposedValue("");
        setReason("");
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800",
          className
        )}
      >
        <MessageSquarePlus className="h-4 w-4" />
        Suggest Edit
      </button>
    );
  }

  return (
    <div className={cn("rounded-lg border border-zinc-700 bg-zinc-900 p-4", className)}>
      <div className="mb-4 flex items-center justify-between">
        <h4 className="font-medium">Suggest an Edit for {gameTitle}</h4>
        <button onClick={() => setIsOpen(false)} className="text-zinc-400 hover:text-zinc-200">
          <X className="h-4 w-4" />
        </button>
      </div>

      {success ? (
        <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-400">
          Suggestion submitted! A moderator will review it.
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm text-zinc-400">Field</label>
            <select
              value={selectedField}
              onChange={(e) => {
                setSelectedField(e.target.value);
                const field = editableFields.find((f) => f.name === e.target.value);
                setProposedValue(field?.currentValue || "");
              }}
              className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
            >
              <option value="">Select a field...</option>
              {editableFields.map((field) => (
                <option key={field.name} value={field.name}>
                  {field.label}
                </option>
              ))}
            </select>
          </div>

          {selectedField && (
            <>
              <div>
                <label className="mb-1 block text-sm text-zinc-400">Proposed Value</label>
                <textarea
                  value={proposedValue}
                  onChange={(e) => setProposedValue(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
                  placeholder="Enter the corrected value..."
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-zinc-400">Reason (optional)</label>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
                  placeholder="Why should this be changed?"
                />
              </div>
            </>
          )}

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={!selectedField || !proposedValue.trim() || submitting}
            className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {submitting ? "Submitting..." : "Submit Suggestion"}
          </button>
        </div>
      )}
    </div>
  );
}
