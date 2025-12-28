import { open, Reader } from "maxmind";
import type { AsnResponse } from "mmdb-lib";
import { logger } from "./logger";
import { env } from "@mc-tracker/common/env";
import { join } from "path";
import { extract } from "tar-stream";
import { createGunzip } from "zlib";
import fs from "fs/promises";

export type AsnData = {
  asn: string;
  asnOrg: string;
};

/**
 * MaxMind service for ASN database management and lookups.
 */
export class MaxMindService {
  private static readonly DATABASES_DIRECTORY = join(process.cwd(), "databases");
  private static readonly DATABASE_DOWNLOAD_ENDPOINT =
    "https://download.maxmind.com/app/geoip_download?edition_id={edition}&license_key={license}&suffix=tar.gz";
  private static readonly MAX_DATABASE_AGE_MS = 3 * 24 * 60 * 60 * 1000;
  private static readonly EDITION = "GeoLite2-ASN";

  private static asnReader: Reader<AsnResponse> | null = null;

  /**
   * Initializes the MaxMind ASN database.
   */
  public static async init(): Promise<void> {
    const license = this.getLicenseKey();
    if (!license) {
      logger.warn("MAXMIND_LICENSE_KEY not set or is CHANGE_ME, ASN tracking will be disabled");
      return;
    }

    try {
      await this.loadDatabase(license);
    } catch (err) {
      logger.warn("Failed to initialize MaxMind ASN database", err);
    }
  }

  /**
   * Scheduled task to check and update databases.
   * Should be called periodically (e.g., daily at 2 AM).
   */
  public static async scheduledUpdate(): Promise<void> {
    const license = this.getLicenseKey();
    if (!license) {
      return;
    }

    try {
      logger.info("Starting scheduled database check...");
      await this.loadDatabase(license, false);
      logger.info("Scheduled check complete");
    } catch (err) {
      logger.warn("Failed to update MaxMind database", err);
    }
  }

  /**
   * Resolves an IP address to ASN data using MaxMind.
   *
   * @param ip the IP address to resolve
   * @returns the ASN data or undefined if not found
   */
  public static resolveAsn(ip: string): AsnData | undefined {
    if (!this.asnReader) {
      return undefined;
    }

    try {
      const result = this.asnReader.get(ip);
      if (!result) {
        return undefined;
      }

      const asn = result.autonomous_system_number?.toString() ?? "";
      const asnOrg = result.autonomous_system_organization ?? "";

      if (!asn || !asnOrg) {
        return undefined;
      }

      return {
        asn,
        asnOrg,
      };
    } catch (err) {
      logger.warn(`Failed to resolve ASN for IP ${ip}`, err);
      return undefined;
    }
  }

  /**
   * Cleanup when the app is destroyed.
   */
  public static cleanup(): void {
    this.asnReader = null;
  }

  /**
   * Gets the license key from environment variables.
   */
  private static getLicenseKey(): string | undefined {
    const license = env.MAXMIND_LICENSE_KEY;
    if (!license || license === "CHANGE_ME") {
      return undefined;
    }
    return license;
  }

  /**
   * Loads the ASN database, downloading if necessary.
   *
   * @param license the MaxMind license key
   * @param forceUpdate whether to force an update
   */
  private static async loadDatabase(license: string, forceUpdate: boolean = false): Promise<void> {
    // Ensure directory exists
    await fs.mkdir(this.DATABASES_DIRECTORY, { recursive: true });

    const databaseFile = join(this.DATABASES_DIRECTORY, `${this.EDITION}.mmdb`);
    const dbFile = Bun.file(databaseFile);

    // Check if database exists and needs update
    if (await dbFile.exists()) {
      const stats = await dbFile.stat();
      if (!stats) {
        throw new Error("Failed to get database file stats");
      }

      const ageInMillis = Date.now() - stats.mtimeMs;
      const daysOld = Math.floor(ageInMillis / (24 * 60 * 60 * 1000));

      if (ageInMillis > this.MAX_DATABASE_AGE_MS || forceUpdate) {
        logger.info(
          `Database ${this.EDITION} is ${daysOld} days old (max 3 days), updating...`
        );

        this.asnReader = null;
        await Bun.$`rm -f ${databaseFile}`.quiet();
      } else {
        logger.debug(`Database ${this.EDITION} is ${daysOld} days old, no update needed`);
      }
    }

    // Download if needed
    if (!(await dbFile.exists())) {
      logger.info(`Database ${this.EDITION} not found, downloading...`);
      await this.downloadDatabase(license, databaseFile);
    }

    // Load the database if not already loaded
    if (!this.asnReader) {
      this.asnReader = await open<AsnResponse>(databaseFile);
      logger.info(`Successfully loaded database: ${this.EDITION}`);
    }
  }

  /**
   * Downloads the ASN database from MaxMind.
   *
   * @param license the MaxMind license key
   * @param databaseFile the file path to save the database to
   */
  private static async downloadDatabase(license: string, databaseFile: string): Promise<void> {
    const downloadedFile = join(this.DATABASES_DIRECTORY, `${this.EDITION}.tar.gz`);

    // Download the database if required
    if (!(await Bun.file(downloadedFile).exists())) {
      logger.info(`Downloading database ${this.EDITION}...`);
      const before = Date.now();

      const url = this.DATABASE_DOWNLOAD_ENDPOINT
        .replace("{edition}", this.EDITION)
        .replace("{license}", license);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(
          `Failed to download database: ${response.status} ${response.statusText}`
        );
      }

      if (!response.body) {
        throw new Error("Response body is null");
      }

      // Use Bun to write the file directly
      const arrayBuffer = await response.arrayBuffer();
      await Bun.write(downloadedFile, arrayBuffer);

      logger.info(`Downloaded database ${this.EDITION} in ${Date.now() - before}ms`);
    }

    // Extract the database
    logger.info(`Extracting database ${this.EDITION}...`);
    await this.extractDatabase(downloadedFile, databaseFile);

    // Clean up the downloaded archive
    await Bun.$`rm -f ${downloadedFile}`.quiet();
    logger.info(`Extracted database ${this.EDITION}`);
  }

  /**
   * Extracts the database file from the tar.gz archive.
   *
   * @param archivePath the path to the tar.gz file
   * @param outputPath the path to extract the .mmdb file to
   */
  private static async extractDatabase(
    archivePath: string,
    outputPath: string
  ): Promise<void> {
    const extractStream = extract();
    const gunzip = createGunzip();
    
    // Use Bun's file reading
    const archiveFile = Bun.file(archivePath);
    const buffer = await archiveFile.arrayBuffer();
    const { Readable } = await import("stream");
    const nodeStream = Readable.from(Buffer.from(buffer));
    
    return new Promise((resolve, reject) => {
      extractStream.on("entry", (header, stream, next) => {
        if (header.name.endsWith(".mmdb")) {
          const chunks: Buffer[] = [];
          
          stream.on("data", (chunk: Buffer) => {
            chunks.push(chunk);
          });
          
          stream.on("end", async () => {
            try {
              const data = Buffer.concat(chunks);
              await Bun.write(outputPath, data);
              next();
              resolve();
            } catch (err) {
              reject(err);
            }
          });
          
          stream.on("error", (err: Error) => {
            reject(err);
          });
        } else {
          stream.resume();
          stream.on("end", next);
        }
      });

      extractStream.on("error", reject);
      gunzip.on("error", reject);

      nodeStream.pipe(gunzip).pipe(extractStream);
    });
  }
}