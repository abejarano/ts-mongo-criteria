import { Criteria, Paginate } from "../criteria"
import { AggregateRoot } from "../AggregateRoot"
import { DeleteOptions } from "mongodb"
import { MongoTransaction } from "./MongoTransaction"

export interface IRepository<T extends AggregateRoot> {
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
