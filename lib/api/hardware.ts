import { createCrudRoutes } from "./crud-builder"
import { hardware } from "@/lib/db/schema"

export const hardwareRoutes = createCrudRoutes(hardware, {
  prefix: "/hardware",
  name: "Hardware",
  tags: ["Hardware"],
  primaryKey: "slug",
  auth: { read: "public", write: "admin", delete: "admin" },
  filter: { fields: ["deviceType"] },
})
