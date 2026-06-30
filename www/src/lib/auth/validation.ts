import { z } from "zod"

export const credentialsSchema = z.object({
  username: z.string().trim().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
})

export function validateCredentials(input: {
  username: string
  password: string
}) {
  return credentialsSchema.safeParse(input)
}
