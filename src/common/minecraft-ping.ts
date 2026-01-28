import javaPing from "mcping-js";
import { Ping } from "./types/ping";
const bedrockPing = require("mcpe-ping-fixed"); // Doesn't have typescript definitions

/**
 * Pings a Java Edition (PC) Minecraft server.
 *
 * @param ip the IP address to ping
 * @param port the port to ping
 * @param timeout the timeout in milliseconds
 * @param protocolVersion the Minecraft protocol version (defaults to 765)
 * @returns the ping response or undefined if the server is offline
 */
export async function pingPC(
  ip: string,
  port: number,
  timeout: number,
  protocolVersion: number = 765,
): Promise<Ping | undefined> {
  const serverPing = new javaPing.MinecraftServer(ip, port);

  return new Promise((resolve) => {
    serverPing.ping(timeout, protocolVersion, (err, res) => {
      if (err || res == undefined) {
        return resolve(undefined);
      }

      resolve({
        timestamp: Date.now(),
        ip: ip,
        playerCount: Number(res.players.online),
      });
    });
  });
}

/**
 * Pings a Bedrock Edition (PE) Minecraft server.
 *
 * @param ip the IP address to ping
 * @param port the port to ping
 * @param timeout the timeout in milliseconds
 * @returns the ping response or undefined if the server is offline
 */
export async function pingPE(
  ip: string,
  port: number,
  timeout: number,
): Promise<Ping | undefined> {
  const timeoutPromise = new Promise<undefined>((resolve) => {
    setTimeout(() => resolve(undefined), timeout);
  });

  const pingPromise = new Promise<Ping | undefined>((resolve) => {
    bedrockPing(ip, port, (err: any, res: any) => {
      if (err || res == undefined) {
        return resolve(undefined);
      }

      resolve({
        timestamp: Date.now(),
        ip: ip,
        playerCount: Number(res.currentPlayers),
      });
    });
  });

  return Promise.race([pingPromise, timeoutPromise]);
}
