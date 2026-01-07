import { describe, expect, it } from "bun:test"
import { Criteria, Filters, Order } from "../../src"

describe("bun smoke", () => {
  it("builds a basic Criteria instance", () => {
    const criteria = new Criteria(Filters.none(), Order.none(), 10, 1)

    expect(criteria).toBeDefined()
  })
})
