import { MongoCriteriaConverter, MongoQuery } from "./MongoCriteriaConverter";
import { MongoClientFactory } from "./MongoClientFactory";
import { Criteria, Paginate } from "../criteria";
import { AggregateRoot } from "../AggregateRoot";
import { Collection, ObjectId } from "mongodb";

export abstract class MongoRepository<T extends AggregateRoot> {
  private criteriaConverter: MongoCriteriaConverter;
  private query!: MongoQuery;
  private criteria!: Criteria;

  protected constructor() {
    this.criteriaConverter = new MongoCriteriaConverter();
  }

  abstract collectionName(): string;

  // transformationToUpsertInSubDocuments(
  //   subDocumentField: string,
  //   primitiveData: any,
  // ): {} {
  //   const response = {};
  //
  //   for (const key in primitiveData) {
  //     response[`${subDocumentField}.$.${key}`] = primitiveData[key];
  //   }
  //
  //   return response;
  // }

  public async paginate<T>(documents: T[]): Promise<Paginate<T>> {
    const collection = await this.collection();

    const count = await collection.countDocuments(this.query.filter as any);

    const limit = this.criteria?.limit || 10;
    const currentPage = this.criteria?.currentPage || 1;

    const hasNextPage: boolean = currentPage * limit < count;

    if (documents.length === 0) {
      return {
        nextPag: null,
        count: 0,
        results: [],
      };
    }

    return {
      nextPag: hasNextPage ? Number(this.criteria.currentPage) + 1 : null,
      count: count,
      results: documents,
    };
  }

  protected async collection(): Promise<Collection<T>> {
    return (await MongoClientFactory.createClient())
      .db()
      .collection<T>(this.collectionName());
  }

  protected async persist(
    id: string,
    aggregateRoot: T,
  ): Promise<ObjectId | null> {
    let primitives: any;

    if (aggregateRoot.toPrimitives() instanceof Promise) {
      primitives = await aggregateRoot.toPrimitives();
    } else {
      primitives = aggregateRoot.toPrimitives();
    }

    return await this.updateOne(id, {
      ...primitives,
      id: id,
    });
  }

  protected async updateOne(
    id: string,
    document: any,
  ): Promise<ObjectId | null> {
    const collection = await this.collection();

    const result = await collection.updateOne(
      { _id: new ObjectId(id) } as any,
      { $set: document },
      { upsert: true },
    );

    return result.upsertedId;
  }

  protected async searchByCriteriaWithProjection<D>(
    criteria: Criteria,
    objectTypeField: string
  ): Promise<D[]> {
    this.criteria = criteria
    this.query = this.criteriaConverter.convert(criteria)

    const projection: { [key: string]: any } = {}
    projection[objectTypeField] = {
      $slice: [Number(this.query.skip), Number(this.query.limit)],
    }

    const collection = await this.collection()

    const results = await collection
      .find(this.query.filter as any, { projection })
      .sort(this.query.sort)
      .toArray();

    return results.map(({ _id, ...rest }) => rest as D);
  }
}
