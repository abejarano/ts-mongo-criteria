import { MongoCriteriaConverter, MongoQuery } from "./MongoCriteriaConverter"
import { MongoClientFactory } from "./MongoClientFactory"
import { Criteria, Paginate } from "../criteria"
import { AggregateRoot, AggregateRootClass } from "../AggregateRoot"
import { Collection, Document, ObjectId, UpdateFilter } from "mongodb"

export abstract class MongoRepository<T extends AggregateRoot> {
  private criteriaConverter: MongoCriteriaConverter
  private query!: MongoQuery
  private criteria!: Criteria
  private static indexRegistry = new Set<string>()

  protected constructor(
    private readonly aggregateRootClass: AggregateRootClass<T>
  ) {
    this.criteriaConverter = new MongoCriteriaConverter()
  }

  abstract collectionName(): string
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

  private async collectionRaw<U extends Document>(): Promise<Collection<U>> {
    return (await MongoClientFactory.createClient())
      .db()
      .collection<U>(this.collectionName())
  }

  /** Finds a single entity and hydrates it via the aggregate's fromPrimitives. */
  public async one(filter: object): Promise<T | null> {
    const collection = await this.collection()
    const result = await collection.findOne(filter as any)

    if (!result) {
      return null
    }

    const { _id, ...rest } = result as any
    return this.aggregateRootClass.fromPrimitives(rest)
  }

  /** Upserts an aggregate by delegating to persist with its id. */
  public async upsert(entity: T): Promise<void> {
    await this.persist(entity.getId(), entity)
  }

  /** Lists entities by criteria and returns a paginated response. */
  public async list<D>(
    criteria: Criteria,
    fieldsToExclude: string[] = []
  ): Promise<Paginate<D>> {
    const documents = await this.searchByCriteria<D>(criteria, fieldsToExclude)
    return this.paginate<D>(documents)
  }

  protected async updateOne(
    filter: object,
    update: Document[] | UpdateFilter<any>
  ): Promise<void> {
    const collection = await this.collection()

    await collection.updateOne(filter, update, {
      upsert: true,
    })
  }

  private async persist(id: string, aggregateRoot: T): Promise<void> {
    let primitives: any

    if (aggregateRoot.toPrimitives() instanceof Promise) {
      primitives = await aggregateRoot.toPrimitives()
    } else {
      primitives = aggregateRoot.toPrimitives()
    }

    await this.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          ...primitives,
          id: id,
        },
      }
    )
  }

  private async searchByCriteria<D>(
    criteria: Criteria,
    fieldsToExclude: string[] = []
  ): Promise<D[]> {
    this.criteria = criteria
    this.query = this.criteriaConverter.convert(criteria)

    const collection = await this.collection()

    if (fieldsToExclude.length === 0) {
      const results = await collection
        .find(this.query.filter as any, {})
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
      .find(this.query.filter as any, { projection })
      .sort(this.query.sort)
      .skip(this.query.skip)
      .limit(this.query.limit)
      .toArray()

    return results.map(({ _id, ...rest }) => rest as D)
  }

  private async paginate<T>(documents: T[]): Promise<Paginate<T>> {
    const collection = await this.collection()

    const count = await collection.countDocuments(this.query.filter as any)

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
