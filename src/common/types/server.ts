/**
 * The type of server.
 * PC: Java Edition - PE: Bedrock Edition
 */
export type ServerType = "PC" | "PE";

export type ServerConfig = {
  name: string;
  id: string;
  ip: string;
  type: ServerType;
};

export type ServerOptions = {
  id: string;
  name: string;
  ip: string;
  port?: number;
  type: ServerType;
};
