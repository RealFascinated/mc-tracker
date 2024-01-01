import fs from "fs";

/**
 * Creates a directory at the given path.
 *
 * @param path the path to the file
 * @param recursive whether to create the directory tree if it doesn't exist (defaults to true)
 * @returns a promise that resolves when the file is created
 */
export async function createDirectory(
  path: string,
  recursive?: boolean
): Promise<void> {
  if (recursive == undefined) {
    recursive = true; // Set to true by default
  }

  return new Promise((resolve, reject) => {
    fs.mkdir(path, { recursive: recursive }, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Checks if a file exists at the given path.
 *
 * @param path the path to the file
 * @returns a promise that returns true if the file exists, false otherwise
 */
export async function exists(path: string): Promise<boolean> {
  return new Promise((resolve) => {
    fs.exists(path, (exists) => {
      resolve(exists);
    });
  });
}
