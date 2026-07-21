import { Filters } from "./Filters"
import { Order } from "./Order"

export class Criteria {
  readonly filters: Filters
  readonly order: Order
  readonly limit: number
  readonly offset: number
  readonly currentPage: number

  constructor(
    filters: Filters,
    order: Order,
    limit: number = 10,
    currentPage: number = 1
  ) {
    if (!Number.isInteger(limit) || limit <= 0) {
      throw new Error("CRITERIA_LIMIT_MUST_BE_A_POSITIVE_INTEGER")
    }

    if (!Number.isInteger(currentPage) || currentPage <= 0) {
      throw new Error("CRITERIA_PAGE_MUST_BE_A_POSITIVE_INTEGER")
    }

    this.filters = filters
    this.order = order
    this.limit = limit
    this.currentPage = currentPage
    this.offset = (currentPage - 1) * limit
  }

  public hasFilters(): boolean {
    return this.filters.filters.length > 0
  }
}
