import { Elysia, t } from "elysia"
import { db } from "@/lib/db/index"
import { user } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { requireAuth } from "@/lib/auth/guard"
import {
  uploadObject,
  deleteObject,
  isR2Configured,
  getR2PublicUrl,
  isR2Url,
} from "@/lib/storage"
import { storageObjects } from "@/lib/db/schema"

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"]
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const AVATAR_SIZE = 256

// Magic byte signatures for file type validation
const MAGIC_BYTES: Record<string, number[]> = {
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/png": [0x89, 0x50, 0x4e, 0x47],
  "image/webp": [0x52, 0x49, 0x46, 0x46], // RIFF header (WEBP container)
}

function validateMagicBytes(buffer: Buffer, declaredMime: string): boolean {
  const expected = MAGIC_BYTES[declaredMime]
  if (!expected) return false
  if (buffer.length < expected.length) return false
  return expected.every((byte, i) => buffer[i] === byte)
}

export const profilePhotoRoutes = new Elysia({ prefix: "/user" })

  // ── Upload Profile Photo ──────────────────────────────────────────
  .post(
    "/profile-photo",
    async ({ request, set }) => {
      const guard = await requireAuth(request.headers)
      if (!guard.ok) {
        set.status = guard.status
        return { error: guard.error }
      }

      if (!isR2Configured()) {
        set.status = 503
        return { error: "Storage not configured" }
      }

      // Parse multipart form data
      const formData = await request.formData()
      const file = formData.get("photo")
      if (!file || !(file instanceof File)) {
        set.status = 400
        return { error: "No file provided" }
      }

      // Validate MIME type
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        set.status = 400
        return { error: `Invalid file type. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}` }
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        set.status = 400
        return { error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB` }
      }

      // Read file buffer and validate magic bytes
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      if (!validateMagicBytes(buffer, file.type)) {
        set.status = 400
        return { error: "File content does not match declared type" }
      }

      // Generate unique key
      const timestamp = Date.now()
      const key = `avatars/${guard.user.id}-${timestamp}.webp`

      // Upload to R2 (store original; client-side resize handled later or store as-is)
      // For MVP: store the original file as-is with its original MIME type
      const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg"
      const actualKey = `avatars/${guard.user.id}-${timestamp}.${ext}`
      const publicUrl = await uploadObject(actualKey, buffer, file.type, {
        userId: guard.user.id,
        entityType: "avatar",
      })

      // Track in storage_objects
      await db.insert(storageObjects).values({
        key: actualKey,
        bucket: process.env.R2_BUCKET_NAME ?? "deckyvault",
        size: buffer.length,
        mimeType: file.type,
        entityType: "avatar",
        entityId: guard.user.id,
        uploadedBy: guard.user.id,
      })

      // Check if user had a previous custom avatar and delete it
      const [currentUser] = await db
        .select({ image: user.image })
        .from(user)
        .where(eq(user.id, guard.user.id))
        .limit(1)

      if (currentUser?.image && isR2Url(currentUser.image)) {
        // Extract the key from the URL (everything after R2_PUBLIC_URL/)
        const oldKey = currentUser.image.replace(`${getR2PublicUrl()}/`, "")
        try {
          await deleteObject(oldKey)
        } catch {
          // Log but don't block — daily cron will clean up orphaned objects
          console.warn(`Failed to delete old avatar: ${oldKey}`)
        }
        // Remove old tracking record
        await db
          .delete(storageObjects)
          .where(eq(storageObjects.key, oldKey))
      }

      // Update user.image
      await db
        .update(user)
        .set({ image: publicUrl, updatedAt: new Date() })
        .where(eq(user.id, guard.user.id))

      return { url: publicUrl }
    },
  )

  // ── Delete Profile Photo ──────────────────────────────────────────
  .delete(
    "/profile-photo",
    async ({ request, set }) => {
      const guard = await requireAuth(request.headers)
      if (!guard.ok) {
        set.status = guard.status
        return { error: guard.error }
      }

      const [currentUser] = await db
        .select({ image: user.image })
        .from(user)
        .where(eq(user.id, guard.user.id))
        .limit(1)

      if (!currentUser?.image || !isR2Url(currentUser.image)) {
        return { success: true, message: "No custom photo to delete" }
      }

      // Delete from R2
      const oldKey = currentUser.image.replace(`${getR2PublicUrl()}/`, "")
      try {
        await deleteObject(oldKey)
      } catch {
        console.warn(`Failed to delete avatar from R2: ${oldKey}`)
      }

      // Remove tracking record
      await db
        .delete(storageObjects)
        .where(eq(storageObjects.key, oldKey))

      // Clear user.image
      await db
        .update(user)
        .set({ image: null, updatedAt: new Date() })
        .where(eq(user.id, guard.user.id))

      return { success: true }
    },
  )