import { Criteria, Paginate } from "../criteria"
import { AggregateRoot } from "../AggregateRoot"
import { DeleteOptions } from "mongodb"

export interface IRepository<T extends AggregateRoot> {
  one(filter: object): Promise<T | null>

  list<D>(criteria: Criteria, fieldsToExclude?: string[]): Promise<Paginate<D>>

  upsert(entity: T): Promise<void>

  delete(filter: object, options?: DeleteOptions): Promise<void>
}
