import dns from "dns";
import type { ResolvedServer } from "./types/dns";

/**
 * Resolves a minecraft server domain to an
 * IP address and port using the SRV record.
 *
 * @param domain the domain to resolve
 * @returns the resolved minecraft server
 */
export async function resolveDns(domain: string): Promise<ResolvedServer> {
  return new Promise((resolve, reject) => {
    try {
      dns.resolveSrv(`_minecraft._tcp.${domain}`, (err, records) => {
        if (err) {
          reject(err);
        } else {
          const record = records[0];
          if (record == undefined) {
            return reject(undefined);
          }
          resolve({
            ip: record.name,
            port: record.port,
          });
        }
      });
    } catch (err) {
      reject(undefined);
    }
  });
}
