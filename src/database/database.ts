import SQLiteDatabase from "better-sqlite3";
import cron from "node-cron";
import Server, { PingResponse } from "../server/server";
import { logger } from "../utils/logger";
import { getFormattedDate } from "../utils/timeUtils";

import Config from "../../data/config.json";
import { Ping } from "../types/ping";
import { createDirectory } from "../utils/fsUtils";

const DATA_DIR = "data";
const BACKUP_DIR = `${DATA_DIR}/database-backups`;

const PINGS_TABLE = "pings";
const RECORD_TABLE = "record";

/**
 * SQL Queries
 */
const CREATE_PINGS_TABLE = `
  CREATE TABLE IF NOT EXISTS pings (
    id INTEGER NOT NULL,
    timestamp BIGINT NOT NULL,
    ip TINYTEXT NOT NULL,
    playerCount MEDIUMINT NOT NULL
  );
`;
const CREATE_RECORD_TABLE = `
  CREATE TABLE IF NOT EXISTS record (
    id INTEGER PRIMARY KEY,
    timestamp BIGINT NOT NULL,
    ip TINYTEXT NOT NULL,
    playerCount MEDIUMINT NOT NULL
  );
`;

const CREATE_PINGS_INDEX = `CREATE INDEX IF NOT EXISTS ip_index ON pings (id, ip, playerCount)`;
const CREATE_TIMESTAMP_INDEX = `CREATE INDEX IF NOT EXISTS timestamp_index on PINGS (id, timestamp)`;

const INSERT_PING = `
  INSERT INTO ${PINGS_TABLE} (id, timestamp, ip, playerCount)
  VALUES (?, ?, ?, ?)
`;
const INSERT_RECORD = `
  INSERT INTO ${RECORD_TABLE} (id, timestamp, ip, playerCount)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    timestamp = excluded.timestamp,
    playerCount = excluded.playerCount,
    ip = excluded.ip
`;

const SELECT_PINGS = `
  SELECT * FROM ${PINGS_TABLE} WHERE id = ? AND timestamp >= ? AND timestamp <= ?
`;
const SELECT_RECORD = `
  SELECT playerCount, timestamp FROM ${RECORD_TABLE} WHERE {} = ?
`;
const SELECT_RECORD_BY_ID = SELECT_RECORD.replace("{}", "id");
const SELECT_RECORD_BY_IP = SELECT_RECORD.replace("{}", "ip");

export default class Database {
  private db: SQLiteDatabase.Database;

  constructor() {
    this.db = new SQLiteDatabase(`${DATA_DIR}/db.sqlite`);
    this.db.pragma("journal_mode = WAL");

    logger.info("Ensuring tables exist");
    this.db.exec(CREATE_PINGS_TABLE); // Ensure the pings table exists
    this.db.exec(CREATE_RECORD_TABLE); // Ensure the record table exists

    logger.info("Ensuring indexes exist");
    this.db.exec(CREATE_PINGS_INDEX); // Ensure the pings index exists
    this.db.exec(CREATE_TIMESTAMP_INDEX); // Ensure the timestamp index exists

    cron.schedule(Config.backup.cron, () => {
      this.createBackup();
    });
  }

  /**
   * Gets the pings for a server.
   *
   * @param id the server ID
   * @param startTime the start time
   * @param endTime the end time
   * @returns the pings for the server
   */
  public getPings(id: number, startTime: number, endTime: number): Ping[] | [] {
    return this.db.prepare(SELECT_PINGS).all(id, startTime, endTime) as
      | Ping[]
      | [];
  }

  /**
   * Gets the record player count for a server.
   *
   * @param value the server ID or IP
   * @returns the record for the server
   */
  public getRecord(value: any): Ping | undefined {
    if (typeof value === "number") {
      return this.db.prepare(SELECT_RECORD_BY_ID).get(value) as
        | Ping
        | undefined;
    }
    return this.db.prepare(SELECT_RECORD_BY_IP).get(value) as Ping | undefined;
  }

  /**
   * Creates a full backup of the database.
   */
  public async createBackup() {
    logger.info("Creating database backup");
    createDirectory(BACKUP_DIR);
    await this.db.backup(`${BACKUP_DIR}/${getFormattedDate()}.sqlite`);
    logger.info("Finished creating database backup");
  }

  /**
   * Inserts a ping into the database.
   *
   * @param timestamp the timestamp of the ping
   * @param ip the IP address of the server
   * @param playerCount the number of players online
   */
  public insertPing(server: Server, response: PingResponse) {
    const { timestamp, players } = response;
    const id = server.getID();
    const ip = server.getIP();
    const onlineCount = players.online;

    const statement = this.db.prepare(INSERT_PING);
    statement.run(id, timestamp, ip, onlineCount); // Insert the ping into the database
  }

  /**
   * Inserts a record into the database.
   *
   * @param server the server to insert
   * @param response the response to insert
   */
  public insertRecord(server: Server, response: PingResponse) {
    const { timestamp, players } = response;
    const id = server.getID();
    const ip = server.getIP();
    const onlineCount = players.online;

    const statement = this.db.prepare(INSERT_RECORD);
    statement.run(id, timestamp, ip, onlineCount); // Insert the record into the database
  }
}
