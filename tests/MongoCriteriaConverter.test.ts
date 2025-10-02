import {
  Criteria,
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

    it("should handle OR operator with CONTAINS conditions", () => {
      const orConditions: OrCondition[] = [
        { field: "name", operator: Operator.CONTAINS, value: "john" },
        { field: "description", operator: Operator.CONTAINS, value: "john" },
      ]

      const filters = [
        new Map<string, string | string[] | OrCondition[]>([
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
        new Map<string, string | string[] | OrCondition[]>([
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
        new Map<string, string | string[] | OrCondition[]>([
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
        new Map<string, string | string[] | OrCondition[]>([
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
        new Map<string, string | string[] | OrCondition[]>([
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
  })
})
