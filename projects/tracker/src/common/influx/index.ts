import { influx } from "../../influx/influx";

/**
 * The result of a query to Influx.
 */
export type InfluxQueryResult<T> = {
  /**
   * The query that was executed.
   */
  query: string;

  /**
   * The data of the result.
   */
  data: InfluxQueryResultRow[];

  /**
   * The raw result of the query.
   */
  raw: T[];
};

/**
 * A row of the result of a query to Influx.
 */
export type InfluxQueryResultRow = {
  /**
   * The tags of the row.
   */
  tags: Record<string, string>;

  /**
   * The fields of the row.
   */
  fields: Record<string, unknown>;

  /**
   * The field of the row.
   */
  field: string;

  /**
   * The value of the group by of the row.
   */
  groupBy: string | undefined;

  /**
   * The value of the row.
   */
  value: unknown;

  /**
   * The raw value of the row.
   */
  raw: unknown;

  /**
   * The timestamp of the row.
   */
  timestamp: string;
};

/**
 * Execute a read query.
 *
 * @param query the query to execute
 * @param groupBy the column to group by - used internally
 * @returns the result of the query
 */
export const executeQuery = async <T>(
  query: string,
  groupBy?: string
): Promise<InfluxQueryResult<T>> => {
  // Execute the query and collect the results
  const result: Array<T> = await influx.query<T>(query);

  // Map the results to the appropriate format
  const rows: InfluxQueryResultRow[] = result.map((row: any) => {
    const tags: Record<string, string> = {};
    const fields: Record<string, unknown> = {};

    // Get the tags and fields from the row
    Object.keys(row).forEach((key: string) => {
      if (!key.startsWith("_")) {
        tags[key] = row[key] as string;
      } else {
        fields[key] = row[key];
      }
    });

    return {
      tags,
      fields,
      field: fields["_field"] as string,
      groupBy: groupBy ? (row[groupBy] as string) : undefined,
      value: fields["_value"],
      raw: row,
      timestamp: fields["_time"] as string,
    };
  });

  // Return the result
  return {
    query,
    data: rows,
    raw: result,
  };
};
