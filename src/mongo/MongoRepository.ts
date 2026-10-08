import { MongoCriteriaConverter, MongoQuery } from "./MongoCriteriaConverter"
import { MongoClientFactory } from "./MongoClientFactory"
import { MongoRelationResolver } from "./MongoRelationResolver"
import { MongoTransaction } from "./MongoTransaction"
import { Criteria, Paginate } from "../criteria"
import {
  AggregateRoot,
  AggregateRootClass,
  InvalidArgumentError,
  isInverseRelation,
  referenceOf,
} from "../AggregateRoot"
import {
  Collection,
  DeleteOptions,
  Document,
  ObjectId,
  UpdateFilter,
} from "mongodb"
import { MongoSort } from "../types"
import { MongoManyOptions, MongoReadOptions } from "./IRepository"

export abstract class MongoRepository<T extends AggregateRoot> {
  private static indexRegistry = new Set<string>()
  private criteriaConverter: MongoCriteriaConverter
  private readonly resolver: MongoRelationResolver

  protected constructor(
    private readonly aggregateRootClass: AggregateRootClass<T>
  ) {
    this.criteriaConverter = new MongoCriteriaConverter()
    this.resolver = new MongoRelationResolver(aggregateRootClass.relations())
  }

  /** Nombre de la colección raíz: viene del aggregate (manual reference). */
  public collectionName(): string {
    return this.aggregateRootClass.collectionName()
  }

  /** Finds a single entity and automatically resolves selected relations. */
  public async one(
    filter: object,
    options?: MongoReadOptions
  ): Promise<T | null> {
    const session = MongoTransaction.sessionFor(options?.transaction)
    const selected = this.resolver.resolve(options?.relations)
    const collection = await this.collection<Document>()

    if (selected.length === 0) {
      const result = session
        ? await collection.findOne(filter, { session })
        : await collection.findOne(filter)
      return result ? this.hydrate(result) : null
    }

    const documents = await collection
      .aggregate(
        [
          { $match: filter },
          { $limit: 1 },
          ...this.resolver.buildStages(selected),
        ],
        session ? { session } : undefined
      )
      .toArray()

    if (documents.length === 0) return null

    return this.hydrateWithRelations(documents[0], selected)
  }

  /** Finds multiple entities and automatically resolves selected relations. */
  public async many(filter: object, options?: MongoManyOptions): Promise<T[]> {
    const limit = options?.limit
    if (limit !== undefined && (!Number.isInteger(limit) || limit <= 0)) {
      throw new InvalidArgumentError("The many limit must be a positive integer")
    }

    const collection = await this.collection<Document>()

    let order: MongoSort = { _id: -1 }
    if (options?.sort?.hasOrder()) {
      order = {
        [options.sort.orderBy.value === "id"
          ? "_id"
          : options.sort.orderBy.value]: options.sort.orderType.isAsc()
          ? 1
          : -1,
      }
    }

    const session = MongoTransaction.sessionFor(options?.transaction)
    const selected = this.resolver.resolve(options?.relations)

    if (selected.length === 0) {
      const cursor = collection
        .find(filter, session ? { session } : undefined)
        .sort(order)

      if (limit !== undefined) cursor.limit(limit)

      const documents = await cursor.toArray()
      return documents.map((document) => this.hydrate(document))
    }

    const documents = await collection
      .aggregate(
        [
          { $match: filter },
          { $sort: order },
          ...(limit === undefined ? [] : [{ $limit: limit }]),
          ...this.resolver.buildStages(selected),
        ],
        session ? { session } : undefined
      )
      .toArray()

    return documents.map((document) =>
      this.hydrateWithRelations(document, selected)
    )
  }

  /** Lists entities by criteria and automatically resolves selected relations. */
  public async list(
    criteria: Criteria,
    options?: MongoReadOptions
  ): Promise<Paginate<T>> {
    const query = this.criteriaConverter.convert(criteria)

    const documents = await this.searchByCriteria(query, options)
    return this.paginate(documents, query, criteria, options?.transaction)
  }

  /** Deletes documents from the database based on a filter and optional options. */
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

    const { values, refs, cleanup } = this.resolveReferences(primitives)

    const update: Document = { $set: { ...values, ...refs } }

    if (cleanup.length > 0) {
      update.$unset = Object.fromEntries(cleanup.map((k) => [k, ""]))
    }

    await this.updateOne(
      { _id: mongoId },
      update as UpdateFilter<any>,
      transaction
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
    options?: MongoReadOptions
  ): Promise<T[]> {
    const collection = await this.collection<Document>()
    const session = MongoTransaction.sessionFor(options?.transaction)
    const selected = this.resolver.resolve(options?.relations)

    if (selected.length === 0) {
      const results = await collection
        .find(query.filter as any, session ? { session } : undefined)
        .sort(query.sort)
        .skip(query.skip)
        .limit(query.limit)
        .toArray()

      return results.map((document) => this.hydrate(document))
    }

    const results = await collection
      .aggregate(
        [
          { $match: query.filter },
          { $sort: query.sort },
          { $skip: query.skip },
          { $limit: query.limit },
          ...this.resolver.buildStages(selected),
        ],
        session ? { session } : undefined
      )
      .toArray()

    return results.map((document) =>
      this.hydrateWithRelations(document, selected)
    )
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
      return { nextPag: null, count, results: [] }
    }

    return {
      nextPag: hasNextPage ? Number(criteria.currentPage) + 1 : null,
      count,
      results: documents,
    }
  }

  /**
   * Transforma los primitives del root en los valores de $set y la referencia canónica
   * `<name>Id` como ObjectId, y devuelve la lista de campos legacy que hay que limpiar.
   *
   * Reglas por cada relación declarada `<clave>` → TargetClass:
   *  - primitives[<clave>] es un AggregateRoot → `new ObjectId(entity.getId())`
   *  - doc crudo con `_id` → `new ObjectId(doc._id)`
   *  - doc con `id` → `new ObjectId(doc.id)`
   *  - `null` explícito → referencia null
   *  - primitives[`${clave}Id`] presente → normaliza a ObjectId (string o ObjectId)
   *  - objeto relacionado sin id → InvalidArgumentError
   *  - nada de lo anterior → no se toca
   */
  private resolveReferences(primitives: Record<string, unknown>): {
    values: Record<string, unknown>
    refs: Record<string, unknown>
    cleanup: string[]
  } {
    const values: Record<string, unknown> = {}
    const refs: Record<string, unknown> = {}
    const cleanup: string[] = []
    const relationNames = new Set<string>()

    for (const [name, declaration] of Object.entries(
      this.aggregateRootClass.relations()
    )) {
      relationNames.add(name)

      const localField = `${name}Id`
      const value = primitives[name]

      // Las relaciones inversas no guardan la referencia: vive en el destino.
      // Sólo se limpia el campo si venía hidratado o embebido.
      if (isInverseRelation(declaration)) {
        if (name in primitives) {
          cleanup.push(name)
        }
        continue
      }

      const localValue = primitives[localField]
      let ref: unknown = undefined

      if (value instanceof AggregateRoot) {
        ref = value.getId()
        if (ref === undefined) {
          throw new InvalidArgumentError(
            `No se puede persistir ${this.collectionName()}.${name}: ` +
              "la referencia no tiene id"
          )
        }
      } else if (value && typeof value === "object") {
        const obj = value as Record<string, unknown>
        if (obj._id !== undefined) ref = obj._id
        else if (obj.id !== undefined) ref = obj.id
        else {
          throw new InvalidArgumentError(
            `No se puede persistir ${this.collectionName()}.${name}: ` +
              "la referencia no tiene id"
          )
        }
      }

      // La referencia explícita (`<name>Id`) manda si no hay objeto relacionado.
      if (ref === undefined && localValue !== undefined) {
        ref = localValue
      }

      // `null` explícito en el objeto relacionado: referencia nula.
      if (ref === undefined && value === null) {
        ref = null
      }

      // siempre eliminar el objeto relacionado del documento almacenado
      if (name in primitives || localField in primitives) {
        cleanup.push(name)
      }

      if (ref === undefined) {
        continue
      }

      if (ref === null) {
        refs[localField] = null
        continue
      }

      let objectId: ObjectId
      try {
        objectId = referenceOf(ref as string | AggregateRoot)
      } catch {
        throw new InvalidArgumentError(
          `No se puede persistir ${this.collectionName()}.${name}: ` +
            `la referencia no es un ObjectId válido (value=${JSON.stringify(ref)})`
        )
      }
      refs[localField] = objectId
    }

    // limpiar undefined values (el driver los serializa como null) y excluir
    // los objetos de relación, que ya se persisten como `<name>Id` y se $unset.
    for (const [k, v] of Object.entries(primitives)) {
      if (v !== undefined && !relationNames.has(k)) values[k] = v
    }

    return { values, refs, cleanup }
  }

  private hydrate(document: Document): T {
    const { _id, ...primitives } = document
    const entity = this.aggregateRootClass.fromPrimitives(primitives)

    entity.assignId(_id.toString())

    return entity
  }

  private hydrateWithRelations(
    document: Document,
    relations: ReturnType<MongoRelationResolver["resolve"]>
  ): T {
    const hydrated = this.resolver.hydrateRelated(document, relations)
    // hydrated contiene el mismo documento con las relaciones como instancias
    // Hydrate el root con las relaciones ya instanciadas
    const { _id, ...primitives } = hydrated as any as Document
    const entity = this.aggregateRootClass.fromPrimitives(primitives)
    entity.assignId(_id.toString())
    return entity
  }
}
