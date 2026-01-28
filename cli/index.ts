import { Command } from "commander";
import addServerCommand from "./commands/add-server";

const program = new Command();

program
  .name("mc-tracker")
  .description("Mc Tracker CLI tool")
  .version("1.0.0")
  .addCommand(addServerCommand);

program.parse();
