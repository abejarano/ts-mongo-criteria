import { MongoCriteriaConverter, MongoQuery } from "./MongoCriteriaConverter"
import { MongoClientFactory } from "./MongoClientFactory"
import { MongoTransaction } from "./MongoTransaction"
import { Criteria, Order, Paginate } from "../criteria"
import { AggregateRoot, AggregateRootClass } from "../AggregateRoot"
import {
  Collection,
  DeleteOptions,
  Document,
  ObjectId,
  UpdateFilter,
} from "mongodb"
import { MongoSort } from "../types"

export abstract class MongoRepository<T extends AggregateRoot> {
  private static indexRegistry = new Set<string>()
  private criteriaConverter: MongoCriteriaConverter

  protected constructor(
    private readonly aggregateRootClass: AggregateRootClass<T>
  ) {
    this.criteriaConverter = new MongoCriteriaConverter()
  }

  abstract collectionName(): string

  /** Finds a single entity and hydrates it via the aggregate's fromPrimitives. */
  public async one(
    filter: object,
    transaction?: MongoTransaction
  ): Promise<T | null> {
    const collection = await this.collection<T>()
    const session = MongoTransaction.sessionFor(transaction)
    const result = session
      ? await collection.findOne(filter as any, { session })
      : await collection.findOne(filter as any)

    if (!result) {
      return null
    }

    const { _id, ...primitives } = result

    const entity = this.aggregateRootClass.fromPrimitives(primitives)

    entity.assignId(_id.toString())

    return entity
  }

  /**
   *
   * @param filter
   * @param options
   */
  public async many(
    filter: object,
    options?: {
      transaction?: MongoTransaction
      sort?: Order
    }
  ): Promise<T[]> {
    const collection = await this.collection<Document>()

    let order: MongoSort = { _id: -1 }
    if (options?.sort?.hasOrder()) {
      order = {
        [options?.sort.orderBy.value === "id"
          ? "_id"
          : options?.sort.orderBy.value]: options.sort.orderType.isAsc()
          ? 1
          : -1,
      }
    }

    const session = MongoTransaction.sessionFor(options?.transaction)

    const documents = await collection
      .find(filter, session ? { session } : undefined)
      .sort(order)
      .toArray()

    return documents.map((document) => {
      const { _id, ...primitives } = document

      const entity = this.aggregateRootClass.fromPrimitives(primitives)

      entity.assignId(_id.toString())

      return entity
    })
  }

  /** Upserts an aggregate by delegating to persist with its id. */
  public async upsert(
    entity: T,
    transaction?: MongoTransaction
  ): Promise<void> {
    const primitiveResult = entity.toPrimitives()
    const primitives = await Promise.resolve(primitiveResult)

    const currentId = entity.getId()

    const mongoId =
      currentId === undefined ? new ObjectId() : new ObjectId(currentId)

    if (currentId === undefined) {
      entity.assignId(mongoId.toString())
    }

    await this.updateOne(
      { _id: mongoId },
      {
        $set: {
          ...primitives,
        },
      },
      transaction
    )
  }

  /** Lists entities by criteria and returns a paginated response. */
  public async list(
    criteria: Criteria,
    transaction?: MongoTransaction
  ): Promise<Paginate<T>> {
    const query = this.criteriaConverter.convert(criteria)

    const documents = await this.searchByCriteria(query, transaction)
    return this.paginate(documents, query, criteria, transaction)
  }

  /**
   * Deletes documents from the database based on a filter and optional options.
   *
   * @param {object} filter - The query to match documents that should be deleted.
   * @param {DeleteOptions} [options] - Optional parameters that modify the behavior of the delete operation.
   * @param transaction
   * @return {Promise<void>} A promise that resolves when the deletion is complete, or rejects if an error occurs.
   */
  public async delete(
    filter: object,
    options?: DeleteOptions,
    transaction?: MongoTransaction
  ): Promise<void> {
    const collection = await this.collection<T>()
    const session = MongoTransaction.sessionFor(transaction)

    await collection.deleteMany(
      filter,
      session ? { ...options, session } : options
    )
  }

  protected abstract ensureIndexes(collection: Collection): Promise<void>

  protected async ensureIndexesOnce(): Promise<void> {
    const key = this.collectionName()
    if (MongoRepository.indexRegistry.has(key)) return

    const collection = await this.collectionRaw()
    await this.ensureIndexes(collection)

    MongoRepository.indexRegistry.add(key)
  }

  protected async collection<U extends Document>(): Promise<Collection<U>> {
    await this.ensureIndexesOnce()
    return this.collectionRaw<U>()
  }

  protected async updateOne(
    filter: object,
    update: Document[] | UpdateFilter<any>,
    transaction?: MongoTransaction
  ): Promise<void> {
    const collection = await this.collection()
    const session = MongoTransaction.sessionFor(transaction)

    await collection.updateOne(
      filter,
      update,
      session ? { upsert: true, session } : { upsert: true }
    )
  }

  private async collectionRaw<U extends Document>(): Promise<Collection<U>> {
    return (await MongoClientFactory.createClient())
      .db()
      .collection<U>(this.collectionName())
  }

  private async searchByCriteria(
    query: MongoQuery,
    transaction?: MongoTransaction
  ): Promise<T[]> {
    const collection = await this.collection()

    const session = MongoTransaction.sessionFor(transaction)

    const results = await collection
      .find(query.filter as any, session ? { session } : undefined)
      .sort(query.sort)
      .skip(query.skip)
      .limit(query.limit)
      .toArray()

    return results.map(({ _id, ...rest }) => {
      const entity = this.aggregateRootClass.fromPrimitives(rest)
      entity.assignId(_id.toString())

      return entity
    })
  }

  private async paginate(
    documents: T[],
    query: MongoQuery,
    criteria: Criteria,
    transaction?: MongoTransaction
  ): Promise<Paginate<T>> {
    const collection = await this.collection()
    const session = MongoTransaction.sessionFor(transaction)

    const count = await collection.countDocuments(
      query.filter as any,
      session ? { session } : undefined
    )

    const limit = criteria.limit
    const currentPage = criteria.currentPage

    const hasNextPage: boolean = limit > 0 && currentPage * limit < count

    if (documents.length === 0) {
      return {
        nextPag: null,
        count,
        results: [],
      }
    }

    return {
      nextPag: hasNextPage ? Number(criteria.currentPage) + 1 : null,
      count: count,
      results: documents,
    }
  }
}
