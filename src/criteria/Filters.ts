import { Filter } from "./Filter";

export class Filters {
  readonly filters: Filter[];

  constructor(filters: Filter[]) {
    this.filters = filters;
  }

  static fromValues(filters: Array<Map<string, string | string[]>>): Filters {
    return new Filters(
      filters.map((values) => Filter.fromValues(values as Map<string, string>)),
    );
  }

  static none(): Filters {
    return new Filters([]);
  }
}
