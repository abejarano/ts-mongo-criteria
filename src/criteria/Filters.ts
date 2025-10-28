import { Filter } from "./Filter"
import { FilterInputValue } from "./FilterValue"

export class Filters {
  readonly filters: Filter[]

  constructor(filters: Filter[]) {
    this.filters = filters
  }

  static fromValues(filters: Array<Map<string, FilterInputValue>>): Filters {
    return new Filters(filters.map((values) => Filter.fromValues(values)))
  }

  static none(): Filters {
    return new Filters([])
  }
}
