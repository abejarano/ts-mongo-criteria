import { ObjectId } from "mongodb"
import { AggregateRoot, AggregateRelations } from "../src/AggregateRoot"
import { Criteria, Filters, Order } from "../src/criteria"
import { buildJoinStages } from "../src/mongo/MongoJoinResolver"
import { MongoJoin } from "../src/mongo/IRepository"
import { MongoRepository } from "../src/mongo/MongoRepository"

jest.mock("../src/mongo/MongoClientFactory", () => {
  const collection = {
    aggregate: jest.fn().mockReturnThis(),
    toArray: jest.fn(),
    countDocuments: jest.fn(),
    find: jest.fn().mockReturnThis(),
    findOne: jest.fn(),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
  }
  return {
    MongoClientFactory: {
      createClient: jest
        .fn()
        .mockResolvedValue({ db: () => ({ collection: () => collection }) }),
    },
  }
})
import { MongoClientFactory } from "../src/mongo/MongoClientFactory"

class Target extends AggregateRoot {
  static collectionName() {
    return "targets"
  }
  static relations(): AggregateRelations {
    return {}
  }
  static fromPrimitives(data: Record<string, unknown>) {
    return new Target(data)
  }
  constructor(readonly data: Record<string, unknown>) {
    super()
  }
  toPrimitives() {
    return this.data
  }
}
class Root extends AggregateRoot {
  static collectionName() {
    return "roots"
  }
  static relations(): AggregateRelations {
    return { target: Target }
  }
  static fromPrimitives(data: Record<string, unknown>) {
    return new Root(data)
  }
  constructor(readonly data: Record<string, unknown>) {
    super()
  }
  toPrimitives() {
    return this.data
  }
}
class Repository extends MongoRepository<Root> {
  constructor() {
    super(Root)
  }
  protected async ensureIndexes() {}
}

const join: MongoJoin = {
  from: "teacher_assignments",
  as: "assignment",
  on: [
    { localField: "userId", foreignField: "userId" },
    { localField: "scopeId", foreignField: "nucleusId" },
    { localField: "schoolYear", foreignField: "schoolYear" },
  ],
  fields: ["disciplines"],
}

describe("query joins", () => {
  it("builds a compound lookup and returns the first result", () => {
    expect(buildJoinStages([join], [])).toEqual([
      {
        $lookup: {
          from: "teacher_assignments",
          as: "assignment",
          let: {
            joinField0: "$userId",
            joinField1: "$scopeId",
            joinField2: "$schoolYear",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$userId", "$$joinField0"] },
                    { $eq: ["$nucleusId", "$$joinField1"] },
                    { $eq: ["$schoolYear", "$$joinField2"] },
                  ],
                },
              },
            },
            { $project: { _id: 0, disciplines: 1 } },
          ],
        },
      },
      {
        $set: {
          assignment: { $ifNull: [{ $arrayElemAt: ["$assignment", 0] }, null] },
        },
      },
    ])
  })

  it("supports single fields, arrays, and exact projections", () => {
    const base = { ...join, on: [join.on[0]], many: true }
    expect(
      buildJoinStages([{ ...base, fields: ["_id", "disciplines"] }], [])[0]
        .$lookup.pipeline[1]
    ).toEqual({ $project: { _id: 1, disciplines: 1 } })
    expect(
      buildJoinStages([{ ...base, fields: ["_id"] }], [])[0].$lookup.pipeline[1]
    ).toEqual({ $project: { _id: 1 } })
    expect(
      buildJoinStages([{ ...base, fields: [] }], [])[0].$lookup.pipeline[1]
    ).toEqual({ $replaceWith: { $literal: {} } })
    expect(buildJoinStages([{ ...base, fields: undefined }], [])).toHaveLength(
      1
    )
    expect(
      buildJoinStages([{ ...base, fields: undefined }], [])[0].$lookup.pipeline
    ).toHaveLength(1)
  })

  it("rejects invalid joins and duplicate aliases", () => {
    for (const bad of [
      { ...join, from: "" },
      { ...join, as: " " },
      { ...join, as: "_id" },
      { ...join, on: [] },
      { ...join, on: [{ localField: "", foreignField: "x" }] },
      { ...join, fields: [""] },
      { ...join, many: "yes" },
    ])
      expect(() => buildJoinStages([bad as MongoJoin], [])).toThrow()
    expect(() => buildJoinStages([join, join], [])).toThrow(/alias/)
    expect(() =>
      buildJoinStages([{ ...join, as: "target" }], [{ name: "target" } as any])
    ).toThrow(/alias/)
  })

  it("uses joins in one, many and list and preserves raw values alongside relations", async () => {
    const collection: any = (await MongoClientFactory.createClient())
      .db()
      .collection("roots")
    jest.clearAllMocks()
    const id = new ObjectId()
    const relatedId = new ObjectId()
    collection.toArray.mockResolvedValue([
      {
        _id: id,
        assignment: { disciplines: ["math"] },
        target: { _id: relatedId },
      },
    ])
    collection.countDocuments.mockResolvedValue(1)
    const repository = new Repository()
    const options = { joins: [join], relations: [{ entity: Target }] }
    const one = await repository.one({ active: true }, options)
    expect(one?.data.assignment).toEqual({ disciplines: ["math"] })
    expect(one?.data.target).toBeInstanceOf(Target)
    let pipeline = collection.aggregate.mock.calls[0][0]
    expect(pipeline.slice(0, 2)).toEqual([
      { $match: { active: true } },
      { $limit: 1 },
    ])
    expect(pipeline[2].$lookup.as).toBe("target")
    expect(pipeline[4].$lookup.as).toBe("assignment")
    const many = await repository.many(
      {},
      { ...options, sort: Order.desc("year"), limit: 2 }
    )
    expect(many[0].data.assignment).toEqual({ disciplines: ["math"] })
    pipeline = collection.aggregate.mock.calls[1][0]
    expect(pipeline.slice(0, 3)).toEqual([
      { $match: {} },
      { $sort: { year: -1 } },
      { $limit: 2 },
    ])
    const list = await repository.list(
      new Criteria(Filters.fromValues([]), Order.desc("year"), 2, 2),
      options
    )
    expect(list.results[0].data.assignment).toEqual({ disciplines: ["math"] })
    pipeline = collection.aggregate.mock.calls[2][0]
    expect(pipeline.slice(1, 4)).toEqual([
      { $sort: { year: -1 } },
      { $skip: 2 },
      { $limit: 2 },
    ])
    expect(collection.countDocuments).toHaveBeenCalledTimes(1)
    collection.toArray.mockResolvedValue([
      { _id: id, assignment: null, target: null },
    ])
    expect((await repository.one({}, options))?.data.assignment).toBeNull()
    collection.toArray.mockResolvedValue([
      { _id: id, assignment: [], target: null },
    ])
    expect(
      (await repository.one({}, { joins: [{ ...join, many: true }] }))?.data
        .assignment
    ).toEqual([])
  })
})
