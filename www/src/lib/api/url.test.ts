import { describe, expect, it } from "vitest"

import { apiUrl } from "@/lib/api/url"

describe("apiUrl", () => {
  it("joins base URL and path", () => {
    expect(apiUrl("/servers")).toMatch(/\/servers$/)
  })
})
