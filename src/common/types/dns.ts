export type ResolvedServer = {
  ip: string;
  port: number;
};

export type DnsInfo = {
  hasResolved: boolean;
  resolvedServer?: ResolvedServer;
};
