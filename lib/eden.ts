import { treaty } from "@elysia/eden"
import { app } from "@/app/api/[[...slugs]]/route"

export const api =
  typeof process !== "undefined"
    ? treaty(app).api
    : treaty<typeof app>("localhost:3000").api
