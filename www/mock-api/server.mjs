#!/usr/bin/env node
/**
 * Dependency-free mock API for the MC Tracker web UI.
 *
 * Mirrors the routes/shapes in www/src/lib/api/*.ts (and the Rust API types in
 * crates/mc-api-types). All data is deterministic and generated in-process.
 *
 * Usage: node www/mock-api/server.mjs
 *        PORT=4000 node www/mock-api/server.mjs
 */

import { createHash } from "node:crypto";
import http from "node:http";

const PORT = Number.parseInt(process.env.PORT ?? "", 10) || 3000;
const DAY = 86_400;
const WEEK = 7 * DAY;
const MAX_SPAN = 10 * 365 * DAY;
const MIN_SPAN = 5 * 60;
const NOW = Math.floor(Date.now() / 1000);

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------

class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function hashString(value) {
  let hash = 2_166_136_261;
  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function uuidFrom(seed) {
  const hex = createHash("sha1").update(String(seed)).digest("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `${((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16)}${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join("-");
}

function iso(seconds) {
  return new Date(seconds * 1_000).toISOString();
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function mulberry32(seed) {
  let state = seed | 0;
  state = (state + 0x6d2b79f5) | 0;
  let value = Math.imul(state ^ (state >>> 15), 1 | state);
  value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
  return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
}

function hashInt(left, right) {
  let hash = Math.imul(left ^ 0x9e37_79b9, 0x85eb_ca6b) ^ Math.imul(right | 0, 0xc2b2_ae35);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0x27d4_eb2d);
  return (hash ^ (hash >>> 16)) >>> 0;
}

function valueNoise(seed, timestamp, period) {
  const position = timestamp / period;
  const bucket = Math.floor(position);
  const fraction = position - bucket;
  const smooth = fraction * fraction * (3 - 2 * fraction);
  const start = mulberry32(hashInt(seed, bucket));
  const end = mulberry32(hashInt(seed, bucket + 1));
  return start + (end - start) * smooth;
}

const NICE_STEPS = [
  15, 30, 60, 120, 300, 900, 1_800, 3_600, 7_200, 21_600, 86_400, 172_800,
  604_800, 1_209_600, 2_592_000,
];

function stepFor(spanSeconds) {
  const target = Math.max(spanSeconds, 15) / 800;
  for (const step of NICE_STEPS) {
    if (step >= target) return step;
  }
  return NICE_STEPS[NICE_STEPS.length - 1];
}

// ---------------------------------------------------------------------------
// Seed data: ASNs and servers
// ---------------------------------------------------------------------------

const ASNS = [
  { asn: "AS24940", asnOrg: "Hetzner Online GmbH", country: "DE" },
  { asn: "AS14061", asnOrg: "DigitalOcean, LLC", country: "US" },
  { asn: "AS16276", asnOrg: "OVH SAS", country: "FR" },
  { asn: "AS63949", asnOrg: "Akamai Connected Cloud", country: "US" },
  { asn: "AS16509", asnOrg: "Amazon.com, Inc.", country: "US" },
  { asn: "AS60781", asnOrg: "LeaseWeb Netherlands B.V.", country: "NL" },
  { asn: "AS51167", asnOrg: "Contabo GmbH", country: "DE" },
  { asn: "AS396982", asnOrg: "Google LLC", country: "US" },
];

const SERVER_DEFS = [
  { name: "Hypixel", host: "play.hypixel.net", port: 25565, type: "PC", asn: 0, base: 48_000, status: "online", version: "1.21.8", motd: "Hypixel Network §7[1.8-1.21]", favicon: true },
  { name: "Mineplex", host: "play.mineplex.com", port: 25565, type: "PC", asn: 1, base: 9_500, status: "online", version: "1.20.6", motd: "Mineplex §7- §aPlay. Compete. Win.", favicon: true },
  { name: "CubeCraft Games", host: "play.cubecraft.net", port: 25565, type: "PC", asn: 2, base: 12_400, status: "online", version: "1.21.7", motd: "CubeCraft §bGames §7| §eJava & Bedrock", favicon: true },
  { name: "The Hive", host: "play.hivebedrock.network", port: 19132, type: "PE", asn: 3, base: 18_800, status: "online", version: "Bedrock 1.21.93", motd: "The Hive §aBedrock Edition", favicon: true },
  { name: "Purple Prison", host: "play.purpleprison.net", port: 25565, type: "PC", asn: 4, base: 3_200, status: "online", version: "1.21.4", motd: "§5Purple Prison §7| §dSeason 12", favicon: false },
  { name: "2b2t", host: "connect.2b2t.org", port: 25565, type: "PC", asn: 5, base: 1_100, status: "online", version: "1.21.4", motd: "2b2t §8- §7Anarchy server", favicon: false },
  { name: "Wynncraft", host: "play.wynncraft.com", port: 25565, type: "PC", asn: 6, base: 5_400, status: "online", version: "1.20.6", motd: "Wynncraft §6The Realm of Adventure", favicon: true },
  { name: "Hypixel Bedrock", host: "bedrock.hypixel.net", port: 19132, type: "PE", asn: 0, base: 7_300, status: "online", version: "Bedrock 1.21.93", motd: "Hypixel §eBedrock Edition", favicon: true },
  { name: "Mineville", host: "play.mineville.org", port: 19132, type: "PE", asn: 7, base: 4_100, status: "online", version: "Bedrock 1.21.90", motd: "Mineville §bSurvival & Minigames", favicon: false },
  { name: "Galaxite", host: "play.galaxite.net", port: 19132, type: "PE", asn: 1, base: 2_600, status: "online", version: "Bedrock 1.21.93", motd: "Galaxite §dBedrock Minigames", favicon: false },
  { name: "Pixelmon Realms", host: "play.pixelmonrealms.com", port: 25565, type: "PC", asn: 2, base: 3_900, status: "online", version: "1.16.5", motd: "Pixelmon Realms §7| §aCatch 'em all", favicon: false },
  { name: "Origin Realms", host: "play.originrealms.com", port: 25565, type: "PC", asn: 3, base: 4_700, status: "online", version: "1.21.8", motd: "Origin Realms §aCustom survival", favicon: true },
  { name: "Manacube", host: "play.manacube.com", port: 25565, type: "PC", asn: 4, base: 2_100, status: "online", version: "1.21.7", motd: "Manacube §bNetwork §7| §eSkyblock", favicon: false },
  { name: "Complex Gaming", host: "play.complexgaming.net", port: 25565, type: "PC", asn: 5, base: 6_800, status: "online", version: "1.21.8", motd: "Complex Gaming §6§lOP Prison", favicon: true },
  { name: "PikaNetwork", host: "play.pika-network.net", port: 25565, type: "PC", asn: 6, base: 5_800, status: "online", version: "1.8.9", motd: "PikaNetwork §ePractice §7| §aSkyblock", favicon: false },
  { name: "Lifesteal SMP", host: "play.lifesteal.gg", port: 25565, type: "PC", asn: 7, base: 9_200, status: "online", version: "1.21.8", motd: "Lifesteal SMP §cSeason 6", favicon: true },
  { name: "DonutSMP", host: "play.donutsmp.net", port: 25565, type: "PC", asn: 0, base: 10_500, status: "online", version: "1.21.8", motd: "DonutSMP §6§lLifesteal", favicon: true },
  { name: "Herobrine.org", host: "play.herobrine.org", port: 25565, type: "PC", asn: 1, base: 1_800, status: "online", version: "1.21.4", motd: "Herobrine.org §7Skyblock & Prison", favicon: false },
  { name: "Skyblock.net", host: "play.skyblock.net", port: 25565, type: "PC", asn: 2, base: 3_400, status: "online", version: "1.21.7", motd: "Skyblock.net §aClassic Skyblock", favicon: false },
  { name: "Bedrock Central", host: "play.bedrockcentral.net", port: 19132, type: "PE", asn: 3, base: 1_500, status: "online", version: "Bedrock 1.21.93", motd: "Bedrock Central §bSurvival Games", favicon: false },
  { name: "NetherGames", host: "play.nethergames.org", port: 19132, type: "PE", asn: 4, base: 6_200, status: "online", version: "Bedrock 1.21.93", motd: "NetherGames §cBedrock Network", favicon: true },
  { name: "Zeqa Network", host: "play.zeqa.net", port: 19132, type: "PE", asn: 5, base: 2_900, status: "online", version: "Bedrock 1.21.90", motd: "Zeqa §6PvP & Practice", favicon: false },
  { name: "Hive Java", host: "play.hivemc.com", port: 25565, type: "PC", asn: 6, base: 2_400, status: "online", version: "1.21.8", motd: "The Hive §aJava Edition", favicon: false },
  { name: "MC-Central", host: "play.mc-central.org", port: null, type: "PC", asn: 7, base: 700, status: "online", version: "1.21.7", motd: "MC-Central §7Community server", favicon: false },
  { name: "Frostbyte", host: "play.frostbyte.gg", port: 25565, type: "PC", asn: 0, base: 1_300, status: "online", version: "1.21.8", motd: "Frostbyte §b§lWinter SMP", favicon: false },
  { name: "NebulaMC", host: "play.nebulamc.net", port: 25565, type: "PC", asn: 1, base: 900, status: "online", version: "1.21.4", motd: "NebulaMC §dSpace survival", favicon: false },
  { name: "EchoPvP", host: "play.echopvp.com", port: 25565, type: "PC", asn: 2, base: 2_200, status: "online", version: "1.8.9", motd: "EchoPvP §c§lFFA §7| §ePractice", favicon: false },
  { name: "VortexMC", host: "play.vortexmc.net", port: null, type: "PC", asn: 3, base: 1_600, status: "online", version: "1.21.8", motd: "VortexMC §9Skyblock & Prison", favicon: false },
  { name: "AstralNetwork", host: "play.astralmc.net", port: 25565, type: "PC", asn: 4, base: 2_800, status: "online", version: "1.21.7", motd: "AstralNetwork §b§lSeason 4", favicon: false },
  { name: "Bedwars Practice", host: "play.bedwarspractice.club", port: 25565, type: "PC", asn: 5, base: 1_200, status: "online", version: "1.21.8", motd: "Bedwars Practice §e§lPractice", favicon: false },
  { name: "CrackedSMP", host: "play.crackedsmp.net", port: 25565, type: "PC", asn: 6, base: 4_600, status: "online", version: "1.21.7", motd: "CrackedSMP §aLifesteal", favicon: false },
  { name: "ZenithGames", host: "play.zenithgames.net", port: 19132, type: "PE", asn: 7, base: 1_900, status: "online", version: "Bedrock 1.21.93", motd: "Zenith Games §bBedrock", favicon: false },
  { name: "LumaMC", host: "play.lumamc.net", port: 25565, type: "PC", asn: 0, base: 800, status: "offline", version: "1.21.4", motd: "LumaMC §7Under maintenance", favicon: false },
  { name: "SolarisMC", host: "play.solarismc.com", port: 25565, type: "PC", asn: 1, base: 1_100, status: "offline", version: "1.21.7", motd: "SolarisMC §eBack soon", favicon: false },
  { name: "TitanNetwork", host: "play.titanmc.net", port: 19132, type: "PE", asn: 2, base: 1_700, status: "online", version: "Bedrock 1.21.90", motd: "Titan Network §cBedrock PvP", favicon: false },
  { name: "PixelHaven", host: "play.pixelhaven.net", port: 25565, type: "PC", asn: 3, base: 600, status: "offline", version: "1.21.8", motd: "PixelHaven §7Restarting soon", favicon: false },
  { name: "AetherMC", host: "play.aethermc.net", port: 25565, type: "PC", asn: 4, base: 750, status: "online", version: "1.21.7", motd: "AetherMC §bSurvival & Events", favicon: false },
  { name: "KingsMC", host: "play.kingsmc.net", port: 25565, type: "PC", asn: 5, base: 1_400, status: "online", version: "1.21.8", motd: "KingsMC §6Kingdoms §7| §eSeason 3", favicon: false },
  { name: "CreeperHub", host: "play.creeperhub.net", port: 19132, type: "PE", asn: 6, base: 2_300, status: "offline", version: "Bedrock 1.21.93", motd: "CreeperHub §aBedrock Network", favicon: false },
  { name: "EmeraldRealms", host: "play.emeraldrealms.net", port: 25565, type: "PC", asn: 7, base: 520, status: "offline", version: "1.21.4", motd: "Emerald Realms §2SMP", favicon: false },
];

function makeFavicon(name, index) {
  const hue = (index * 47 + 13) % 360;
  const initial = name.replace(/[^A-Za-z0-9]/g, "").slice(0, 1).toUpperCase() || "?";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="12" fill="hsl(${hue} 62% 42%)"/><text x="32" y="44" font-family="sans-serif" font-size="34" font-weight="700" fill="#fff" text-anchor="middle">${initial}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

// ---------------------------------------------------------------------------
// Player history model (deterministic sine + smoothed noise)
// ---------------------------------------------------------------------------

function serverValueFloat(server, timestamp) {
  const secondsIntoDay = ((timestamp % DAY) + DAY) % DAY;
  const hour = secondsIntoDay / 3_600;
  const daily = 0.86 + 0.28 * Math.sin((2 * Math.PI * (hour - 9)) / 24);
  const weekly = 0.1 * Math.sin(2 * Math.PI * (timestamp / WEEK) + server.phase);
  const fastNoise = 0.1 * (valueNoise(server.seed, timestamp, 3_600) - 0.5);
  const slowNoise = 0.06 * (valueNoise(server.seed ^ 0x55aa, timestamp, 21_600) - 0.5);
  return Math.max(0, server.base * (daily + weekly + fastNoise + slowNoise));
}

function average24h(server, timestamp) {
  let total = 0;
  for (let sample = 0; sample < 24; sample += 1) {
    total += serverValueFloat(server, timestamp + (sample - 11.5) * 3_600);
  }
  return total / 24;
}

function average7d(server, timestamp) {
  let total = 0;
  for (let sample = 0; sample < 28; sample += 1) {
    total += serverValueFloat(server, timestamp + (sample - 13.5) * 6 * 3_600);
  }
  return total / 28;
}

function computeServerPeaks(server) {
  let allTime = 0;
  let allTimeTimestamp = NOW;
  for (let timestamp = NOW - 30 * DAY; timestamp <= NOW; timestamp += 3 * 3_600) {
    const value = serverValueFloat(server, timestamp);
    if (value > allTime) {
      allTime = value;
      allTimeTimestamp = timestamp;
    }
  }

  let peak24h = 0;
  for (let timestamp = NOW - DAY; timestamp <= NOW; timestamp += 1_800) {
    const value = serverValueFloat(server, timestamp);
    if (value > peak24h) peak24h = value;
  }

  return {
    players24h: Math.round(peak24h),
    allTime: { players: Math.round(allTime), timestamp: allTimeTimestamp },
  };
}

// ---------------------------------------------------------------------------
// Build the dataset
// ---------------------------------------------------------------------------

const servers = SERVER_DEFS.map((def, index) => {
  const asn = ASNS[def.asn];
  const id = uuidFrom(`server:${def.name}`);
  const server = {
    id,
    name: def.name,
    type: def.type,
    host: def.host,
    port: def.port,
    asn: asn.asn,
    asnOrg: asn.asnOrg,
    country: asn.country,
    version: def.version,
    motd: def.motd,
    favicon: def.favicon ? makeFavicon(def.name, index) : null,
    status: def.status,
    paused: false,
    base: def.base,
    seed: hashString(id),
    phase: ((hashString(id) % 1_000) / 1_000) * Math.PI * 2,
    createdAt: iso(NOW - (120 + index * 9) * DAY),
    updatedAt: iso(NOW - index * 3_600),
    playersOnline: null,
    peaks: null,
    trend24h: null,
    trend7d: null,
    trend30d: null,
  };
  server.peaks = computeServerPeaks(server);
  server.playersOnline =
    server.status === "online" ? Math.round(serverValueFloat(server, NOW)) : null;
  for (const [field, seconds] of [
    ["trend24h", DAY],
    ["trend7d", WEEK],
    ["trend30d", 30 * DAY],
  ]) {
    if (server.playersOnline == null) continue;
    const past = serverValueFloat(server, NOW - seconds);
    if (past < 1) continue;
    server[field] = round1(((server.playersOnline - past) / past) * 100);
  }
  return server;
});

const serverById = new Map(servers.map((server) => [server.id, server]));

const globalPeaks = (() => {
  let peak24h = 0;
  let peak7d = 0;
  for (let timestamp = NOW - DAY; timestamp <= NOW; timestamp += 3_600) {
    let total = 0;
    for (const server of servers) total += serverValueFloat(server, timestamp);
    if (total > peak24h) peak24h = total;
  }
  for (let timestamp = NOW - WEEK; timestamp <= NOW; timestamp += 3 * 3_600) {
    let total = 0;
    for (const server of servers) total += serverValueFloat(server, timestamp);
    if (total > peak7d) peak7d = total;
  }
  return { players24h: Math.round(peak24h), players7d: Math.round(peak7d) };
})();

// ---------------------------------------------------------------------------
// Serializers
// ---------------------------------------------------------------------------

function serverItem(server) {
  return {
    id: server.id,
    name: server.name,
    type: server.type,
    host: server.host,
    port: server.port,
    asn: server.asn,
    asnOrg: server.asnOrg,
    playersOnline: server.playersOnline,
    status: server.status,
    favicon: server.favicon,
    peaks: {
      players24h: server.peaks.players24h,
      allTime: server.peaks.allTime,
    },
    trend24h: server.trend24h,
    trend7d: server.trend7d,
    trend30d: server.trend30d,
    // Extra realism fields; the TS ServerListItem type does not declare these.
    version: server.version,
    motd: server.motd,
  };
}

function searchItem(server) {
  return {
    id: server.id,
    name: server.name,
    type: server.type,
    host: server.host,
    port: server.port,
    favicon: server.favicon,
    playersOnline: server.playersOnline,
    status: server.status,
  };
}

function serversSummary() {
  let totalPlayers = 0;
  let playersPc = 0;
  let playersPe = 0;
  for (const server of servers) {
    if (server.playersOnline == null) continue;
    totalPlayers += server.playersOnline;
    if (server.type === "PE") playersPe += server.playersOnline;
    else playersPc += server.playersOnline;
  }
  return {
    totalPlayers,
    playersPc,
    playersPe,
    trackedServers: servers.length,
    peaks: { players24h: globalPeaks.players24h, players7d: globalPeaks.players7d },
  };
}

function asnAggregate(asn, asnOrg) {
  const members = servers.filter(
    (server) => server.asn === asn && (asnOrg === "" || server.asnOrg === asnOrg),
  );
  if (members.length === 0) return null;
  let playersOnline = 0;
  let peak24h = 0;
  let allTimePlayers = 0;
  let allTimeTimestamp = 0;
  let playersPc = 0;
  let playersPe = 0;
  for (const server of members) {
    if (server.playersOnline != null) {
      playersOnline += server.playersOnline;
      if (server.type === "PE") playersPe += server.playersOnline;
      else playersPc += server.playersOnline;
    }
    peak24h += server.peaks.players24h;
    allTimePlayers += server.peaks.allTime.players;
    allTimeTimestamp = Math.max(allTimeTimestamp, server.peaks.allTime.timestamp);
  }
  return {
    members,
    item: {
      asn,
      asnOrg: members[0].asnOrg,
      country: members[0].country,
      playersOnline,
      serverCount: members.length,
      peaks: {
        players24h: Math.round(peak24h),
        allTime: allTimePlayers
          ? { players: Math.round(allTimePlayers), timestamp: allTimeTimestamp }
          : null,
      },
    },
    summary: {
      totalPlayers: playersOnline,
      playersPc,
      playersPe,
      trackedServers: members.length,
      peaks: { players24h: Math.round(peak24h), players7d: null },
    },
    allTimePlayers,
  };
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

function loose(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function matchesSearch(server, query) {
  const needle = loose(query);
  if (needle === "") return true;
  return [
    server.name,
    server.host,
    server.port ?? "",
    server.type,
    server.asn,
    server.asnOrg,
  ].some((value) => loose(value).includes(needle));
}

function searchRelevance(server, query) {
  const needle = loose(query);
  const name = loose(server.name);
  if (name === needle) return 5;
  if (name.startsWith(needle)) return 4;
  if (name.includes(needle)) return 3;
  if (loose(server.host).includes(needle)) return 2;
  return 1;
}

function sortServerItems(items, field, order) {
  const direction = order === "asc" ? 1 : -1;
  items.sort((left, right) => {
    if (field === "name") {
      const nameCompare = left.name.localeCompare(right.name, undefined, {
        sensitivity: "base",
      });
      return direction * (nameCompare || left.id.localeCompare(right.id));
    }
    const leftPlayers = left.playersOnline ?? -1;
    const rightPlayers = right.playersOnline ?? -1;
    const playersCompare = leftPlayers - rightPlayers;
    return direction * (playersCompare || left.name.localeCompare(right.name));
  });
  return items;
}

function parseCount(value) {
  if (value == null || value === "") return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseWindow(query) {
  const rawFrom = query.get("from");
  const rawTo = query.get("to");
  if (rawFrom == null || rawTo == null) {
    throw new HttpError(400, "invalidRange", "from and to are required");
  }
  const from = Number(rawFrom);
  const to = Number(rawTo);
  if (!Number.isFinite(from) || !Number.isFinite(to)) {
    throw new HttpError(400, "invalidRange", "from and to must be epoch seconds");
  }
  const start = Math.trunc(from);
  const end = Math.trunc(to);
  if (start >= end) {
    throw new HttpError(400, "invalidRange", "start time must be before end time");
  }
  const span = end - start;
  if (span < MIN_SPAN) {
    throw new HttpError(400, "invalidRange", "range must be at least 5 minutes");
  }
  if (span > MAX_SPAN) {
    throw new HttpError(400, "invalidRange", "range must be at most 10 years");
  }
  return { from: start, to: end, step: stepFor(span), span };
}

function buildLane(from, to, step, valueAt) {
  const start = Math.trunc(from / step) * step;
  const timestamps = [];
  const values = [];
  for (let timestamp = start; timestamp <= to; timestamp += step) {
    timestamps.push(timestamp);
    values.push(valueAt(timestamp));
  }
  return { step, timestamps, values };
}

function totalValueAt(timestamp, type) {
  let total = 0;
  for (const server of servers) {
    if (type && server.type !== type) continue;
    total += serverValueFloat(server, timestamp);
  }
  return Math.round(total);
}

function asnValueAt(members, timestamp) {
  let total = 0;
  for (const member of members) total += serverValueFloat(member, timestamp);
  return Math.round(total);
}

function eventsInRange(from, to) {
  if (to - from < 3_600) return [];
  const pausedServer = servers[32] ?? servers[0];
  const addedServer = servers[36] ?? servers[servers.length - 1];
  if (!pausedServer || !addedServer) return [];
  const marks = [
    { fraction: 0.24, eventType: "paused", server: pausedServer },
    { fraction: 0.58, eventType: "unpaused", server: pausedServer },
    { fraction: 0.81, eventType: "added", server: addedServer },
  ];
  return marks.map((mark, index) => ({
    id: uuidFrom(`event:${from}:${index}`),
    serverId: mark.server.id,
    serverName: mark.server.name,
    type: mark.server.type,
    eventType: mark.eventType,
    occurredAt: Math.floor(from + (to - from) * mark.fraction),
  }));
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Accept, Authorization, Cookie",
  );
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  );
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function sendNoContent(res) {
  res.writeHead(204);
  res.end();
}

function sendError(res, status, code, message) {
  sendJson(res, status, { code, message });
}

function sendNotFound(res) {
  sendError(res, 404, "notFound", "Not found");
}

function sendMethodNotAllowed(res) {
  sendError(res, 405, "badRequest", "method not allowed");
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_000_000) {
      throw new HttpError(413, "badRequest", "request body too large");
    }
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    throw new HttpError(400, "badRequest", "invalid JSON body");
  }
}

function parseCookies(header) {
  const cookies = {};
  if (!header) return cookies;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    cookies[part.slice(0, separator).trim()] = decodeURIComponent(
      part.slice(separator + 1).trim(),
    );
  }
  return cookies;
}

function isLoggedIn(req) {
  return parseCookies(req.headers.cookie).mc_mock_auth !== "0";
}

function setAuthCookie(res, value) {
  res.setHeader(
    "Set-Cookie",
    `mc_mock_auth=${value}; Path=/; Max-Age=31536000; SameSite=Lax`,
  );
}

// ---------------------------------------------------------------------------
// Auth, user, settings state
// ---------------------------------------------------------------------------

const demoUser = {
  id: uuidFrom("user:demo"),
  email: "demo@mctracker.local",
  displayName: "Demo User",
  role: "user",
  flags: 0,
};

const chatQuota = {
  used: 3,
  limit: 50,
  resetsAt: iso(NOW + 5 * DAY),
};

function meResponse() {
  return {
    email: demoUser.email,
    displayName: demoUser.displayName,
    role: demoUser.role,
    flags: demoUser.flags,
    chatQuota,
  };
}

const SETTING_DEFS = [
  { key: "pinger_timeout_ms", type: "INTEGER", value: 5_000 },
  { key: "pinger_retry_attempts", type: "INTEGER", value: 3 },
  { key: "pinger_retry_delay_ms", type: "INTEGER", value: 1_000 },
  { key: "players_outlier_window", type: "INTEGER", value: 30 },
  { key: "players_outlier_ratio", type: "INTEGER", value: 10 },
  { key: "players_outlier_floor", type: "INTEGER", value: 1_000 },
  { key: "dns_cache_enabled", type: "BOOLEAN", value: true },
  { key: "dns_cache_ttl_minutes", type: "INTEGER", value: 5 },
  { key: "victoriametrics_url", type: "STRING", value: "http://localhost:8428" },
  { key: "metrics_push_cron", type: "STRING", value: "*/10 * * * * *" },
  { key: "sign_up_enabled", type: "BOOLEAN", value: true },
  { key: "www_origin", type: "STRING", value: "http://localhost:5173" },
  { key: "llm_base_url", type: "STRING", value: "http://localhost:8080/v1" },
  { key: "llm_models", type: "STRING_LIST", value: ["openrouter/free", "deepseek/deepseek-v4-flash"] },
  { key: "llm_max_tool_rounds", type: "INTEGER", value: 8 },
  { key: "llm_context_max_turns", type: "INTEGER", value: 10 },
  { key: "llm_tool_max_tokens", type: "INTEGER", value: 1_024 },
  { key: "llm_final_max_tokens", type: "INTEGER", value: 2_048 },
  { key: "llm_context_max", type: "INTEGER", value: 16_384 },
  { key: "llm_context_reserve", type: "INTEGER", value: 2_048 },
  { key: "llm_timeout_secs", type: "INTEGER", value: 60 },
  { key: "llm_provider", type: "ENUM", value: "llama_cpp" },
  { key: "llm_parallel_slots", type: "INTEGER", value: 2 },
  { key: "llm_api_key", type: "STRING", value: "********" },
  { key: "llm_thinking_enabled", type: "BOOLEAN", value: true },
  { key: "llm_thinking_effort", type: "ENUM", value: "medium" },
].map((item, index) => ({ ...item, updatedAt: iso(NOW - index * 3_600) }));

const settingsByKey = new Map(SETTING_DEFS.map((item) => [item.key, item]));

function settingItem(setting) {
  return {
    key: setting.key,
    type: setting.type,
    value: setting.value,
    updatedAt: setting.updatedAt,
  };
}

const adminUsers = [
  {
    id: uuidFrom("user:admin"),
    email: "admin@mctracker.local",
    displayName: "Admin",
    role: "admin",
    flags: 3,
    createdAt: iso(NOW - 400 * DAY),
  },
  {
    id: demoUser.id,
    email: demoUser.email,
    displayName: demoUser.displayName,
    role: demoUser.role,
    flags: demoUser.flags,
    createdAt: iso(NOW - 90 * DAY),
  },
  {
    id: uuidFrom("user:zoe"),
    email: "zoe@mctracker.local",
    displayName: "Zoe",
    role: "user",
    flags: 2,
    createdAt: iso(NOW - 30 * DAY),
  },
];

// ---------------------------------------------------------------------------
// Mutable state: pins, suggestions, chat sessions, admin extras
// ---------------------------------------------------------------------------

let pinnedIds = [
  servers[0].id,
  servers[3].id,
  servers[6].id,
  servers[16].id,
];

const suggestionAuthor = { id: demoUser.id, name: demoUser.displayName };

let suggestions = [
  {
    id: uuidFrom("suggestion:1"),
    name: "SkyLegacy",
    host: "play.skylegacy.net",
    port: 25565,
    type: "PC",
    status: "pending",
    suggestedBy: suggestionAuthor,
    createdAt: iso(NOW - 2 * DAY),
    updatedAt: iso(NOW - 2 * DAY),
  },
  {
    id: uuidFrom("suggestion:2"),
    name: "BlockHaven",
    host: "play.blockhaven.net",
    port: 19132,
    type: "PE",
    status: "pending",
    suggestedBy: suggestionAuthor,
    createdAt: iso(NOW - 4 * DAY),
    updatedAt: iso(NOW - 4 * DAY),
  },
  {
    id: uuidFrom("suggestion:3"),
    name: "CraftNation",
    host: "play.craftnation.net",
    port: 25565,
    type: "PC",
    status: "denied",
    suggestedBy: suggestionAuthor,
    createdAt: iso(NOW - 12 * DAY),
    updatedAt: iso(NOW - 10 * DAY),
  },
  {
    id: uuidFrom("suggestion:4"),
    name: "JungleRealms",
    host: "play.junglerealms.net",
    port: 25565,
    type: "PC",
    status: "approved",
    suggestedBy: null,
    createdAt: iso(NOW - 20 * DAY),
    updatedAt: iso(NOW - 18 * DAY),
  },
];

function suggestionJson(suggestion) {
  return {
    id: suggestion.id,
    name: suggestion.name,
    host: suggestion.host,
    port: suggestion.port,
    type: suggestion.type,
    status: suggestion.status,
    suggestedBy: suggestion.suggestedBy,
    createdAt: suggestion.createdAt,
    updatedAt: suggestion.updatedAt,
  };
}

const extraAdminServers = [];

const chatSessions = new Map();

function createChatSession(sessionId, turns) {
  return {
    sessionId,
    updatedAt: turns.length > 0 ? iso(NOW - 3_600) : iso(NOW),
    turns,
    tokensUsed: turns.length > 0 ? 2_180 : 0,
    lastPromptTokens: turns.length > 0 ? 640 : 0,
    contextMax: 16_384,
  };
}

{
  const first = createChatSession(uuidFrom("chat-session:1"), [
    {
      role: "user",
      content: "Which server has the most players right now?",
      createdAt: iso(NOW - 5_400),
    },
    {
      role: "assistant",
      content:
        "Hypixel currently leads with the largest online count. The Hive is the biggest Bedrock network.",
      toolNames: ["get_server_stats"],
      createdAt: iso(NOW - 5_390),
    },
  ]);
  const second = createChatSession(uuidFrom("chat-session:2"), [
    {
      role: "user",
      content: "How has DonutSMP trended over the last week?",
      createdAt: iso(NOW - 90_000),
    },
    {
      role: "assistant",
      content:
        "DonutSMP has been fairly stable over the last seven days, with a peak around the weekend.",
      createdAt: iso(NOW - 89_990),
    },
  ]);
  chatSessions.set(first.sessionId, first);
  chatSessions.set(second.sessionId, second);
}

function chatSessionListItem(session) {
  const firstUserTurn = session.turns.find((turn) => turn.role === "user");
  return {
    sessionId: session.sessionId,
    updatedAt: session.updatedAt,
    preview: (firstUserTurn?.content ?? "New conversation").slice(0, 90),
    turnCount: session.turns.length,
  };
}

function chatSessionDetail(session) {
  return {
    sessionId: session.sessionId,
    turns: session.turns,
    tokensUsed: session.tokensUsed,
    lastPromptTokens: session.lastPromptTokens,
    contextMax: session.contextMax,
  };
}

function pinnedResponse() {
  const pinned = [];
  for (const id of pinnedIds) {
    const server = serverById.get(id);
    if (server) pinned.push(serverItem(server));
  }
  return { servers: pinned };
}

function adminServerItem(server) {
  return {
    id: server.id,
    name: server.name,
    type: server.type,
    host: server.host,
    port: server.port,
    createdAt: server.createdAt,
    updatedAt: server.updatedAt,
    paused: server.paused,
    playersOnline: server.playersOnline,
  };
}

function findServerInAdmin(id) {
  return serverById.get(id) ?? extraAdminServers.find((server) => server.id === id);
}

// ---------------------------------------------------------------------------
// Handlers: servers
// ---------------------------------------------------------------------------

function listServers(res, query) {
  const search = (query.get("search") ?? "").trim();
  let items = servers
    .filter((server) => matchesSearch(server, search))
    .map(serverItem);

  const platform = query.get("platform") ?? query.get("type");
  if (platform === "PC" || platform === "PE") {
    items = items.filter((server) => server.type === platform);
  }
  const asn = query.get("asn");
  if (asn) items = items.filter((server) => server.asn === asn);

  const field = query.get("sort") === "name" ? "name" : "players";
  const order = query.get("order") === "asc" ? "asc" : "desc";
  sortServerItems(items, field, order);

  const limit = parseCount(query.get("limit"));
  const offset = parseCount(query.get("offset")) ?? 0;
  if (limit != null) items = items.slice(offset, offset + limit);

  sendJson(res, 200, { summary: serversSummary(), servers: items });
}

function searchServersHandler(res, query) {
  const search = (query.get("search") ?? "").trim();
  if (search === "") {
    sendJson(res, 200, { servers: [] });
    return;
  }
  const limit = Math.min(Math.max(parseCount(query.get("limit")) ?? 10, 1), 100);
  const matches = servers
    .filter((server) => matchesSearch(server, search))
    .sort((left, right) => {
      const score = searchRelevance(right, search) - searchRelevance(left, search);
      if (score !== 0) return score;
      const players = (right.playersOnline ?? -1) - (left.playersOnline ?? -1);
      return players !== 0 ? players : left.name.localeCompare(right.name);
    })
    .slice(0, limit)
    .map(searchItem);
  sendJson(res, 200, { servers: matches });
}

function getServerResponse(res, id) {
  const server = serverById.get(id);
  if (!server) {
    sendError(res, 404, "serverNotFound", "server not found");
    return;
  }
  sendJson(res, 200, serverItem(server));
}

function serverTimeseriesResponse(res, server, window, query) {
  const series = {
    playersOnline: buildLane(window.from, window.to, window.step, (timestamp) =>
      Math.round(serverValueFloat(server, timestamp)),
    ),
  };

  if (query.get("dailyAvg") === "true") {
    series.playersDailyAvg = buildLane(window.from, window.to, window.step, (timestamp) =>
      Math.round(average24h(server, timestamp)),
    );
  }
  if (query.get("weeklyAvg") === "true") {
    series.playersWeeklyAvg = buildLane(window.from, window.to, window.step, (timestamp) =>
      Math.round(average7d(server, timestamp)),
    );
  }

  sendJson(res, 200, {
    id: server.id,
    from: window.from,
    to: window.to,
    series,
  });
}

function handleServers(req, res, segments, query, method) {
  if (segments.length === 1) {
    if (method !== "GET") return sendMethodNotAllowed(res);
    listServers(res, query);
    return;
  }

  if (segments.length === 2 && segments[1] === "search") {
    if (method !== "GET") return sendMethodNotAllowed(res);
    searchServersHandler(res, query);
    return;
  }

  if (segments.length === 3 && segments[1] === "compare" && segments[2] === "timeseries") {
    if (method !== "GET") return sendMethodNotAllowed(res);
    serversCompareTimeseries(res, query);
    return;
  }

  if (segments.length === 3 && segments[1] === "timeseries" && segments[2] === "total") {
    if (method !== "GET") return sendMethodNotAllowed(res);
    const window = parseWindow(query);
    const series = {
      playersOnline: buildLane(window.from, window.to, window.step, (timestamp) =>
        totalValueAt(timestamp),
      ),
      playersJava: buildLane(window.from, window.to, window.step, (timestamp) =>
        totalValueAt(timestamp, "PC"),
      ),
      playersBedrock: buildLane(window.from, window.to, window.step, (timestamp) =>
        totalValueAt(timestamp, "PE"),
      ),
    };
    sendJson(res, 200, {
      id: "total",
      from: window.from,
      to: window.to,
      series,
      events: eventsInRange(window.from, window.to),
    });
    return;
  }

  if (segments.length === 3 && segments[1] === "timeseries" && segments[2] === "per-server") {
    if (method !== "GET") return sendMethodNotAllowed(res);
    const window = parseWindow(query);
    const items = servers
      .slice()
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((server) => ({
        id: server.id,
        name: server.name,
        from: window.from,
        to: window.to,
        series: {
          playersOnline: buildLane(window.from, window.to, window.step, (timestamp) =>
            Math.round(serverValueFloat(server, timestamp)),
          ),
        },
      }));
    sendJson(res, 200, {
      from: window.from,
      to: window.to,
      servers: items,
      errors: [],
    });
    return;
  }

  if (segments.length === 3 && segments[2] === "timeseries") {
    if (method !== "GET") return sendMethodNotAllowed(res);
    const server = serverById.get(segments[1]);
    if (!server) return sendError(res, 404, "serverNotFound", "server not found");
    const window = parseWindow(query);
    serverTimeseriesResponse(res, server, window, query);
    return;
  }

  if (segments.length === 2) {
    if (method !== "GET") return sendMethodNotAllowed(res);
    getServerResponse(res, segments[1]);
    return;
  }

  sendNotFound(res);
}

function serversCompareTimeseries(res, query) {
  const ids = [
    ...new Set(
      (query.get("ids") ?? "")
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean),
    ),
  ];
  if (ids.length < 2 || ids.length > 5) {
    return sendError(
      res,
      400,
      "badRequest",
      "need between 2 and 5 server ids",
    );
  }
  const window = parseWindow(query);
  const items = [];
  const errors = [];
  for (const id of ids) {
    const server = serverById.get(id);
    if (!server) {
      errors.push({
        code: "notFound",
        message: "server not found",
        target: { kind: "server", id },
      });
      continue;
    }
    items.push({
      id: server.id,
      name: server.name,
      from: window.from,
      to: window.to,
      series: {
        playersOnline: buildLane(window.from, window.to, window.step, (timestamp) =>
          Math.round(serverValueFloat(server, timestamp)),
        ),
      },
    });
  }
  sendJson(res, 200, {
    from: window.from,
    to: window.to,
    servers: items,
    errors,
  });
}

// ---------------------------------------------------------------------------
// Handlers: ASNs
// ---------------------------------------------------------------------------

function handleAsns(req, res, segments, query, method) {
  if (method !== "GET") return sendMethodNotAllowed(res);

  if (segments.length === 1) {
    const search = (query.get("search") ?? "").trim();
    const aggregates = [];
    for (const asn of ASNS) {
      const aggregate = asnAggregate(asn.asn, "");
      if (!aggregate) continue;
      if (
        search !== "" &&
        !loose(`${aggregate.item.asn} ${aggregate.item.asnOrg}`).includes(loose(search))
      ) {
        continue;
      }
      aggregates.push(aggregate);
    }
    const field =
      query.get("sort") === "name"
        ? "name"
        : query.get("sort") === "servers"
          ? "servers"
          : "players";
    const order = query.get("order") === "asc" ? "asc" : "desc";
    const direction = order === "asc" ? 1 : -1;
    aggregates.sort((left, right) => {
      let compare;
      if (field === "name") {
        compare = left.item.asnOrg.localeCompare(right.item.asnOrg);
      } else if (field === "servers") {
        compare = left.item.serverCount - right.item.serverCount;
      } else {
        compare = left.item.playersOnline - right.item.playersOnline;
      }
      return direction * compare;
    });

    let items = aggregates.map((aggregate) => aggregate.item);
    const limit = parseCount(query.get("limit"));
    const offset = parseCount(query.get("offset")) ?? 0;
    if (limit != null) items = items.slice(offset, offset + limit);

    const summaryBase = serversSummary();
    sendJson(res, 200, {
      summary: {
        totalPlayers: summaryBase.totalPlayers,
        playersPc: summaryBase.playersPc,
        playersPe: summaryBase.playersPe,
        trackedAsns: aggregates.length,
        trackedServers: summaryBase.trackedServers,
        peaks: summaryBase.peaks,
      },
      asns: items,
    });
    return;
  }

  if (segments.length === 2 && segments[1] === "timeseries") {
    const asn = query.get("asn") ?? "";
    const asnOrg = (query.get("asnOrg") ?? "").trim();
    const aggregate = asnAggregate(asn, asnOrg);
    if (!aggregate) {
      return sendError(res, 404, "asnNotFound", "asn not found");
    }
    const window = parseWindow(query);
    sendJson(res, 200, {
      asn: aggregate.item.asn,
      asnOrg: aggregate.item.asnOrg,
      from: window.from,
      to: window.to,
      series: {
        playersOnline: buildLane(window.from, window.to, window.step, (timestamp) =>
          asnValueAt(aggregate.members, timestamp),
        ),
      },
    });
    return;
  }

  if (segments.length === 2) {
    const asn = segments[1];
    const asnOrg = (query.get("asnOrg") ?? "").trim();
    const aggregate = asnAggregate(asn, asnOrg);
    if (!aggregate) {
      return sendError(res, 404, "asnNotFound", "asn not found");
    }
    const items = aggregate.members.map(serverItem);
    sortServerItems(items, "players", "desc");
    sendJson(res, 200, {
      asn: aggregate.item.asn,
      asnOrg: aggregate.item.asnOrg,
      country: aggregate.item.country,
      playersOnline: aggregate.item.playersOnline,
      serverCount: aggregate.item.serverCount,
      peaks: aggregate.item.peaks,
      summary: aggregate.summary,
      servers: items,
    });
    return;
  }

  sendNotFound(res);
}

// ---------------------------------------------------------------------------
// Handlers: pinned servers
// ---------------------------------------------------------------------------

async function handlePinned(req, res, segments, method) {
  if (segments.length === 1) {
    if (method === "GET") return sendJson(res, 200, pinnedResponse());
    if (method === "POST") {
      const body = await readJsonBody(req);
      const id = typeof body.serverId === "string" ? body.serverId : "";
      if (!serverById.has(id)) {
        return sendError(res, 404, "notFound", "server not found");
      }
      if (!pinnedIds.includes(id)) pinnedIds = [...pinnedIds, id];
      return sendJson(res, 200, pinnedResponse());
    }
    return sendMethodNotAllowed(res);
  }

  if (segments.length === 2 && segments[1] === "order") {
    if (method !== "PUT") return sendMethodNotAllowed(res);
    const body = await readJsonBody(req);
    const requested = Array.isArray(body.serverIds)
      ? body.serverIds.filter((id) => typeof id === "string" && serverById.has(id))
      : [];
    const ordered = [];
    for (const id of requested) {
      if (!ordered.includes(id)) ordered.push(id);
    }
    for (const id of pinnedIds) {
      if (!ordered.includes(id)) ordered.push(id);
    }
    pinnedIds = ordered;
    return sendJson(res, 200, pinnedResponse());
  }

  if (segments.length === 2) {
    if (method !== "DELETE") return sendMethodNotAllowed(res);
    pinnedIds = pinnedIds.filter((id) => id !== segments[1]);
    return sendJson(res, 200, pinnedResponse());
  }

  sendNotFound(res);
}

// ---------------------------------------------------------------------------
// Handlers: server suggestions
// ---------------------------------------------------------------------------

async function handleServerSuggestions(req, res, segments, method) {
  if (segments.length === 1) {
    if (method !== "POST") return sendMethodNotAllowed(res);
    const body = await readJsonBody(req);
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const host = typeof body.host === "string" ? body.host.trim() : "";
    if (!name || !host) {
      return sendError(res, 400, "badRequest", "name and host are required");
    }
    const now = iso(NOW);
    const suggestion = {
      id: uuidFrom(`suggestion:${name}:${Date.now()}`),
      name,
      host,
      port: body.port == null ? null : Number.isFinite(Number(body.port)) ? Number(body.port) : null,
      type: body.type === "PE" ? "PE" : "PC",
      status: "pending",
      suggestedBy: suggestionAuthor,
      createdAt: now,
      updatedAt: now,
    };
    suggestions = [suggestion, ...suggestions];
    return sendJson(res, 200, suggestionJson(suggestion));
  }

  if (segments.length === 2 && segments[1] === "mine") {
    if (method !== "GET") return sendMethodNotAllowed(res);
    return sendJson(res, 200, {
      suggestions: suggestions
        .filter((suggestion) => suggestion.suggestedBy?.id === demoUser.id)
        .map(suggestionJson),
    });
  }

  sendNotFound(res);
}

// ---------------------------------------------------------------------------
// Handlers: chat
// ---------------------------------------------------------------------------

function chatAuthGuard(req, res) {
  if (isLoggedIn(req)) return true;
  sendError(res, 401, "unauthorized", "Log in to use chat");
  return false;
}

function handleChatSessions(res, segments, method) {
  if (segments.length === 2) {
    if (method !== "GET") return sendMethodNotAllowed(res);
    const items = [...chatSessions.values()]
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map(chatSessionListItem);
    return sendJson(res, 200, { sessions: items });
  }

  const session = chatSessions.get(segments[2]);
  if (!session) {
    return sendError(res, 404, "notFound", "chat session not found");
  }
  if (method === "GET") {
    return sendJson(res, 200, chatSessionDetail(session));
  }
  if (method === "DELETE") {
    chatSessions.delete(segments[2]);
    return sendNoContent(res);
  }
  return sendMethodNotAllowed(res);
}

async function postChat(req, res) {
  if (!chatAuthGuard(req, res)) return;

  const body = await readJsonBody(req);
  const message =
    typeof body.message === "string" && body.message.trim() !== ""
      ? body.message.trim()
      : "Hello";
  const requestedSessionId =
    typeof body.sessionId === "string" && body.sessionId.trim() !== ""
      ? body.sessionId.trim()
      : uuidFrom(`chat:${Date.now()}`);

  let session = chatSessions.get(requestedSessionId);
  if (!session) {
    session = createChatSession(requestedSessionId, []);
    chatSessions.set(requestedSessionId, session);
  }

  const contextServer =
    body.contextServer && typeof body.contextServer.serverId === "string"
      ? serverById.get(body.contextServer.serverId)
      : null;

  const reply = contextServer
    ? `${contextServer.name} is currently ${contextServer.status} with ${
        contextServer.playersOnline ?? 0
      } players online. Its 24h peak was ${contextServer.peaks.players24h}, and it is hosted on ${contextServer.asnOrg} (${contextServer.asn}).`
    : (() => {
        const summary = serversSummary();
        return `I checked the live dashboard: ${summary.trackedServers} servers are tracked with ${summary.totalPlayers} players online right now (${summary.playersPc} Java, ${summary.playersPe} Bedrock). The 24h peak was ${summary.peaks.players24h}.`;
      })();

  const userTurn = {
    role: "user",
    content: message,
    createdAt: iso(NOW),
  };
  const assistantTurn = {
    role: "assistant",
    content: reply,
    toolNames: ["get_server_stats"],
    createdAt: iso(NOW),
  };
  session.turns.push(userTurn, assistantTurn);
  session.updatedAt = new Date().toISOString();
  session.lastPromptTokens = 620 + Math.min(message.length * 3, 900);
  session.tokensUsed += session.lastPromptTokens + 180;
  chatSessions.set(session.sessionId, session);

  const usage = {
    promptTokens: session.lastPromptTokens,
    completionTokens: 140,
    contextMax: session.contextMax,
    turnTotalTokens: session.lastPromptTokens + 140,
    sessionTotalTokens: session.tokensUsed,
    cachedTokens: 512,
    reasoningTokens: 42,
  };

  const words = reply.split(" ");
  const chunks = [];
  for (let index = 0; index < words.length; index += 6) {
    chunks.push(`${words.slice(index, index + 6).join(" ")} `);
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  const writeEvent = (event) => {
    if (res.writableEnded || res.destroyed) return false;
    res.write(`data: ${JSON.stringify(event)}\n\n`);
    return true;
  };

  const frames = [
    { type: "toolStart", name: "get_server_stats" },
    { type: "toolDone", name: "get_server_stats" },
    { type: "reasoningDelta", content: "Looking up the latest player counts…" },
    ...chunks.map((content) => ({ type: "delta", content })),
    { type: "usage", usage },
  ];

  let frameIndex = 0;
  const pump = () => {
    if (res.writableEnded || res.destroyed) return;
    if (frameIndex < frames.length) {
      writeEvent(frames[frameIndex]);
      frameIndex += 1;
      setTimeout(pump, 20);
      return;
    }
    writeEvent({
      type: "done",
      toolCalls: [{ name: "get_server_stats" }],
      usage,
      finishReason: "stop",
      quotaUsed: chatQuota.used + 1,
    });
    res.end();
  };
  pump();
}

// ---------------------------------------------------------------------------
// Handlers: auth
// ---------------------------------------------------------------------------

async function handleAuth(req, res, segments, method) {
  const action = segments[1] ?? "";

  if (action === "me" && segments.length === 2) {
    if (method !== "GET") return sendMethodNotAllowed(res);
    if (!isLoggedIn(req)) {
      return sendError(res, 401, "unauthorized", "not authenticated");
    }
    return sendJson(res, 200, meResponse());
  }

  if (action === "login" && segments.length === 2) {
    if (method !== "POST") return sendMethodNotAllowed(res);
    await readJsonBody(req);
    setAuthCookie(res, "1");
    return sendJson(res, 200, {
      email: demoUser.email,
      displayName: demoUser.displayName,
      role: demoUser.role,
    });
  }

  if (action === "signup" && segments.length === 2) {
    if (method !== "POST") return sendMethodNotAllowed(res);
    await readJsonBody(req);
    setAuthCookie(res, "1");
    return sendJson(res, 200, {
      email: demoUser.email,
      displayName: demoUser.displayName,
      role: demoUser.role,
    });
  }

  if (action === "logout" && segments.length === 2) {
    if (method !== "POST") return sendMethodNotAllowed(res);
    setAuthCookie(res, "0");
    return sendNoContent(res);
  }

  if (action === "profile" && segments.length === 2) {
    if (method !== "PATCH") return sendMethodNotAllowed(res);
    const body = await readJsonBody(req);
    if (typeof body.email === "string" && body.email.trim() !== "") {
      demoUser.email = body.email.trim();
    }
    if (typeof body.displayName === "string") {
      demoUser.displayName = body.displayName;
    }
    return sendJson(res, 200, meResponse());
  }

  if (action === "password" && segments.length === 2) {
    if (method !== "PATCH") return sendMethodNotAllowed(res);
    await readJsonBody(req);
    return sendNoContent(res);
  }

  if (action === "account" && segments.length === 2) {
    if (method !== "DELETE") return sendMethodNotAllowed(res);
    await readJsonBody(req);
    setAuthCookie(res, "0");
    return sendNoContent(res);
  }

  sendNotFound(res);
}

// ---------------------------------------------------------------------------
// Handlers: admin
// ---------------------------------------------------------------------------

async function handleAdmin(req, res, segments, query, method) {
  if (segments[1] === "servers") {
    if (segments.length === 2) {
      if (method === "GET") {
        return sendJson(res, 200, {
          servers: [...servers, ...extraAdminServers].map(adminServerItem),
        });
      }
      if (method === "POST") {
        const body = await readJsonBody(req);
        const name = typeof body.name === "string" ? body.name.trim() : "";
        const host = typeof body.host === "string" ? body.host.trim() : "";
        if (!name || !host) {
          return sendError(res, 400, "badRequest", "name and host are required");
        }
        const now = iso(NOW);
        const server = {
          id: uuidFrom(`admin-server:${name}:${Date.now()}`),
          name,
          host,
          port: body.port == null ? null : Number.isFinite(Number(body.port)) ? Number(body.port) : null,
          type: body.type === "PE" ? "PE" : "PC",
          createdAt: now,
          updatedAt: now,
          paused: false,
          playersOnline: null,
        };
        extraAdminServers.push(server);
        return sendJson(res, 200, adminServerItem(server));
      }
      return sendMethodNotAllowed(res);
    }

    const server = findServerInAdmin(segments[2]);
    if (!server) return sendError(res, 404, "notFound", "server not found");
    if (method === "PATCH") {
      const body = await readJsonBody(req);
      if (typeof body.name === "string" && body.name.trim()) server.name = body.name.trim();
      if (typeof body.host === "string" && body.host.trim()) server.host = body.host.trim();
      if (body.port === null || Number.isFinite(Number(body.port))) {
        server.port = body.port === null ? null : Number(body.port);
      }
      if (body.type === "PC" || body.type === "PE") server.type = body.type;
      if (typeof body.paused === "boolean") server.paused = body.paused;
      server.updatedAt = new Date().toISOString();
      return sendJson(res, 200, adminServerItem(server));
    }
    if (method === "DELETE") {
      const trackedIndex = servers.findIndex((item) => item.id === segments[2]);
      if (trackedIndex !== -1) servers.splice(trackedIndex, 1);
      const extraIndex = extraAdminServers.findIndex((item) => item.id === segments[2]);
      if (extraIndex !== -1) extraAdminServers.splice(extraIndex, 1);
      serverById.delete(segments[2]);
      pinnedIds = pinnedIds.filter((id) => id !== segments[2]);
      return sendNoContent(res);
    }
    return sendMethodNotAllowed(res);
  }

  if (segments[1] === "settings") {
    if (segments.length === 2) {
      if (method !== "GET") return sendMethodNotAllowed(res);
      return sendJson(res, 200, {
        settings: [...settingsByKey.values()].map(settingItem),
      });
    }
    if (method !== "PATCH") return sendMethodNotAllowed(res);
    const setting = settingsByKey.get(segments[2]);
    if (!setting) return sendError(res, 404, "notFound", "setting not found");
    const body = await readJsonBody(req);
    if (body.value !== undefined) setting.value = body.value;
    setting.updatedAt = new Date().toISOString();
    return sendJson(res, 200, settingItem(setting));
  }

  if (segments[1] === "users") {
    if (segments.length === 2) {
      if (method !== "GET") return sendMethodNotAllowed(res);
      return sendJson(res, 200, { users: adminUsers });
    }
    if (segments.length === 4 && segments[3] === "flags") {
      if (method !== "PATCH") return sendMethodNotAllowed(res);
      const user = adminUsers.find((item) => item.id === segments[2]);
      if (!user) return sendError(res, 404, "notFound", "user not found");
      const body = await readJsonBody(req);
      user.flags = Number.isFinite(Number(body.flags)) ? Number(body.flags) : user.flags;
      if (user.id === demoUser.id) demoUser.flags = user.flags;
      return sendJson(res, 200, { id: user.id, flags: user.flags });
    }
    return sendNotFound(res);
  }

  if (segments[1] === "server-suggestions") {
    if (segments.length === 2) {
      if (method !== "GET") return sendMethodNotAllowed(res);
      const status = query.get("status");
      const items = suggestions
        .filter((suggestion) => (status ? suggestion.status === status : true))
        .map(suggestionJson);
      return sendJson(res, 200, { suggestions: items });
    }

    const suggestion = suggestions.find((item) => item.id === segments[2]);
    if (!suggestion) {
      return sendError(res, 404, "notFound", "suggestion not found");
    }

    if (segments.length === 4 && segments[3] === "approve") {
      if (method !== "POST") return sendMethodNotAllowed(res);
      const body = await readJsonBody(req);
      for (const field of ["name", "host", "type"]) {
        if (typeof body[field] === "string" && body[field].trim()) {
          suggestion[field] = body[field].trim();
        }
      }
      if (body.port === null || Number.isFinite(Number(body.port))) {
        suggestion.port = body.port === null ? null : Number(body.port);
      }
      suggestion.status = "approved";
      suggestion.updatedAt = new Date().toISOString();
      return sendJson(res, 200, suggestionJson(suggestion));
    }

    if (segments.length === 4 && segments[3] === "deny") {
      if (method !== "POST") return sendMethodNotAllowed(res);
      suggestion.status = "denied";
      suggestion.updatedAt = new Date().toISOString();
      return sendJson(res, 200, suggestionJson(suggestion));
    }

    if (segments.length === 3) {
      if (method !== "DELETE") return sendMethodNotAllowed(res);
      suggestions = suggestions.filter((item) => item.id !== segments[2]);
      return sendNoContent(res);
    }
  }

  sendNotFound(res);
}

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

function normalizePath(pathname) {
  let normalized = pathname.replace(/\/{2,}/g, "/");
  if (normalized === "/api") return "/";
  if (normalized.startsWith("/api/")) normalized = normalized.slice(4);
  return normalized;
}

function decodeSegment(segment) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

async function dispatch(req, res, url, segments) {
  const method = (req.method ?? "GET").toUpperCase();
  const query = url.searchParams;
  const root = segments[0];

  if (root === "health" && segments.length === 1) {
    if (method !== "GET") return sendMethodNotAllowed(res);
    return sendJson(res, 200, { status: "ok", db: true, maxmind: true });
  }

  if (root === "settings" && segments.length === 2 && segments[1] === "public") {
    if (method !== "GET") return sendMethodNotAllowed(res);
    const signUp = settingsByKey.get("sign_up_enabled");
    return sendJson(res, 200, { settings: signUp ? [settingItem(signUp)] : [] });
  }

  if (root === "servers") {
    return handleServers(req, res, segments, query, method);
  }

  if (root === "asns") {
    return handleAsns(req, res, segments, query, method);
  }

  if (root === "pinned-servers") {
    return handlePinned(req, res, segments, method);
  }

  if (root === "server-suggestions") {
    return handleServerSuggestions(req, res, segments, method);
  }

  if (root === "chat" && segments.length === 1) {
    if (method !== "POST") return sendMethodNotAllowed(res);
    return postChat(req, res);
  }

  if (root === "chat" && segments[1] === "sessions") {
    if (!chatAuthGuard(req, res)) return;
    return handleChatSessions(res, segments, method);
  }

  if (root === "auth") {
    return handleAuth(req, res, segments, method);
  }

  if (root === "admin") {
    return handleAdmin(req, res, segments, query, method);
  }

  return sendNotFound(res);
}

const httpServer = http.createServer(async (req, res) => {
  applyCors(req, res);

  if ((req.method ?? "").toUpperCase() === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const pathname = normalizePath(url.pathname);
    const segments = pathname.split("/").filter(Boolean).map(decodeSegment);
    await dispatch(req, res, url, segments);
  } catch (error) {
    if (error instanceof HttpError) {
      if (!res.headersSent) sendError(res, error.status, error.code, error.message);
      else res.end();
      return;
    }
    console.error("[mock-api]", error);
    if (!res.headersSent) {
      sendError(res, 500, "internalError", "internal server error");
    } else {
      res.end();
    }
  }
});

httpServer.listen(PORT, () => {
  console.log(`MC Tracker mock API listening on http://localhost:${PORT}`);
});

httpServer.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`[mock-api] port ${PORT} is already in use`);
  } else {
    console.error("[mock-api]", error);
  }
  process.exitCode = 1;
});
