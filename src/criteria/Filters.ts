import { Filter } from "./Filter";
import { OrCondition } from "./FilterValue";

export class Filters {
  readonly filters: Filter[];

  constructor(filters: Filter[]) {
    this.filters = filters;
  }

  static fromValues(
    filters: Array<Map<string, string | string[] | OrCondition[]>>,
  ): Filters {
    return new Filters(filters.map((values) => Filter.fromValues(values)));
  }

  static none(): Filters {
    return new Filters([]);
  }
}
