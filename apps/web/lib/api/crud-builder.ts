/* eslint-disable @typescript-eslint/no-explicit-any */
import { Elysia, t } from "elysia"
import { db } from "@/lib/db/index"
import { getTableColumns } from "drizzle-orm"
import {
  type AnyPgTable,
  type PgColumn,
} from "drizzle-orm/pg-core"
import {
  eq,
  desc,
  asc,
  ilike,
  sql,
  type SQL,
  and,
  or,
} from "drizzle-orm"
import { requireRole } from "@/lib/auth/guard"
import { fuzzySearchTerm } from "@/lib/db/search"

/** Which columns are text-searchable via ilike */
export type CrudSearchConfig = {
  fields: string[]
}

/** Which columns support exact-match filtering via ?filter[col]=val */
export type CrudFilterConfig = {
  fields: string[]
}

/** Auth requirements per operation */
export type CrudAuthConfig = {
  read: "public" | "auth"
  write: "user" | "contributor" | "admin"
  delete: "admin" | "contributor"
}

/**
 * Create typed CRUD routes for a Drizzle table.
 *
 * @param table - Drizzle pgTable definition
 * @param config.prefix - URL prefix (e.g., "/games")
 * @param config.auth - Auth requirements per operation
 * @param config.search - Text search configuration
 * @param config.filter - Exact-match filter configuration
 * @param config.name - Human-readable name for error messages
 * @param config.primaryKey - Column name used as primary key (default: "id")
 * @param config.paramName - URL parameter name (defaults to primaryKey)
 * @param config.softDelete - If true, DELETE sets isRemoved=true instead of deleting
 */
export function createCrudRoutes<T extends AnyPgTable>(
  table: T,
  config: {
    prefix: string
    auth: CrudAuthConfig
    search?: CrudSearchConfig
    filter?: CrudFilterConfig
    name?: string
    primaryKey?: string
    paramName?: string
    softDelete?: boolean
    tags?: string[]
  },
) {
  const {
    prefix,
    auth: authConfig,
    search,
    filter,
    name = "resource",
    primaryKey = "id",
    paramName = primaryKey,
    softDelete = false,
    tags,
  } = config

  const columns = getTableColumns(table) as Record<string, PgColumn>
  const pkColumn = columns[primaryKey]

  if (!pkColumn) {
    throw new Error(`Primary key column "${primaryKey}" not found on table`)
  }

  const routes = new Elysia({
    prefix,
    ...(tags ? { detail: { tags } } : {}),
  })

  // ── LIST ──────────────────────────────────────────────────────────
  routes.get(
    "/",
    async ({ query }) => {
      const limit = Math.min(Number(query.limit) || 20, 100)
      const offset = Number(query.offset) || 0
      const sortCol = columns[query.sort as string] || pkColumn
      const order = query.order === "asc" ? asc : desc

      const conditions: SQL[] = []

      // Search
      if (query.search && search) {
        const searchStr = query.search
        const searchConditions = search.fields
          .map((field) => {
            const col = columns[field]
            if (!col) return null
            const pattern = field === "title"
              ? fuzzySearchTerm(searchStr)
              : `%${searchStr}%`
            return ilike(col, pattern)
          })
          .filter(Boolean) as SQL[]
        if (searchConditions.length > 0) {
          conditions.push(or(...searchConditions)!)
        }
      }

      // Filters
      if (filter) {
        for (const field of filter.fields) {
          const val = (query as any)[`filter_${field}`]
          if (val !== undefined) {
            const col = columns[field]
            if (col) {
              conditions.push(eq(col, val))
            }
          }
        }
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined

      const [data, countResult] = await Promise.all([
        db
          .select()
          .from(table as any)
          .where(where)
          .orderBy(order(sortCol))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(table as any)
          .where(where),
      ])

      return {
        data,
        total: countResult[0]?.count ?? 0,
        limit,
        offset,
      }
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
        sort: t.Optional(t.String()),
        order: t.Optional(t.String()),
        search: t.Optional(t.String()),
        // Dynamic filter fields are too varied for static TypeBox,
        // so we allow any string keys with filter_ prefix
      }),
      detail: {
        summary: `List ${name}s`,
        description: `Returns a paginated list of ${name}s with optional search and filtering.`,
      },
    },
  )

  // ── GET BY ID ─────────────────────────────────────────────────────
  routes.get(
    `/:${paramName}`,
    async ({ params, set }) => {
      const id = (params as any)[paramName]

      const [record] = await db
        .select()
        .from(table as any)
        .where(eq(pkColumn, id))
        .limit(1)

      if (!record) {
        set.status = 404
        return { error: `${name} not found` }
      }

      return record
    },
    {
      params: t.Object({
        [paramName]: t.String(),
      }),
      detail: {
        summary: `Get ${name} by ID`,
        description: `Returns a single ${name} by its unique identifier.`,
      },
    },
  )

  // ── CREATE ────────────────────────────────────────────────────────
  routes.post(
    "/",
    async ({ body, request, set }) => {
      // Auth check
      const roleMap: Record<string, string[]> = {
        user: ["user", "contributor", "admin"],
        contributor: ["contributor", "admin"],
        admin: ["admin"],
      }
      const allowedRoles = roleMap[authConfig.write]
      const guard = await requireRole(request.headers, allowedRoles)

      if (!guard.ok) {
        set.status = guard.status
        return { error: guard.error }
      }

      const [created] = (await db.insert(table as any).values(body as any).returning()) as any[]

      set.status = 201
      return created
    },
    {
      body: t.Record(t.String(), t.Any()),
      detail: {
        summary: `Create ${name}`,
        description: `Creates a new ${name}. Requires authentication.`,
      },
    },
  )

  // ── UPDATE ────────────────────────────────────────────────────────
  routes.patch(
    `/:${paramName}`,
    async ({ params, body, request, set }) => {
      const roleMap: Record<string, string[]> = {
        user: ["user", "contributor", "admin"],
        contributor: ["contributor", "admin"],
        admin: ["admin"],
      }
      const allowedRoles = roleMap[authConfig.write]
      const guard = await requireRole(request.headers, allowedRoles)

      if (!guard.ok) {
        set.status = guard.status
        return { error: guard.error }
      }

      const id = (params as any)[paramName]

      // Add updatedAt if column exists
      const updateData = columns["updatedAt"]
        ? { ...body, updatedAt: new Date() }
        : body

      const [updated] = (await db
        .update(table as any)
        .set(updateData as any)
        .where(eq(pkColumn, id))
        .returning()) as any[]

      if (!updated) {
        set.status = 404
        return { error: `${name} not found` }
      }

      return updated
    },
    {
      params: t.Object({
        [paramName]: t.String(),
      }),
      body: t.Record(t.String(), t.Any()),
      detail: {
        summary: `Update ${name}`,
        description: `Updates an existing ${name} by ID. Requires authentication.`,
      },
    },
  )

  // ── DELETE ────────────────────────────────────────────────────────
  routes.delete(
    `/:${paramName}`,
    async ({ params, request, set }) => {
      const guard = await requireRole(request.headers, [authConfig.delete])

      if (!guard.ok) {
        set.status = guard.status
        return { error: guard.error }
      }

      const id = (params as any)[paramName]

      if (softDelete && columns["isRemoved"]) {
        const [updated] = (await db
          .update(table as any)
          .set({ isRemoved: true, updatedAt: new Date() } as any)
          .where(eq(pkColumn, id))
          .returning()) as any[]

        if (!updated) {
          set.status = 404
          return { error: `${name} not found` }
        }

        return { success: true }
      }

      const [deleted] = (await db
        .delete(table as any)
        .where(eq(pkColumn, id))
        .returning()) as any[]

      if (!deleted) {
        set.status = 404
        return { error: `${name} not found` }
      }

      return { success: true }
    },
    {
      params: t.Object({
        [paramName]: t.String(),
      }),
      detail: {
        summary: `Delete ${name}`,
        description: `Deletes a ${name} by ID. Requires admin or contributor role.`,
      },
    },
  )

  return routes
}
