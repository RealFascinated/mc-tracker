import { Controller, Get } from "elysia-decorators";
import ServerManager from "../server/server-manager";
import { t } from "elysia";

@Controller("/servers")
export default class ServerController {
  @Get("/", {
    config: {},
    tags: ["Server"],
    detail: {
      description: "Fetch all servers",
    },
  })
  public async getServers() {
    return {
      servers: ServerManager.SERVERS.map((server) => ({
        id: server.id,
        name: server.getName(),
        type: server.getType(),
      })),
    };
  }

  @Get("/pings/:id", {
    config: {},
    tags: ["Server"],
    detail: {
      description: "Fetch a server's latest pings",
    },
    params: t.Object({
      id: t.String(),
    }),
  })
  public async getServerPings({ params: { id } }: { params: { id: string } }) {
    const server = ServerManager.getServerById(id);
    if (!server) {
      return {
        error: "Server not found",
      };
    }

    return {
      pings: await server.getPings(),
    };
  }
}
