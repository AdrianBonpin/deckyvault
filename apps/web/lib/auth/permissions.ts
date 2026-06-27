import { createAccessControl } from "better-auth/plugins/access"
import {
  defaultStatements,
  adminAc,
} from "better-auth/plugins/admin/access"

const statement = {
  ...defaultStatements,
  game: ["create", "update", "delete", "review"],
  performance: ["submit", "verify", "delete"],
  hardware: ["create", "update"],
  profile: ["view", "edit"],
} as const

export const ac = createAccessControl(statement)

export const user = ac.newRole({
  profile: ["view"],
  performance: ["submit"],
})

export const contributor = ac.newRole({
  ...user.statements,
  profile: ["view", "edit"],
  performance: ["submit", "verify"],
  game: ["create", "update"],
  hardware: ["update"],
})

export const moderator = ac.newRole({
  ...contributor.statements,
  performance: ["submit", "verify", "delete"],
  game: ["create", "update", "review"],
})

export const admin = ac.newRole({
  ...adminAc.statements,
  ...moderator.statements,
  game: ["create", "update", "delete", "review"],
  performance: ["submit", "verify", "delete"],
  hardware: ["create", "update"],
  profile: ["view", "edit"],
})

export const ROLES = ["user", "contributor", "moderator", "admin"] as const
export type RoleName = (typeof ROLES)[number]
