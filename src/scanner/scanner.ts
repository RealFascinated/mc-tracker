import Database from "better-sqlite3";
import cron from "node-cron";
import { serverManager } from "..";

import Config from "../../data/config.json";
import Server, { PingResponse } from "../server/server";

const DATA_DIR = "data";

const PINGS_TABLE = "pings";
const RECORD_TABLE = "record";

/**
 * SQL Queries
 */
const CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS {} (
    timestamp BIGINT NOT NULL,
    ip TINYTEXT NOT NULL,
    player_count MEDIUMINT NOT NULL
  );
`;
const CREATE_PINGS_TABLE = CREATE_TABLE.replace("{}", PINGS_TABLE);
const CREATE_RECORD_TABLE = CREATE_TABLE.replace("{}", RECORD_TABLE);

const CREATE_PINGS_INDEX = `CREATE INDEX IF NOT EXISTS ip_index ON pings (ip, player_count)`;
const CREATE_TIMESTAMP_INDEX = `CREATE INDEX IF NOT EXISTS timestamp_index on PINGS (timestamp)`;

const INSERT_PING = `
  INSERT INTO ${PINGS_TABLE} (timestamp, ip, player_count)
  VALUES (?, ?, ?)
`;
const INSERT_RECORD = `
  INSERT INTO ${RECORD_TABLE} (timestamp, ip, player_count)
  VALUES (?, ?, ?)
`;
const DELETE_OLD_RECORD = `
  DELETE FROM ${RECORD_TABLE}
  WHERE ip = ?
`;

export default class Scanner {
  private db: Database.Database;

  constructor() {
    console.log("Loading scanner database");
    this.db = new Database(`${DATA_DIR}/db.sqlite`);

    console.log("Ensuring tables exist");
    this.db.exec(CREATE_PINGS_TABLE); // Ensure the pings table exists
    this.db.exec(CREATE_RECORD_TABLE); // Ensure the record table exists

    console.log("Ensuring indexes exist");
    this.db.exec(CREATE_PINGS_INDEX); // Ensure the pings index exists
    this.db.exec(CREATE_TIMESTAMP_INDEX); // Ensure the timestamp index exists

    console.log("Starting server scan");
    cron.schedule(Config.scanner.updateCron, () => {
      this.scanServers();
    });
  }

  /**
   * Start a server scan to ping all servers.
   */
  private async scanServers(): Promise<void> {
    console.log(`Scanning servers ${serverManager.getServers().length}`);

    // ping all servers in parallel
    await Promise.all(
      serverManager.getServers().map((server) => this.scanServer(server))
    );

    console.log("Finished scanning servers");
  }

  /**
   * Scans a server and inserts the ping into the database.
   *
   * @param server the server to scan
   * @returns a promise that resolves when the server has been scanned
   */
  async scanServer(server: Server): Promise<void> {
    //console.log(`Scanning server ${server.getIP()} - ${server.getType()}`);
    let response;
    let online = false;

    try {
      response = await server.pingServer(server);
      if (response == undefined) {
        return; // Server is offline
      }
      online = true;
    } catch (err) {
      console.log(`Failed to ping ${server.getIP()}`, err);
      return;
    }

    if (!online || !response) {
      return; // Server is offline
    }

    const { timestamp, players } = response;

    this.insertPing(timestamp, server.getIP(), players.online);
    this.updateRecord(server, response);
  }

  /**
   * Updates the record for a server.
   *
   * @param server the server to update
   * @param response the response to update with
   */
  private updateRecord(server: Server, response: PingResponse): void {
    const ip = server.getIP();

    // select record from database for this server
    const statement = this.db.prepare(
      `SELECT * FROM ${RECORD_TABLE} WHERE ip = ?`
    );
    const record = statement.get(ip);

    // delete old record
    if (record) {
      this.db.prepare(DELETE_OLD_RECORD).run(ip);
    }

    this.insertRecord(server, response);
  }

  /**
   * Inserts a ping into the database.
   *
   * @param timestamp the timestamp of the ping
   * @param ip the IP address of the server
   * @param playerCount the number of players online
   */
  private insertPing(timestamp: number, ip: string, playerCount: number): void {
    const statement = this.db.prepare(INSERT_PING);
    statement.run(timestamp, ip, playerCount); // Insert the ping into the database
  }

  /**
   * Inserts a record into the database.
   *
   * @param server the server to insert
   * @param response the response to insert
   */
  private insertRecord(server: Server, response: PingResponse): void {
    const { timestamp, players } = response;
    const ip = server.getIP();
    const onlineCount = players.online;

    const statement = this.db.prepare(INSERT_RECORD);
    statement.run(timestamp, ip, onlineCount); // Insert the record into the database
  }
}
