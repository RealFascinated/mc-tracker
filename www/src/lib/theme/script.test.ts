import { describe, expect, it } from "vitest"

import { THEME_STORAGE_KEY } from "@/lib/theme/context"
import { themeInitScript } from "@/lib/theme/script"

describe("theme", () => {
  it("uses mc-tracker storage key in init script", () => {
    expect(THEME_STORAGE_KEY).toBe("mc-tracker-theme")
    expect(themeInitScript).toContain("mc-tracker-theme")
  })
})
