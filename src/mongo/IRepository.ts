import { Criteria, Paginate } from "../criteria"
import { AggregateRoot } from "../AggregateRoot"
import { DeleteOptions } from "mongodb"
import { MongoTransaction } from "./MongoTransaction"
import { Order } from "../criteria"

export interface IRepository<T extends AggregateRoot> {
  many(
    filter: object,
    options?: {
      transaction?: MongoTransaction
      fieldsToExclude?: string[]
      sort?: Order
    }
  ): Promise<T[]>

  one(filter: object, transaction?: MongoTransaction): Promise<T | null>

  list<D>(
    criteria: Criteria,
    fieldsToExclude?: string[],
    transaction?: MongoTransaction
  ): Promise<Paginate<D>>

  upsert(entity: T, transaction?: MongoTransaction): Promise<void>

  delete(
    filter: object,
    options?: DeleteOptions,
    transaction?: MongoTransaction
  ): Promise<void>
}
