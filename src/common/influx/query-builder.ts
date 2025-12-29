import { env } from "../env";

export type FunctionTypes = "mean" | "min" | "max" | "sum" | "count" | "last";

export class QueryBuilder {
  /**
   * The query to build.
   */
  private query: string = "";

  /**
   * The group by clause of the query.
   */
  public queryGroupBy: string | undefined = undefined;

  constructor(query?: string) {
    this.query = query?.trim() || `from(bucket: "${env.INFLUX_BUCKET}")\n`;
  }

  /**
   * Add a range to the query.
   *
   * @param range the range to add
   * @returns the builder
   */
  public range(range: string) {
    return this.operation(`range(start: ${range})`);
  }

  /**
   * Add a range to the query with a minimum and maximum time.
   *
   * @param timeRangeMin the minimum time range to add
   * @param timeRangeMax the maximum time range to add
   * @returns the builder
   */
  public rangeWithMinMax(timeRangeMin: string, timeRangeMax: string) {
    return this.operation(
      `range(start: ${timeRangeMin}, stop: ${timeRangeMax})`,
    );
  }

  /**
   * Filter by a tag.
   *
   * @param tag the tag to filter by
   * @param value the value to filter by
   * @returns the builder
   */
  public filterByTag(tag: string, value: string) {
    return this.operation(`filter(fn: (r) => r["${tag}"] == "${value}")`);
  }

  /**
   * Filter by a field.
   *
   * @param field the field to filter by
   * @param value the value to filter by
   * @returns the builder
   */
  public filterByField(field: string, value: string) {
    return this.operation(`filter(fn: (r) => r["_${field}"] == "${value}")`);
  }

  /**
   * Add a filter to the query.
   *
   * @param filter the filter to add
   * @returns the builder
   */
  public filter(filter: string) {
    return this.operation(`filter(fn: (r) => ${filter})`);
  }

  /**
   * Group by a column.
   *
   * @param column the column to group by
   * @returns the builder
   */
  public groupByField(column: string) {
    return this.groupBy(`_${column}`);
  }

  /**
   * Group by a column.
   *
   * @param column the column to group by
   * @returns the builder
   */
  public groupBy(column: string) {
    this.queryGroupBy = column;
    return this.operation(`group(columns: ["${column}"])`);
  }

  /**
   * Calculate the difference between
   * the current and previous value.
   *
   * @returns the builder
   */
  public difference() {
    return this.operation(`difference(columns: ["_value"])`);
  }

  /**
   * Yield the query.
   *
   * @param name the name of the yield
   * @returns the builder
   */
  public yield(name: string) {
    return this.operation(`yield(name: "${name}")`);
  }

  /**
   * Aggregate the query by a window.
   *
   * @param window the window to aggregate by
   * @param fn the function to aggregate by
   * @param createEmpty whether to create empty values
   * @returns the builder
   */
  public aggregateWindow(
    window: string,
    fn: FunctionTypes = "mean",
    createEmpty: boolean = false,
  ) {
    return this.operation(
      `aggregateWindow(every: ${window}, fn: ${fn}, createEmpty: ${createEmpty})`,
    );
  }

  /**
   * Add an operation to the query.
   *
   * @param operation the operation to add
   * @returns the builder
   */
  public operation(operation: string) {
    this.query += `  |> ${operation}\n`;
    return this;
  }

  /**
   * Build the query.
   *
   * @returns the query
   */
  public build(): string {
    return this.query.trim();
  }
}
