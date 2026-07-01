import { describe, expect, it } from "vitest";

import type { ServerListItem } from "@/lib/api/servers";
import {
  asnPageDescription,
  embedMeta,
  serverPageDescription,
} from "@/lib/embed-meta";

const server: ServerListItem = {
  id: "abc",
  name: "Hypixel",
  type: "PC",
  host: "mc.hypixel.net",
  port: null,
  asn: "AS12345",
  asnOrg: "Example Host",
  playersOnline: 42_000,
  favicon: null,
  peaks: { players24h: null, allTime: null },
};

describe("embedMeta", () => {
  it("includes open graph and twitter tags", () => {
    const meta = embedMeta({ title: "MC Tracker" });

    expect(meta).toEqual(
      expect.arrayContaining([
        { title: "MC Tracker" },
        { name: "description", content: expect.any(String) },
        { property: "og:title", content: "MC Tracker" },
        { property: "og:description", content: expect.any(String) },
        { name: "twitter:card", content: expect.any(String) },
        { name: "twitter:title", content: "MC Tracker" },
        { name: "twitter:description", content: expect.any(String) },
      ]),
    );
  });

  it("marks private pages as noindex", () => {
    const meta = embedMeta({ title: "Sign in", noindex: true });

    expect(meta).toContainEqual({
      name: "robots",
      content: "noindex, nofollow",
    });
  });
});

describe("page descriptions", () => {
  it("describes a server page", () => {
    expect(serverPageDescription(server)).toBe(
      "Hypixel — 42000 players online. Java server on MC Tracker.",
    );
  });

  it("describes an asn page", () => {
    expect(
      asnPageDescription({
        asn: "AS12345",
        asnOrg: "Example Host",
        playersOnline: 50_000,
        serverCount: 12,
      }),
    ).toBe(
      "Example Host — 50000 players across 12 tracked servers on MC Tracker.",
    );
  });
});
