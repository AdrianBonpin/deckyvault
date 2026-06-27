"use client"

import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Modal } from "./modal"

export interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title?: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: "default" | "destructive"
  loading?: boolean
  children?: React.ReactNode
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = "Confirm",
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  loading = false,
  children,
}: ConfirmDialogProps) {
  return (
    <Modal
      isOpen={open}
      onClose={loading ? () => {} : onClose}
      title={title}
      size="sm"
      showCloseButton={!loading}
    >
      <div className="space-y-4">
        {message && (
          <p className="text-sm text-text/80">{message}</p>
        )}
        {children}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className={cn(
              "inline-flex touch-target items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
              "bg-text/10 text-text hover:bg-text/20",
              loading && "opacity-70 cursor-not-allowed"
            )}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              "inline-flex touch-target items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
              variant === "destructive"
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-primary text-white hover:bg-primary/90",
              loading && "opacity-70 cursor-not-allowed"
            )}
          >
            {loading && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}
