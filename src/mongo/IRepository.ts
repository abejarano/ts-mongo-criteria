import { AggregateRoot } from "../AggregateRoot"
import { Criteria, Order, Paginate } from "../criteria"
import { DeleteOptions } from "mongodb"
import { MongoTransaction } from "./MongoTransaction"
import { AggregateRelationSelection } from "../AggregateRoot"

export interface MongoJoinField {
  localField: string
  foreignField: string
}

export interface MongoJoin {
  from: string
  as: string
  on: MongoJoinField[]
  fields?: string[]
  many?: boolean
}

export interface MongoReadOptions {
  transaction?: MongoTransaction
  relations?: AggregateRelationSelection[]
  joins?: MongoJoin[]
}

export interface MongoManyOptions extends MongoReadOptions {
  /**
   * One order, or several orders applied in sequence as a compound sort.
   * The database applies the order before `limit`.
   */
  sort?: Order | Order[]
  limit?: number
}

export interface IRepository<T extends AggregateRoot> {
  many(filter: object, options?: MongoManyOptions): Promise<T[]>

  one(filter: object, options?: MongoReadOptions): Promise<T | null>

  list(criteria: Criteria, options?: MongoReadOptions): Promise<Paginate<T>>

  upsert(entity: T, transaction?: MongoTransaction): Promise<void>

  delete(
    filter: object,
    options?: DeleteOptions,
    transaction?: MongoTransaction
  ): Promise<void>
}
