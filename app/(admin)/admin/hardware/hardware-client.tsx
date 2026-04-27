"use client"

import { useEffect, useState, FormEvent } from "react"
import {
  Gamepad2Icon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  Loader2,
  XIcon,
} from "lucide-react"
import { getDeviceColor } from "@/components/charts/EChartWrapper"

interface DeviceItem {
  slug: string
  name: string
  deviceType: string
  image: string | null
  sortOrder: number
  totalBenchmarks?: number
  avgFps?: number | null
  gameCount?: number
}

interface DeviceFormData {
  slug: string
  name: string
  deviceType: "handheld" | "console"
  image: string
  sortOrder: number
}

export function HardwareClient() {
  const [devices, setDevices] = useState<DeviceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingDevice, setEditingDevice] = useState<DeviceItem | null>(null)
  const [form, setForm] = useState<DeviceFormData>({
    slug: "",
    name: "",
    deviceType: "handheld",
    image: "",
    sortOrder: 0,
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const fetchDevices = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/hardware/stats")
      if (res.ok) {
        const data = await res.json()
        setDevices(
          (data as DeviceItem[]).map((item) => ({
            ...item,
            image: item.image ?? null,
          }))
        )
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDevices()
  }, [])

  const openCreate = () => {
    setEditingDevice(null)
    setForm({
      slug: "",
      name: "",
      deviceType: "handheld",
      image: "",
      sortOrder: 0,
    })
    setShowModal(true)
  }

  const openEdit = (device: DeviceItem) => {
    setEditingDevice(device)
    setForm({
      slug: device.slug,
      name: device.name,
      deviceType: device.deviceType as "handheld" | "console",
      image: device.image ?? "",
      sortOrder: device.sortOrder,
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingDevice(null)
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    try {
      const body = editingDevice
        ? {
            name: form.name,
            deviceType: form.deviceType,
            image: form.image || null,
            sortOrder: form.sortOrder,
          }
        : {
            slug: form.slug,
            name: form.name,
            deviceType: form.deviceType,
            image: form.image || null,
            sortOrder: form.sortOrder,
          }

      const url = editingDevice
        ? `/api/hardware/${editingDevice.slug}`
        : "/api/hardware"
      const method = editingDevice ? "PATCH" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        closeModal()
        await fetchDevices()
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (slug: string) => {
    if (!confirm("Are you sure you want to delete this device?")) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/hardware/${slug}`, { method: "DELETE" })
      if (res.ok) {
        await fetchDevices()
      }
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-text">Hardware</h1>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer"
        >
          <PlusIcon className="h-4 w-4" />
          Add Device
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-text/50">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : devices.length === 0 ? (
        <div className="text-center py-16 text-text/40">
          <Gamepad2Icon className="h-10 w-10 mx-auto mb-2" />
          <p>No devices found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {devices.map((device, index) => {
            const color = getDeviceColor(index)
            return (
              <div
                key={device.slug}
                className="rounded-xl border border-border bg-text/[0.02] p-4 flex flex-col gap-3 hover:bg-text/[0.04] transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-10 w-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${color}20`, color }}
                    >
                      <Gamepad2Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-medium text-text text-sm">
                        {device.name}
                      </h3>
                      <p className="text-xs text-text/50">/{device.slug}</p>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                      device.deviceType === "handheld"
                        ? "text-primary bg-primary/10 border-primary/20"
                        : "text-secondary bg-secondary/10 border-secondary/20"
                    }`}
                  >
                    {device.deviceType}
                  </span>
                </div>
                <div className="text-xs text-text/60">
                  {device.totalBenchmarks ?? 0} benchmarks
                </div>
                <div className="flex items-center gap-2 mt-auto">
                  <button
                    onClick={() => openEdit(device)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-text/5 text-text hover:bg-text/10 transition-colors cursor-pointer"
                  >
                    <PencilIcon className="h-3.5 w-3.5" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(device.slug)}
                    disabled={deleting}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={closeModal}
          />
          <div className="relative bg-background border border-border rounded-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-text">
                {editingDevice ? "Edit Device" : "Add Device"}
              </h2>
              <button
                onClick={closeModal}
                className="p-1 rounded-md hover:bg-text/5 text-text/60 hover:text-text transition-colors cursor-pointer"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text/70 mb-1">
                  Slug
                </label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, slug: e.target.value }))
                  }
                  disabled={!!editingDevice}
                  required
                  className="w-full px-3 py-2 rounded-md bg-text/5 border border-border text-sm text-text placeholder:text-text/40 focus:outline-none focus:border-primary/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text/70 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  required
                  className="w-full px-3 py-2 rounded-md bg-text/5 border border-border text-sm text-text placeholder:text-text/40 focus:outline-none focus:border-primary/60 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text/70 mb-1">
                  Device Type
                </label>
                <select
                  value={form.deviceType}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      deviceType: e.target.value as "handheld" | "console",
                    }))
                  }
                  className="w-full px-3 py-2 rounded-md bg-text/5 border border-border text-sm text-text focus:outline-none focus:border-primary/60 transition-colors"
                >
                  <option value="handheld">Handheld</option>
                  <option value="console">Console</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-text/70 mb-1">
                  Sort Order
                </label>
                <input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      sortOrder: Number(e.target.value),
                    }))
                  }
                  className="w-full px-3 py-2 rounded-md bg-text/5 border border-border text-sm text-text placeholder:text-text/40 focus:outline-none focus:border-primary/60 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text/70 mb-1">
                  Image URL
                </label>
                <input
                  type="text"
                  value={form.image}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, image: e.target.value }))
                  }
                  placeholder="https://..."
                  className="w-full px-3 py-2 rounded-md bg-text/5 border border-border text-sm text-text placeholder:text-text/40 focus:outline-none focus:border-primary/60 transition-colors"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-3 py-2 rounded-md text-xs font-medium bg-text/5 text-text hover:bg-text/10 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium bg-primary text-white hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {editingDevice ? "Save Changes" : "Create Device"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
