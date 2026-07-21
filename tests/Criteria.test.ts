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
      expect(criteria.offset).toBe(0)
    })

    it("should apply defaults when no pagination arguments are given", () => {
      const criteria = new Criteria(Filters.fromValues([]), Order.none())

      expect(criteria.limit).toBe(10)
      expect(criteria.currentPage).toBe(1)
      expect(criteria.offset).toBe(0)
    })

    it("should apply default page when only limit is given", () => {
      const criteria = new Criteria(Filters.fromValues([]), Order.none(), 20)

      expect(criteria.limit).toBe(20)
      expect(criteria.currentPage).toBe(1)
      expect(criteria.offset).toBe(0)
    })

    it("should calculate offset correctly for page 2", () => {
      const criteria = new Criteria(Filters.fromValues([]), Order.none(), 10, 2)

      expect(criteria.offset).toBe(10)
    })

    it("should calculate offset for page 3 with limit 20", () => {
      const criteria = new Criteria(Filters.fromValues([]), Order.none(), 20, 3)

      expect(criteria.offset).toBe(40)
    })

    it("should reject limit equal to 0", () => {
      expect(
        () => new Criteria(Filters.fromValues([]), Order.none(), 0, 1)
      ).toThrow("CRITERIA_LIMIT_MUST_BE_A_POSITIVE_INTEGER")
    })

    it("should reject negative limit", () => {
      expect(
        () => new Criteria(Filters.fromValues([]), Order.none(), -1, 1)
      ).toThrow("CRITERIA_LIMIT_MUST_BE_A_POSITIVE_INTEGER")
    })

    it("should reject page equal to 0", () => {
      expect(
        () => new Criteria(Filters.fromValues([]), Order.none(), 10, 0)
      ).toThrow("CRITERIA_PAGE_MUST_BE_A_POSITIVE_INTEGER")
    })

    it("should reject negative page", () => {
      expect(
        () => new Criteria(Filters.fromValues([]), Order.none(), 10, -1)
      ).toThrow("CRITERIA_PAGE_MUST_BE_A_POSITIVE_INTEGER")
    })

    it("should reject non-integer limit", () => {
      expect(
        () => new Criteria(Filters.fromValues([]), Order.none(), 1.5, 1)
      ).toThrow("CRITERIA_LIMIT_MUST_BE_A_POSITIVE_INTEGER")
    })

    it("should reject non-integer page", () => {
      expect(
        () => new Criteria(Filters.fromValues([]), Order.none(), 10, 1.5)
      ).toThrow("CRITERIA_PAGE_MUST_BE_A_POSITIVE_INTEGER")
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
