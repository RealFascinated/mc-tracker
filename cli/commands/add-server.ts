import { Command } from "commander";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { tcpPing } from "../../src/common/utils";

const addServerCommand = new Command("add-server")
  .description("Add a server to be tracked")
  .argument("<name>", "Server display name")
  .argument("<type>", "Server type (PC|PE)")
  .argument("<ip>", "Server hostname or IP")
  .action(async (name: string, type: string, ip: string) => {
    const dataPath = path.resolve(process.cwd(), "data/servers.json");

    try {
      const content = await fs.readFile(dataPath, "utf8").catch(() => "[]");
      const servers = JSON.parse(content || "[]");

      const host = ip;
      const portNum = type && type.toUpperCase() === "PC" ? 25565 : 19132;

      const existsByIp = servers.some((s: any) => ((s.ip || "").toString().toLowerCase() === host.toLowerCase()));
      const existsByName = servers.some((s: any) => ((s.name || "").toString().toLowerCase() === name.toLowerCase()));

      if (existsByIp || existsByName) {
        console.error("Server with that name or host already exists in data/servers.json");
        process.exitCode = 1;
        return;
      }

      try {
        await tcpPing(host, portNum, 3000);
      } catch (err: any) {
        console.error(`Host ${host}:${portNum} is unreachable:`, err && err.message ? err.message : err);
        process.exitCode = 1;
        return;
      }

      const id = randomUUID();

      const entry: Record<string, unknown> = { name, id, ip: host, type };

      servers.push(entry);

      await fs.writeFile(dataPath, JSON.stringify(servers, null, 2) + "\n", "utf8");

      console.log(`Added server: ${name} (${id})`);
    } catch (err) {
      console.error("Failed to add server:", err);
      process.exitCode = 1;
    }
  });

export default addServerCommand;