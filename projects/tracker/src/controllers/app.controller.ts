import { Controller, Get } from "elysia-decorators";

@Controller()
export default class AppController {
  @Get("/", {
    config: {},
    tags: ["App"],
    detail: {
      description: "Fetch basic application info",
    },
  })
  public async index() {
    return {
      app: "tracker",
    };
  }
}