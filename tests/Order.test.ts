import { Order } from "../src/criteria";
import { OrderTypes } from "../src/criteria/OrderType";

describe("Order", () => {
  describe("fromValues", () => {
    it("should create order with field and type", () => {
      const order = Order.fromValues("createdAt", OrderTypes.DESC);

      expect(order.orderBy.value).toBe("createdAt");
      expect(order.orderType.value).toBe(OrderTypes.DESC);
      expect(order.hasOrder()).toBe(true);
    });

    it("should create order with default ASC when no type provided", () => {
      const order = Order.fromValues("name");

      expect(order.orderBy.value).toBe("name");
      expect(order.orderType.value).toBe(OrderTypes.ASC);
    });

    it("should create none order when no field provided", () => {
      const order = Order.fromValues();

      expect(order.hasOrder()).toBe(false);
    });
  });

  describe("static methods", () => {
    it("should create descending order", () => {
      const order = Order.desc("price");

      expect(order.orderBy.value).toBe("price");
      expect(order.orderType.value).toBe(OrderTypes.DESC);
    });

    it("should create ascending order", () => {
      const order = Order.asc("name");

      expect(order.orderBy.value).toBe("name");
      expect(order.orderType.value).toBe(OrderTypes.ASC);
    });

    it("should create none order", () => {
      const order = Order.none();

      expect(order.hasOrder()).toBe(false);
    });
  });

  describe("hasOrder", () => {
    it("should return true for valid order", () => {
      const order = Order.fromValues("createdAt", OrderTypes.DESC);

      expect(order.hasOrder()).toBe(true);
    });

    it("should return false for none order", () => {
      const order = Order.none();

      expect(order.hasOrder()).toBe(false);
    });
  });
});
