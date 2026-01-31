import { open, Reader } from "maxmind";
import type { AsnResponse } from "mmdb-lib";
import type { AsnData } from "../common/types/asn";
import { logger } from "../common/logger";
import { env } from "../common/env";
import { join, dirname } from "path";
import { extract } from "tar-stream";
import { createGunzip } from "zlib";
import fs from "fs/promises";
import { createReadStream, createWriteStream } from "fs";

/**
 * MaxMind service for GeoIP database management and lookups (ASN).
 */
export class MaxMindService {
  /**
   * The directory to store databases.
   */
  private static readonly DATABASES_DIRECTORY = join(
    process.cwd(),
    "data",
    "databases",
  );

  private static readonly MAX_DATABASE_AGE_DAYS = 3;
  private static readonly MAX_DATABASE_AGE_MS =
    MaxMindService.MAX_DATABASE_AGE_DAYS * 24 * 60 * 60 * 1000;
  private static readonly READER_CACHE_MAX = 4096;

  /**
   * The currently loaded databases.
   */
  private static databases: Map<Database, Reader<AsnResponse>> = new Map();

  /**
   * Initializes the MaxMind databases.
   */
  public static async init(): Promise<void> {
    const license = this.getLicenseKey();
    if (license) {
      await this.loadDatabases();
    } else {
      logger.warn(
        "MAXMIND_LICENSE_KEY not set or is CHANGE_ME, GeoIP lookups will be disabled",
      );
    }
  }

  /**
   * Cleanup when the app is destroyed.
   */
  public static cleanup(): void {
    this.databases.clear();
  }

  /**
   * Scheduled task to check and update databases every 3 days.
   * Runs at 2 AM daily to check if databases need updating.
   */
  public static async scheduledUpdate(): Promise<void> {
    const license = this.getLicenseKey();
    if (!license) return;
    try {
      await this.loadDatabases(true);
    } catch (err) {
      logger.warn("Failed to update MaxMind databases", err);
    }
  }

  /**
   * Lookup an ASN by the given address.
   *
   * @param ip the address
   * @returns the ASN response, null if none
   */
  public static lookupAsn(ip: string): AsnResponse | null {
    const database = this.getDatabase(Database.ASN);
    if (!database) return null;
    try {
      return database.get(ip) ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Resolves an IP address to ASN data (backward-compatible wrapper).
   *
   * @param ip the IP address to resolve
   * @returns the ASN data or undefined if not found
   */
  public static resolveAsn(ip: string): AsnData | undefined {
    const response = this.lookupAsn(ip);
    if (!response) return undefined;
    return {
      asn: `AS${response.autonomous_system_number}`,
      asnOrg: response.autonomous_system_organization,
    };
  }

  private static getDatabase(
    database: Database,
  ): Reader<AsnResponse> | undefined {
    return this.databases.get(database);
  }

  /**
   * Load the databases.
   *
   * @param isScheduled whether this is a scheduled update
   */
  private static async loadDatabases(isScheduled = false): Promise<void> {
    const license = this.getLicenseKey();
    if (!license) return;

    if (isScheduled) {
      logger.info("Starting scheduled database check...");
    } else {
      logger.info("Initializing MaxMind databases...");
    }

    await fs.mkdir(this.DATABASES_DIRECTORY, { recursive: true });
    let updatedCount = 0;
    let newCount = 0;

    for (const database of Object.values(Database)) {
      const databaseFile = join(
        this.DATABASES_DIRECTORY,
        `${database.edition}.mmdb`,
      );
      const exists = await this.fileExists(databaseFile);
      const needsUpdate = await this.shouldUpdateDatabase(
        databaseFile,
        database,
        isScheduled,
      );
      if (needsUpdate) {
        if (exists) updatedCount++;
        else {
          newCount++;
          logger.info(
            `Database ${database.edition} not found, downloading for the first time...`,
          );
        }
      }

      await this.ensureDatabaseLoaded(license, database, databaseFile);
    }

    if (isScheduled && updatedCount > 0) {
      logger.info(
        "Scheduled check complete: %d database(s) updated",
        updatedCount,
      );
      return;
    }

    if (!isScheduled) {
      logger.info(
        `Initialization complete: ${this.databases.size} database(s) active (${newCount} new, ${updatedCount} updated)`,
      );
    }
  }

  /**
   * Returns true if the database file is missing or older than MAX_DATABASE_AGE_DAYS.
   * When stale, deletes the file and removes from the in-memory map.
   */
  private static async shouldUpdateDatabase(
    databaseFile: string,
    database: Database,
    isScheduled: boolean,
  ): Promise<boolean> {
    if (!(await this.fileExists(databaseFile))) return true;

    const stats = await fs.stat(databaseFile);
    const ageInMillis = Date.now() - stats.mtimeMs;
    const daysOld = Math.floor(ageInMillis / (24 * 60 * 60 * 1000));

    if (ageInMillis > this.MAX_DATABASE_AGE_MS) {
      logger.info(
        `Database ${database.edition} is ${daysOld} days old (max ${this.MAX_DATABASE_AGE_DAYS} days), updating...`,
      );
      this.databases.delete(database);
      await fs.rm(databaseFile, { force: true });
      return true;
    }

    if (isScheduled) {
      logger.debug(
        "Database %s is %d days old, no update needed",
        database.edition,
        daysOld,
      );
    }
    return false;
  }

  /**
   * Ensures the database file exists (downloads if needed) and is loaded into memory.
   */
  private static async ensureDatabaseLoaded(
    license: string,
    database: Database,
    databaseFile: string,
  ): Promise<void> {
    if (!(await this.fileExists(databaseFile))) {
      await this.downloadDatabase(license, database, databaseFile);
    }

    if (this.databases.has(database)) return;

    const reader = await open<AsnResponse>(databaseFile, {
      cache: { max: this.READER_CACHE_MAX },
    });
    this.databases.set(database, reader);
    logger.info(`Successfully loaded database: ${database.edition}`);
  }

  /**
   * Download the required files for the given database.
   */
  private static async downloadDatabase(
    license: string,
    database: Database,
    databaseFile: string,
  ): Promise<void> {
    const downloadedFile = join(
      this.DATABASES_DIRECTORY,
      `${database.edition}.tar.gz`,
    );

    if (!(await this.fileExists(downloadedFile))) {
      logger.info(`Downloading database ${database.edition}...`);
      const before = Date.now();
      const url = `https://download.maxmind.com/app/geoip_download?edition_id=${encodeURIComponent(database.edition)}&license_key=${encodeURIComponent(license)}&suffix=tar.gz`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(
          `Failed to download database: ${response.status} ${response.statusText}`,
        );
      }
      const arrayBuffer = await response.arrayBuffer();
      await fs.writeFile(downloadedFile, Buffer.from(arrayBuffer));
      logger.info(
        "Downloaded database %s in %dms",
        database.edition,
        Date.now() - before,
      );
    }

    logger.info(`Extracting database ${database.edition}...`);
    await this.extractDatabase(downloadedFile, database.edition, databaseFile);
    logger.info(`Extracted database ${database.edition}`);
  }

  /**
   * Extract tar.gz to DATABASES_DIRECTORY, then move the .mmdb from the edition-named subdirectory to databaseFile and clean up.
   */
  private static async extractDatabase(
    archivePath: string,
    edition: string,
    databaseFile: string,
  ): Promise<void> {
    const databasesDir = this.DATABASES_DIRECTORY;
    const extractStream = extract();
    const gunzip = createGunzip();
    const input = createReadStream(archivePath);

    await new Promise<void>((resolve, reject) => {
      extractStream.on("entry", (header, stream, next) => {
        const destPath = join(databasesDir, header.name);
        const done = (err?: Error) => {
          if (err) reject(err);
          else next();
        };
        if (header.type === "directory") {
          fs.mkdir(destPath, { recursive: true })
            .then(() => {
              stream.resume();
              stream.on("end", () => done());
            })
            .catch(done);
          return;
        }
        if (header.type === "file") {
          fs.mkdir(dirname(destPath), { recursive: true })
            .then(() => {
              const writeStream = createWriteStream(destPath);
              stream.pipe(writeStream);
              writeStream.on("finish", () => done());
              writeStream.on("error", done);
              stream.on("error", done);
            })
            .catch(done);
          return;
        }
        stream.resume();
        stream.on("end", () => done());
      });
      extractStream.on("finish", resolve);
      extractStream.on("error", reject);
      input.pipe(gunzip).pipe(extractStream);
    });

    const entries = await fs.readdir(this.DATABASES_DIRECTORY, {
      withFileTypes: true,
    });
    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.startsWith(edition)) continue;
      const dirPath = join(this.DATABASES_DIRECTORY, entry.name);
      const files = await fs.readdir(dirPath, { withFileTypes: true });
      for (const file of files) {
        if (file.isFile() && file.name === `${edition}.mmdb`) {
          const srcPath = join(dirPath, file.name);
          await fs.copyFile(srcPath, databaseFile);
          await fs.rm(dirPath, { recursive: true, force: true });
          await fs.rm(archivePath, { force: true });
          return;
        }
      }
    }

    await fs.rm(archivePath, { force: true });
    throw new Error(
      `Extracted archive for ${edition} but could not find ${edition}.mmdb in expected layout`,
    );
  }

  private static getLicenseKey(): string | undefined {
    const license = env.MAXMIND_LICENSE_KEY;
    if (!license || license === "CHANGE_ME") return undefined;
    return license;
  }

  private static async fileExists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * A database for MaxMind.
 */
export const Database = {
  ASN: { edition: "GeoLite2-ASN" },
} as const;

export type Database = (typeof Database)[keyof typeof Database];
