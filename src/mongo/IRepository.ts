import { ObjectId } from "mongodb"
import { Criteria, Paginate } from "../criteria"
import { AggregateRoot } from "../AggregateRoot"

export interface IRepository<T extends AggregateRoot> {
  one(filter: object): Promise<T | null>
  list<D>(
    criteria: Criteria,
    fieldsToExclude?: string[]
  ): Promise<Paginate<D>>
  upsert(entity: T): Promise<ObjectId | null>
}
