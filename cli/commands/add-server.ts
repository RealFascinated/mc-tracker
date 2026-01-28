import { Command } from "commander";
import { promises as fs } from "fs";
import path from "path";
import { randomUUIDv7 } from "bun";
import { pingPC, pingPE } from "../../src/common/minecraft-ping";
import { resolveDns } from "../../src/common/dns-resolver";

const addServerCommand = new Command("add-server")
  .description("Add a server to be tracked")
  .argument("<name>", "Server display name")
  .argument("<type>", "Server type (PC|PE)")
  .argument("<ip>", "Server hostname or IP")
  .option("--skip-ping", "Skip server ping validation")
  .action(async (name: string, type: string, ip: string, options: { skipPing?: boolean }) => {
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
        process.exit(1);
      }

      if (!options.skipPing) {
        try {
          console.log(`Validating server ${host}:${portNum}...`);
          
          let pingResult;
          if (type && type.toUpperCase() === "PC") {
            // Try to resolve DNS for PC servers
            try {
              const resolved = await resolveDns(host);
              console.log(`Resolved ${host} to ${resolved.ip}:${resolved.port}`);
              pingResult = await pingPC(resolved.ip, resolved.port, 5000);
            } catch {
              // Fallback to direct ping if DNS resolution fails
              pingResult = await pingPC(host, portNum, 5000);
            }
          } else {
            pingResult = await pingPE(host, portNum, 5000);
          }

          if (!pingResult) {
            console.error(`Server ${host}:${portNum} did not respond to ping`);
            process.exit(1);

          }

          console.log(`✓ Server responded with ${pingResult.playerCount} player(s) online`);
        } catch (err: any) {
          console.error(`Failed to ping server ${host}:${portNum}:`, err && err.message ? err.message : err);
          process.exit(1);
        }
      }

      const id = randomUUIDv7();
      const entry: Record<string, unknown> = { name, id, ip: host, type };
      
      servers.push(entry);
      await fs.writeFile(dataPath, JSON.stringify(servers, null, 2) + "\n", "utf8");

      console.log(`Added server: ${name} (${id})`);
    } catch (err) {
      console.error("Failed to add server:", err);
      process.exit(1);
    }

    process.exit(0);
  });

export default addServerCommand;