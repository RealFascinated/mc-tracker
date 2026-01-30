import * as net from "net";

/**
 * Checks if a string is an IP address.
 *
 * @param str the string to check
 * @returns true if it's an IP address
 */
export function isIpAddress(str: string): boolean {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){7}[0-9a-fA-F]{0,4}$/;
  return ipv4Regex.test(str) || ipv6Regex.test(str);
}

/**
 * TCP-pings a host:port. Resolves on connect, rejects on error/timeout.
 */
export function tcpPing(
  host: string,
  port: number,
  timeout = 3000,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const socket = net.createConnection(port, host);
    let settled = false;
    const clean = () => {
      socket.removeAllListeners();
      try {
        socket.destroy();
      } catch {}
    };

    socket.once("connect", () => {
      if (settled) return;
      settled = true;
      clean();
      resolve();
    });

    socket.once("error", (err) => {
      if (settled) return;
      settled = true;
      clean();
      reject(err);
    });

    socket.setTimeout(timeout, () => {
      if (settled) return;
      settled = true;
      clean();
      reject(new Error("timeout"));
    });
  });
}
