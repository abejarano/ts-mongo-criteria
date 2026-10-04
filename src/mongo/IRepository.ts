import { AggregateRoot } from "../AggregateRoot"
import { Criteria, Order, Paginate } from "../criteria"
import { DeleteOptions } from "mongodb"
import { MongoTransaction } from "./MongoTransaction"
import { AggregateRelationSelection } from "../AggregateRoot"

export interface MongoReadOptions {
  transaction?: MongoTransaction
  relations?: AggregateRelationSelection[]
}

export interface IRepository<T extends AggregateRoot> {
  many(
    filter: object,
    options?: {
      transaction?: MongoTransaction
      sort?: Order
      relations?: AggregateRelationSelection[]
    }
  ): Promise<T[]>

  one(
    filter: object,
    options?: {
      transaction?: MongoTransaction
      relations?: AggregateRelationSelection[]
    }
  ): Promise<T | null>

  list(criteria: Criteria, options?: MongoReadOptions): Promise<Paginate<T>>

  upsert(entity: T, transaction?: MongoTransaction): Promise<void>

  delete(
    filter: object,
    options?: DeleteOptions,
    transaction?: MongoTransaction
  ): Promise<void>
}
