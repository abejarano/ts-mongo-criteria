import { Order } from "../criteria/Order"
import { MongoSort } from "../types"

/**
 * Translates one order or a sequence of orders into the Mongo sort document.
 * The sequence order is preserved, so `[Order.desc("updatedAt"), Order.asc("urn")]`
 * becomes `{ updatedAt: -1, urn: 1 }`: a total order that the database applies
 * before `limit`, which is what a deterministic top-N requires.
 *
 * Orders without an order type (`Order.none()`) are ignored. When no order
 * remains, the historical default `{ _id: -1 }` is kept.
 */
export const buildMongoSort = (sort?: Order | Order[]): MongoSort => {
  const orders = (Array.isArray(sort) ? sort : sort ? [sort] : []).filter(
    (order) => order.hasOrder()
  )

  if (orders.length === 0) return { _id: -1 }

  return Object.assign(
    {},
    ...orders.map((order) => ({
      [order.orderBy.value === "id" ? "_id" : order.orderBy.value]:
        order.orderType.isAsc() ? 1 : -1,
    }))
  )
}
