import {
  Criteria,
  FilterInputValue,
  Filters,
  MongoCriteriaConverter,
  Operator,
  OrCondition,
  Order,
  OrderTypes,
} from "../src"

describe("MongoCriteriaConverter", () => {
  let converter: MongoCriteriaConverter

  beforeEach(() => {
    converter = new MongoCriteriaConverter()
  })

  describe("convert", () => {
    it("should convert criteria with filters to mongo query", () => {
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
        10,
        2
      )

      const mongoQuery = converter.convert(criteria)

      expect(mongoQuery.filter).toEqual({ status: { $eq: "active" } })
      expect(mongoQuery.sort).toEqual({ createdAt: -1 })
      expect(mongoQuery.skip).toBe(10) // (2-1) * 10
      expect(mongoQuery.limit).toBe(10)
    })

    it("should convert criteria without filters", () => {
      const criteria = new Criteria(
        Filters.fromValues([]),
        Order.fromValues("_id", OrderTypes.DESC)
      )

      const mongoQuery = converter.convert(criteria)

      expect(mongoQuery.filter).toEqual({})
      expect(mongoQuery.sort).toEqual({ _id: -1 })
      expect(mongoQuery.skip).toBe(0)
      expect(mongoQuery.limit).toBe(0)
    })

    it("should handle multiple filters", () => {
      const filters = [
        new Map([
          ["field", "status"],
          ["operator", Operator.EQUAL],
          ["value", "active"],
        ]),
        new Map([
          ["field", "age"],
          ["operator", Operator.GT],
          ["value", "18"],
        ]),
      ]

      const criteria = new Criteria(Filters.fromValues(filters), Order.none())

      const mongoQuery = converter.convert(criteria)

      expect(mongoQuery.filter).toEqual({
        status: { $eq: "active" },
        age: { $gt: "18" },
      })
    })

    it("should handle different operators", () => {
      const filters = [
        new Map([
          ["field", "name"],
          ["operator", Operator.CONTAINS],
          ["value", "john"],
        ]),
        new Map([
          ["field", "price"],
          ["operator", Operator.LTE],
          ["value", "100"],
        ]),
      ]

      const criteria = new Criteria(Filters.fromValues(filters), Order.none())

      const mongoQuery = converter.convert(criteria)

      expect(mongoQuery.filter).toEqual({
        name: { $regex: "john" },
        price: { $lte: "100" },
      })
    })

    it("should handle BETWEEN operator with date values", () => {
      const startDate = new Date("2024-01-01T00:00:00.000Z")
      const endDate = new Date("2024-01-31T23:59:59.999Z")

      const filters = [
        new Map<string, FilterInputValue>([
          ["field", "createdAt"],
          ["operator", Operator.BETWEEN],
          ["value", { start: startDate, end: endDate }],
        ]),
      ]

      const criteria = new Criteria(Filters.fromValues(filters), Order.none())

      const mongoQuery = converter.convert(criteria)

      expect(mongoQuery.filter).toEqual({
        createdAt: { $gte: startDate, $lte: endDate },
      })
    })

    it("should handle BETWEEN operator with startDate/endDate keys", () => {
      const startDate = new Date("2023-05-01T00:00:00.000Z")
      const endDate = new Date("2023-05-31T23:59:59.999Z")

      const filters = [
        new Map<string, FilterInputValue>([
          ["field", "createdAt"],
          ["operator", Operator.BETWEEN],
          ["value", { startDate, endDate }],
        ]),
      ]

      const criteria = new Criteria(Filters.fromValues(filters), Order.none())

      const mongoQuery = converter.convert(criteria)

      expect(mongoQuery.filter).toEqual({
        createdAt: { $gte: startDate, $lte: endDate },
      })
    })

    it("should handle OR operator with CONTAINS conditions", () => {
      const orConditions: OrCondition[] = [
        { field: "name", operator: Operator.CONTAINS, value: "john" },
        { field: "description", operator: Operator.CONTAINS, value: "john" },
      ]

      const filters = [
        new Map<string, FilterInputValue>([
          ["field", "search"], // field name is not used for OR operator
          ["operator", Operator.OR],
          ["value", orConditions],
        ]),
      ]

      const criteria = new Criteria(Filters.fromValues(filters), Order.none())

      const mongoQuery = converter.convert(criteria)

      expect(mongoQuery.filter).toEqual({
        $or: [
          { name: { $regex: "john" } },
          { description: { $regex: "john" } },
        ],
      })
    })

    it("should handle OR operator with mixed operators", () => {
      const orConditions: OrCondition[] = [
        { field: "status", operator: Operator.EQUAL, value: "active" },
        { field: "priority", operator: Operator.GT, value: "5" },
        { field: "title", operator: Operator.CONTAINS, value: "urgent" },
      ]

      const filters = [
        new Map<string, FilterInputValue>([
          ["field", "search"],
          ["operator", Operator.OR],
          ["value", orConditions],
        ]),
      ]

      const criteria = new Criteria(Filters.fromValues(filters), Order.none())

      const mongoQuery = converter.convert(criteria)

      expect(mongoQuery.filter).toEqual({
        $or: [
          { status: { $eq: "active" } },
          { priority: { $gt: "5" } },
          { title: { $regex: "urgent" } },
        ],
      })
    })

    it("should handle OR operator with NOT_CONTAINS", () => {
      const orConditions: OrCondition[] = [
        { field: "name", operator: Operator.CONTAINS, value: "admin" },
        { field: "role", operator: Operator.NOT_CONTAINS, value: "guest" },
      ]

      const filters = [
        new Map<string, FilterInputValue>([
          ["field", "search"],
          ["operator", Operator.OR],
          ["value", orConditions],
        ]),
      ]

      const criteria = new Criteria(Filters.fromValues(filters), Order.none())

      const mongoQuery = converter.convert(criteria)

      expect(mongoQuery.filter).toEqual({
        $or: [
          { name: { $regex: "admin" } },
          { role: { $not: { $regex: "guest" } } },
        ],
      })
    })

    it("should handle OR operator with comparison operators", () => {
      const orConditions: OrCondition[] = [
        { field: "age", operator: Operator.GTE, value: "18" },
        { field: "experience", operator: Operator.LTE, value: "2" },
        { field: "score", operator: Operator.NOT_EQUAL, value: "0" },
      ]

      const filters = [
        new Map<string, FilterInputValue>([
          ["field", "search"],
          ["operator", Operator.OR],
          ["value", orConditions],
        ]),
      ]

      const criteria = new Criteria(Filters.fromValues(filters), Order.none())

      const mongoQuery = converter.convert(criteria)

      expect(mongoQuery.filter).toEqual({
        $or: [
          { age: { $gte: "18" } },
          { experience: { $lte: "2" } },
          { score: { $ne: "0" } },
        ],
      })
    })

    it("should combine OR operator with other filters", () => {
      const orConditions: OrCondition[] = [
        { field: "name", operator: Operator.CONTAINS, value: "john" },
        { field: "email", operator: Operator.CONTAINS, value: "john" },
      ]

      const filters = [
        new Map([
          ["field", "status"],
          ["operator", Operator.EQUAL],
          ["value", "active"],
        ]),
        new Map<string, FilterInputValue>([
          ["field", "search"],
          ["operator", Operator.OR],
          ["value", orConditions],
        ]),
      ]

      const criteria = new Criteria(Filters.fromValues(filters), Order.none())

      const mongoQuery = converter.convert(criteria)

      expect(mongoQuery.filter).toEqual({
        status: { $eq: "active" },
        $or: [{ name: { $regex: "john" } }, { email: { $regex: "john" } }],
      })
    })

    it("should handle IN operator", () => {
      const filters = [
        new Map<string, FilterInputValue>([
          ["field", "status"],
          ["operator", Operator.IN],
          ["value", ["P", "F"]],
        ]),
      ]

      const criteria = new Criteria(Filters.fromValues(filters), Order.none())

      const mongoQuery = converter.convert(criteria)

      expect(mongoQuery.filter).toEqual({
        status: { $in: ["P", "F"] },
      })
    })

    it("should handle NOT_IN operator", () => {
      const filters = [
        new Map<string, FilterInputValue>([
          ["field", "status"],
          ["operator", Operator.NOT_IN],
          ["value", ["P", "F"]],
        ]),
      ]

      const criteria = new Criteria(Filters.fromValues(filters), Order.none())

      const mongoQuery = converter.convert(criteria)

      expect(mongoQuery.filter).toEqual({
        status: { $nin: ["P", "F"] },
      })
    })
  })
})
