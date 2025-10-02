import { Criteria, Filters, Order, Operator } from "../src/criteria"
import { OrderTypes } from "../src/criteria/OrderType"

describe("Criteria", () => {
  describe("constructor", () => {
    it("should create criteria with all parameters", () => {
      const filters = [
        new Map([
          ["field", "status"],
          ["operator", Operator.EQUAL],
          ["value", "active"],
        ]),
      ]

      const criteria = new Criteria(
        Filters.fromValues(filters),
        Order.fromValues("createdAt", OrderTypes.DESC),
        20,
        1
      )

      expect(criteria.filters).toBeDefined()
      expect(criteria.order).toBeDefined()
      expect(criteria.limit).toBe(20)
      expect(criteria.currentPage).toBe(1)
      expect(criteria.offset).toBe(0) // (1-1) * 20 = 0
    })

    it("should create criteria without pagination", () => {
      const criteria = new Criteria(Filters.fromValues([]), Order.none())

      expect(criteria.limit).toBeUndefined()
      expect(criteria.currentPage).toBeUndefined()
      expect(criteria.offset).toBeUndefined()
    })

    it("should calculate offset correctly for page 2", () => {
      const criteria = new Criteria(Filters.fromValues([]), Order.none(), 10, 2)

      expect(criteria.offset).toBe(10) // (2-1) * 10 = 10
    })
  })

  describe("hasFilters", () => {
    it("should return true when filters exist", () => {
      const filters = [
        new Map([
          ["field", "status"],
          ["operator", Operator.EQUAL],
          ["value", "active"],
        ]),
      ]

      const criteria = new Criteria(Filters.fromValues(filters), Order.none())

      expect(criteria.hasFilters()).toBe(true)
    })

    it("should return false when no filters exist", () => {
      const criteria = new Criteria(Filters.fromValues([]), Order.none())

      expect(criteria.hasFilters()).toBe(false)
    })
  })
})
