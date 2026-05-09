import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
} from "@aws-sdk/client-s3"

// ── Configuration ──────────────────────────────────────────────────
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME ?? "deckyvault"
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL ?? ""

let _client: S3Client | null = null
let _configured = false

function getR2ConfigStatus(): { configured: boolean; reason?: string } {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    return { configured: false, reason: "Missing R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, or R2_SECRET_ACCESS_KEY" }
  }
  return { configured: true }
}

function getClient(): S3Client {
  if (_client) return _client
  const status = getR2ConfigStatus()
  if (!status.configured) {
    throw new Error(`R2 not configured: ${status.reason}`)
  }
  _client = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID!,
      secretAccessKey: R2_SECRET_ACCESS_KEY!,
    },
  })
  _configured = true
  return _client
}

// ── Upload ──────────────────────────────────────────────────────────
export async function uploadObject(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
  metadata?: Record<string, string>,
): Promise<string> {
  const client = getClient()
  await client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: contentType,
      Metadata: metadata,
    }),
  )
  return `${R2_PUBLIC_URL}/${key}`
}

// ── Delete ──────────────────────────────────────────────────────────
export async function deleteObject(key: string): Promise<void> {
  const client = getClient()
  await client.send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    }),
  )
}

// ── List ────────────────────────────────────────────────────────────
export interface ObjectInfo {
  key: string
  size: number
  lastModified: Date | undefined
}

export async function listObjects(prefix?: string): Promise<ObjectInfo[]> {
  const client = getClient()
  const result = await client.send(
    new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      Prefix: prefix,
      MaxKeys: 1000,
    }),
  )
  return (result.Contents ?? []).map((obj) => ({
    key: obj.Key!,
    size: obj.Size ?? 0,
    lastModified: obj.LastModified,
  }))
}

// ── Metadata ────────────────────────────────────────────────────────
export interface ObjectMetadata {
  contentType: string
  size: number
  lastModified: Date | undefined
}

export async function getObjectMetadata(key: string): Promise<ObjectMetadata | null> {
  const client = getClient()
  try {
    const result = await client.send(
      new HeadObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
      }),
    )
    return {
      contentType: result.ContentType ?? "application/octet-stream",
      size: result.ContentLength ?? 0,
      lastModified: result.LastModified,
    }
  } catch {
    return null
  }
}

// ── Helpers ─────────────────────────────────────────────────────────
export function isR2Configured(): boolean {
  return getR2ConfigStatus().configured
}

export function getR2PublicUrl(): string {
  return R2_PUBLIC_URL
}

export function isR2Url(url: string | null): boolean {
  if (!url || !R2_PUBLIC_URL) return false
  return url.startsWith(R2_PUBLIC_URL)
}

export { getR2ConfigStatus }