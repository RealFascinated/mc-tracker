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
