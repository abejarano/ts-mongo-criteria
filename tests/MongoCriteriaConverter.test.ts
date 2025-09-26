import { MongoCriteriaConverter } from "../src/mongo";
import { Criteria, Filters, Operator, Order } from "../src/criteria";
import { OrderTypes } from "../src/criteria/OrderType";

describe("MongoCriteriaConverter", () => {
  let converter: MongoCriteriaConverter;

  beforeEach(() => {
    converter = new MongoCriteriaConverter();
  });

  describe("convert", () => {
    it("should convert criteria with filters to mongo query", () => {
      const filters = [
        new Map([
          ["field", "status"],
          ["operator", Operator.EQUAL],
          ["value", "active"],
        ]),
      ];

      const criteria = new Criteria(
        Filters.fromValues(filters),
        Order.fromValues("createdAt", OrderTypes.DESC),
        10,
        2,
      );

      const mongoQuery = converter.convert(criteria);

      expect(mongoQuery.filter).toEqual({ status: { $eq: "active" } });
      expect(mongoQuery.sort).toEqual({ createdAt: -1 });
      expect(mongoQuery.skip).toBe(10); // (2-1) * 10
      expect(mongoQuery.limit).toBe(10);
    });

    it("should convert criteria without filters", () => {
      const criteria = new Criteria(
        Filters.fromValues([]),
        Order.fromValues("_id", OrderTypes.DESC),
      );

      const mongoQuery = converter.convert(criteria);

      expect(mongoQuery.filter).toEqual({});
      expect(mongoQuery.sort).toEqual({ _id: -1 });
      expect(mongoQuery.skip).toBe(0);
      expect(mongoQuery.limit).toBe(0);
    });

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
      ];

      const criteria = new Criteria(Filters.fromValues(filters), Order.none());

      const mongoQuery = converter.convert(criteria);

      expect(mongoQuery.filter).toEqual({
        status: { $eq: "active" },
        age: { $gt: "18" },
      });
    });

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
      ];

      const criteria = new Criteria(Filters.fromValues(filters), Order.none());

      const mongoQuery = converter.convert(criteria);

      expect(mongoQuery.filter).toEqual({
        name: { $regex: "john" },
        price: { $lte: "100" },
      });
    });
  });
});
