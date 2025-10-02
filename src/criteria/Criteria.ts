import { Filters } from "./Filters"
import { Order } from "./Order"

export class Criteria {
  readonly filters: Filters
  readonly order: Order
  readonly limit?: number
  readonly offset?: number
  readonly currentPage?: number

  constructor(filters: Filters, order: Order, limit?: number, offset?: number) {
    this.filters = filters
    this.order = order
    this.limit = limit
    this.currentPage = offset
    this.offset =
      offset !== undefined && limit !== undefined
        ? (offset - 1) * limit
        : undefined
  }

  public hasFilters(): boolean {
    return this.filters.filters.length > 0
  }
}
