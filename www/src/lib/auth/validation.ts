import { z } from "zod";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const loginCredentialsSchema = z.object({
  username: z.string().trim().min(1, "Username or email is required"),
  password: z.string().min(1, "Password is required"),
});

const signupCredentialsSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .regex(EMAIL_REGEX, "Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
  displayName: z.string().trim().optional(),
});

const profileUpdateSchema = z.object({
  email: z.string().trim().min(1, "Email is required"),
  displayName: z.string().trim(),
});

export function validateLoginCredentials(input: {
  username: string;
  password: string;
}) {
  return loginCredentialsSchema.safeParse(input);
}

export function validateSignupCredentials(input: {
  email: string;
  password: string;
  displayName?: string;
}) {
  return signupCredentialsSchema.safeParse(input);
}

export function validateProfileUpdate(
  input: { email: string; displayName: string },
  options?: { originalEmail?: string },
) {
  const parsed = profileUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return parsed;
  }

  const emailChanged =
    options?.originalEmail !== undefined &&
    parsed.data.email !== options.originalEmail;

  if (emailChanged && !EMAIL_REGEX.test(parsed.data.email)) {
    return {
      success: false as const,
      error: {
        issues: [{ message: "Enter a valid email address" }],
      },
    };
  }

  return parsed;
}

/** @deprecated Use validateLoginCredentials */
export function validateCredentials(input: {
  username: string;
  password: string;
}) {
  return validateLoginCredentials(input);
}

export function isValidEmail(value: string) {
  return EMAIL_REGEX.test(value.trim());
}
