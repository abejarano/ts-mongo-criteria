import { MongoCriteriaConverter, MongoQuery } from "./MongoCriteriaConverter"
import { MongoClientFactory } from "./MongoClientFactory"
import { MongoTransaction } from "./MongoTransaction"
import { Criteria, Paginate } from "../criteria"
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
  private query!: MongoQuery
  private criteria!: Criteria

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

    return this.aggregateRootClass.fromPrimitives({
      ...result,
      id: result._id.toString(),
    })
  }

  public async many(
    filter: object,
    options?: {
      transaction?: MongoTransaction
      fields?: string[]
      sort: MongoSort
    }
  ): Promise<T[]> {
    const collection = await this.collection<Document>()
    const session = options?.transaction
      ? MongoTransaction.sessionFor(options?.transaction)
      : undefined

    const documents = await collection
      .find(filter, session === undefined ? undefined : { session })
      .sort(options?.sort ? options?.sort : { _id: -1 })
      .toArray()

    return documents.map((document) =>
      this.aggregateRootClass.fromPrimitives({
        ...document,
        id: document._id.toString(),
      })
    )
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

    await this.updateOne(
      { _id: mongoId },
      {
        $set: {
          ...primitives,
        },
      },
      transaction
    )

    if (currentId === undefined) {
      entity.assignId(mongoId.toString())
    }
  }

  /** Lists entities by criteria and returns a paginated response. */
  public async list<D>(
    criteria: Criteria,
    fieldsToExclude: string[] = [],
    transaction?: MongoTransaction
  ): Promise<Paginate<D>> {
    const documents = await this.searchByCriteria<D>(
      criteria,
      fieldsToExclude,
      transaction
    )
    return this.paginate<D>(documents, transaction)
  }

  /**
   * Deletes documents from the database based on a filter and optional options.
   *
   * @param {object} filter - The query to match documents that should be deleted.
   * @param {DeleteOptions} [options] - Optional parameters that modify the behavior of the delete operation.
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

  private async searchByCriteria<D>(
    criteria: Criteria,
    fieldsToExclude: string[] = [],
    transaction?: MongoTransaction
  ): Promise<D[]> {
    this.criteria = criteria
    this.query = this.criteriaConverter.convert(criteria)

    const collection = await this.collection()
    const session = MongoTransaction.sessionFor(transaction)

    if (fieldsToExclude.length === 0) {
      const results = await collection
        .find(this.query.filter as any, session ? { session } : {})
        .sort(this.query.sort)
        .skip(this.query.skip)
        .limit(this.query.limit)
        .toArray()

      return results.map(({ _id, ...rest }) => rest as D)
    }

    const projection: { [key: string]: 0 } = {}
    fieldsToExclude.forEach((field) => {
      projection[field] = 0
    })

    const results = await collection
      .find(
        this.query.filter as any,
        session ? { projection, session } : { projection }
      )
      .sort(this.query.sort)
      .skip(this.query.skip)
      .limit(this.query.limit)
      .toArray()

    return results.map(({ _id, ...rest }) => rest as D)
  }

  private async paginate<T>(
    documents: T[],
    transaction?: MongoTransaction
  ): Promise<Paginate<T>> {
    const collection = await this.collection()
    const session = MongoTransaction.sessionFor(transaction)
    const count = session
      ? await collection.countDocuments(this.query.filter as any, { session })
      : await collection.countDocuments(this.query.filter as any)

    const limit = this.criteria?.limit || 10
    const currentPage = this.criteria?.currentPage || 1

    const hasNextPage: boolean = currentPage * limit < count

    if (documents.length === 0) {
      return {
        nextPag: null,
        count: 0,
        results: [],
      }
    }

    return {
      nextPag: hasNextPage ? Number(this.criteria.currentPage) + 1 : null,
      count: count,
      results: documents,
    }
  }
}
