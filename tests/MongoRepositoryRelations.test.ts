import { AggregateRoot, AggregateRelations } from "../src/AggregateRoot"
import { Criteria } from "../src/criteria/Criteria"
import { Filters } from "../src/criteria/Filters"
import { Order } from "../src/criteria/Order"
import { Operator } from "../src/criteria/FilterOperator"
import { MongoRepository } from "../src/mongo/MongoRepository"
import { ObjectId } from "mongodb"

const CUSTOMER_ID = "507f1f77bcf86cd799439011"
const SELLER_ID = "507f191e810c19729de860ea"

class CustomerAggregateRoot extends AggregateRoot {
  constructor(
    private readonly name: string = "",
    private readonly cnpj: string = ""
  ) {
    super()
  }

  toPrimitives(): any {
    return { id: this.getId(), name: this.name, cnpj: this.cnpj }
  }

  static collectionName(): string {
    return "customers"
  }

  static relations(): AggregateRelations {
    return {}
  }

  static fromPrimitives(data: Record<string, any>): CustomerAggregateRoot {
    return new CustomerAggregateRoot(data.name, data.cnpj)
  }
}

class UserAggregateRoot extends AggregateRoot {
  constructor(private readonly name: string = "") {
    super()
  }

  toPrimitives(): any {
    return { id: this.getId(), name: this.name }
  }

  static collectionName(): string {
    return "users"
  }

  static relations(): AggregateRelations {
    return {}
  }

  static fromPrimitives(data: Record<string, any>): UserAggregateRoot {
    return new UserAggregateRoot(data.name)
  }
}

class OrderAggregateRoot extends AggregateRoot {
  constructor(
    private readonly number: string = "",
    private readonly status: string = "",
    private readonly customerId?: string,
    private readonly customer: CustomerAggregateRoot | null = null,
    private readonly seller: UserAggregateRoot | null = null
  ) {
    super()
  }

  toPrimitives(): any {
    return {
      id: this.getId(),
      number: this.number,
      status: this.status,
      customerId: this.customerId,
      customer: this.customer,
      seller: this.seller,
    }
  }

  getCustomer(): CustomerAggregateRoot | null {
    return this.customer
  }

  static collectionName(): string {
    return "relation_orders"
  }

  static relations(): AggregateRelations {
    return { customer: CustomerAggregateRoot, seller: UserAggregateRoot }
  }

  static fromPrimitives(data: Record<string, any>): OrderAggregateRoot {
    return new OrderAggregateRoot(
      data.number,
      data.status,
      data.customerId,
      data.customer ?? null,
      data.seller ?? null
    )
  }
}

jest.mock("../src/mongo/MongoClientFactory", () => {
  const mockCollection = {
    findOne: jest.fn(),
    find: jest.fn().mockReturnThis(),
    aggregate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    toArray: jest.fn(),
    countDocuments: jest.fn(),
    createIndex: jest.fn(),
    updateOne: jest.fn(),
  }

  return {
    MongoClientFactory: {
      createClient: jest.fn().mockResolvedValue({
        db: jest.fn().mockReturnValue({
          collection: jest.fn().mockReturnValue(mockCollection),
        }),
      }),
    },
  }
})

import { MongoClientFactory } from "../src/mongo/MongoClientFactory"
import { MongoTransaction } from "../src/mongo/MongoTransaction"

class OrderRepository extends MongoRepository<OrderAggregateRoot> {
  constructor() {
    super(OrderAggregateRoot)
  }

  protected async ensureIndexes(): Promise<void> {}
}

describe("MongoRepository reference relations", () => {
  let repository: OrderRepository
  let mockCollection: any

  beforeEach(async () => {
    repository = new OrderRepository()

    const client = await MongoClientFactory.createClient()
    mockCollection = client.db().collection("relation_orders")

    jest.clearAllMocks()
    mockCollection.toArray.mockResolvedValue([])
    mockCollection.countDocuments.mockResolvedValue(0)
    mockCollection.updateOne.mockResolvedValue({})
  })

  it("takes the collection name from the aggregate", () => {
    expect(repository.collectionName()).toBe("relation_orders")
  })

  it("does not aggregate when no relation is selected", async () => {
    mockCollection.findOne.mockResolvedValue({
      _id: CUSTOMER_ID,
      number: "ORD-001",
      status: "active",
    })

    const result = await repository.one({ number: "ORD-001" })

    expect(mockCollection.aggregate).not.toHaveBeenCalled()
    expect(mockCollection.findOne).toHaveBeenCalledWith({ number: "ORD-001" })
    expect(result).toBeInstanceOf(OrderAggregateRoot)
    expect(result?.getId()).toBe(CUSTOMER_ID)
  })

  it("resolves an explicitly selected relation with the canonical $lookup", async () => {
    mockCollection.toArray.mockResolvedValue([
      {
        _id: CUSTOMER_ID,
        number: "ORD-001",
        status: "active",
        customerId: new ObjectId(CUSTOMER_ID),
        customer: { _id: new ObjectId(CUSTOMER_ID), name: "ACME", cnpj: "123" },
      },
    ])

    const result = await repository.one(
      { number: "ORD-001" },
      { relations: [{ entity: CustomerAggregateRoot }] }
    )

    const [pipeline, options] = mockCollection.aggregate.mock.calls[0]

    expect(pipeline).toEqual([
      { $match: { number: "ORD-001" } },
      { $limit: 1 },
      {
        $lookup: {
          from: "customers",
          localField: "customerId",
          foreignField: "_id",
          as: "customer",
        },
      },
      {
        $set: {
          customer: { $ifNull: [{ $arrayElemAt: ["$customer", 0] }, null] },
        },
      },
    ])
    expect(options).toBeUndefined()

    const customer = result?.getCustomer()

    expect(customer).toBeInstanceOf(CustomerAggregateRoot)
    expect(customer?.getId()).toBe(CUSTOMER_ID)
  })

  it("projects only the requested fields inside the $lookup pipeline", async () => {
    mockCollection.toArray.mockResolvedValue([])

    await repository.one(
      { number: "ORD-001" },
      { relations: [{ entity: CustomerAggregateRoot, fields: ["name"] }] }
    )

    const [pipeline] = mockCollection.aggregate.mock.calls[0]

    expect(pipeline[2].$lookup.pipeline).toEqual([
      { $project: { _id: 1, name: 1 } },
    ])
    expect(pipeline[2].$lookup.from).toBe("customers")
  })

  it("requests identity only when fields is an empty array", async () => {
    mockCollection.toArray.mockResolvedValue([])

    await repository.one(
      { number: "ORD-001" },
      { relations: [{ entity: CustomerAggregateRoot, fields: [] }] }
    )

    const [pipeline] = mockCollection.aggregate.mock.calls[0]

    expect(pipeline[2].$lookup.pipeline).toEqual([{ $project: { _id: 1 } }])
  })

  it("resolves multiple selected relations independently", async () => {
    mockCollection.toArray.mockResolvedValue([])

    await repository.many(
      { status: "active" },
      {
        sort: Order.asc("number"),
        relations: [
          { entity: CustomerAggregateRoot, fields: ["name"] },
          { entity: UserAggregateRoot },
        ],
      }
    )

    const [pipeline] = mockCollection.aggregate.mock.calls[0]

    expect(pipeline[0]).toEqual({ $match: { status: "active" } })
    expect(pipeline[1]).toEqual({ $sort: { number: 1 } })
    expect(pipeline[2].$lookup.as).toBe("customer")
    expect(pipeline[4].$lookup.as).toBe("seller")
    expect(pipeline[4].$lookup.from).toBe("users")
    expect(pipeline[4].$lookup.localField).toBe("sellerId")
  })

  it("resolves relations for list with pagination before the lookups", async () => {
    mockCollection.toArray.mockResolvedValue([])
    mockCollection.countDocuments.mockResolvedValue(0)

    const criteria = new Criteria(
      Filters.fromValues([
        new Map([
          ["field", "status"],
          ["operator", Operator.EQUAL],
          ["value", "active"],
        ]),
      ]),
      Order.desc("number"),
      10,
      1
    )

    await repository.list(criteria, {
      relations: [{ entity: CustomerAggregateRoot }],
    })

    const [pipeline] = mockCollection.aggregate.mock.calls[0]

    expect(pipeline[0]).toEqual({ $match: { status: { $eq: "active" } } })
    expect(pipeline[1]).toEqual({ $sort: { number: -1 } })
    expect(pipeline[2]).toEqual({ $skip: 0 })
    expect(pipeline[3]).toEqual({ $limit: 10 })
    expect(pipeline[4].$lookup.as).toBe("customer")
    // pagination count must not run the lookups
    expect(mockCollection.countDocuments).toHaveBeenCalledWith(
      { status: { $eq: "active" } },
      undefined
    )
  })

  it("returns null when the reference does not match any document", async () => {
    mockCollection.toArray.mockResolvedValue([
      {
        _id: CUSTOMER_ID,
        number: "ORD-001",
        status: "active",
        customerId: new ObjectId(CUSTOMER_ID),
        customer: null,
      },
    ])

    const result = await repository.one(
      { number: "ORD-001" },
      { relations: [{ entity: CustomerAggregateRoot }] }
    )

    expect(result?.getCustomer()).toBeNull()
  })

  it("hydrates every selected relation of a list result", async () => {
    mockCollection.toArray.mockResolvedValue([
      {
        _id: CUSTOMER_ID,
        number: "ORD-001",
        status: "active",
        customerId: new ObjectId(CUSTOMER_ID),
        sellerId: new ObjectId(SELLER_ID),
        customer: { _id: new ObjectId(CUSTOMER_ID), name: "ACME" },
        seller: { _id: new ObjectId(SELLER_ID), name: "Bob" },
      },
    ])
    mockCollection.countDocuments.mockResolvedValue(1)

    const criteria = new Criteria(Filters.fromValues([]), Order.none(), 10, 1)

    const page = await repository.list(criteria, {
      relations: [
        { entity: CustomerAggregateRoot },
        { entity: UserAggregateRoot },
      ],
    })

    expect(page.count).toBe(1)
    expect(page.nextPag).toBeNull()
    expect(page.results[0]).toBeInstanceOf(OrderAggregateRoot)
    expect(page.results[0].getCustomer()?.getId()).toBe(CUSTOMER_ID)
  })

  it("throws when the requested class is not a declared relation", async () => {
    class UnknownAggregateRoot extends AggregateRoot {
      toPrimitives(): any {
        return {}
      }
      static collectionName(): string {
        return "unknown"
      }
      static relations(): AggregateRelations {
        return {}
      }
      static fromPrimitives(): UnknownAggregateRoot {
        return new UnknownAggregateRoot()
      }
    }

    await expect(
      repository.one(
        { number: "ORD-001" },
        { relations: [{ entity: UnknownAggregateRoot }] }
      )
    ).rejects.toThrow(/no es una relación declarada/)
  })

  it("throws when the same relation is requested twice", async () => {
    await expect(
      repository.one(
        { number: "ORD-001" },
        {
          relations: [
            { entity: CustomerAggregateRoot },
            { entity: CustomerAggregateRoot },
          ],
        }
      )
    ).rejects.toThrow(/se pide dos veces/)
  })

  it("passes the transaction session to the aggregation", async () => {
    const session = {
      withTransaction: jest.fn(async (callback: any) => callback()),
      endSession: jest.fn(),
    }

    ;(MongoClientFactory.createClient as jest.Mock).mockResolvedValue({
      startSession: jest.fn().mockReturnValue(session),
      db: jest.fn().mockReturnValue({
        collection: jest.fn().mockReturnValue(mockCollection),
      }),
    })
    mockCollection.toArray.mockResolvedValue([])

    await MongoTransaction.run(async (transaction) => {
      await repository.one(
        { number: "ORD-001" },
        { transaction, relations: [{ entity: CustomerAggregateRoot }] }
      )
    })

    expect(mockCollection.aggregate).toHaveBeenCalledWith(expect.any(Array), {
      session,
    })
  })

  describe("upsert references", () => {
    it("derives <name>Id from the related aggregate and unsets the embedded object", async () => {
      const customer = new CustomerAggregateRoot("ACME", "123")
      customer.assignId(CUSTOMER_ID)

      const order = new OrderAggregateRoot(
        "ORD-001",
        "active",
        undefined,
        customer
      )

      await repository.upsert(order)

      const [filter, update, options] = mockCollection.updateOne.mock.calls[0]

      expect(filter._id).toBeInstanceOf(ObjectId)
      expect(filter._id.toString()).toBe(order.getId())
      expect(update.$set.customerId).toEqual(new ObjectId(CUSTOMER_ID))
      expect(update.$set.customer).toBeUndefined()
      expect(update.$unset).toEqual({ customer: "", seller: "" })
      expect(options).toEqual({ upsert: true })
    })

    it("normalizes a string reference stored in <name>Id", async () => {
      const order = new OrderAggregateRoot("ORD-002", "active", CUSTOMER_ID)

      await repository.upsert(order)

      const [, update] = mockCollection.updateOne.mock.calls[0]

      expect(update.$set.customerId).toEqual(new ObjectId(CUSTOMER_ID))
    })

    it("persists an explicit null reference", async () => {
      const order = new OrderAggregateRoot("ORD-003", "active", undefined, null)

      await repository.upsert(order)

      const [, update] = mockCollection.updateOne.mock.calls[0]

      expect(update.$set.customerId).toBeNull()
    })

    it("throws when the related aggregate has no id", async () => {
      const customer = new CustomerAggregateRoot("ACME", "123")
      const order = new OrderAggregateRoot(
        "ORD-004",
        "active",
        undefined,
        customer
      )

      await expect(repository.upsert(order)).rejects.toThrow(
        /la referencia no tiene id/
      )
    })
  })
})

class BrandBrainAggregateRoot extends AggregateRoot {
  constructor(
    private readonly level: string = "basic",
    private readonly accountConnectionId?: string,
    private readonly brandBrains: BrandBrainAggregateRoot[] = []
  ) {
    super()
  }

  toPrimitives(): any {
    return {
      id: this.getId(),
      level: this.level,
      accountConnectionId: this.accountConnectionId,
      brandBrains: this.brandBrains,
    }
  }

  getBrandBrains(): BrandBrainAggregateRoot[] {
    return this.brandBrains
  }

  static collectionName(): string {
    return "brand_brains"
  }

  static relations(): AggregateRelations {
    return {}
  }

  static fromPrimitives(data: Record<string, any>): BrandBrainAggregateRoot {
    return new BrandBrainAggregateRoot(
      data.level,
      data.accountConnectionId,
      data.brandBrains ?? []
    )
  }
}

class ConnectionAggregateRoot extends AggregateRoot {
  constructor(private readonly brandBrains: BrandBrainAggregateRoot[] = []) {
    super()
  }

  toPrimitives(): any {
    return { id: this.getId(), brandBrains: this.brandBrains }
  }

  getBrandBrains(): BrandBrainAggregateRoot[] {
    return this.brandBrains
  }

  static collectionName(): string {
    return "account_connections"
  }

  static relations(): AggregateRelations {
    return {
      brandBrains: {
        entity: BrandBrainAggregateRoot,
        inverseOf: "accountConnectionId",
        many: true,
      },
    }
  }

  static fromPrimitives(data: Record<string, any>): ConnectionAggregateRoot {
    return new ConnectionAggregateRoot(data.brandBrains ?? [])
  }
}

class ConnectionRepository extends MongoRepository<ConnectionAggregateRoot> {
  constructor() {
    super(ConnectionAggregateRoot)
  }

  protected async ensureIndexes(): Promise<void> {}
}

describe("MongoRepository inverse relations (ONE_TO_MANY)", () => {
  let repository: ConnectionRepository
  let mockCollection: any

  beforeEach(async () => {
    repository = new ConnectionRepository()

    const client = await MongoClientFactory.createClient()
    mockCollection = client.db().collection("account_connections")

    jest.clearAllMocks()
    mockCollection.toArray.mockResolvedValue([])
    mockCollection.countDocuments.mockResolvedValue(0)
    mockCollection.updateOne.mockResolvedValue({})
  })

  it("takes the collection name from the aggregate", () => {
    expect(repository.collectionName()).toBe("account_connections")
  })

  it("looks up the children by _id and keeps the array", async () => {
    mockCollection.toArray.mockResolvedValue([])

    await repository.many(
      {},
      { relations: [{ entity: BrandBrainAggregateRoot }] }
    )

    const [pipeline] = mockCollection.aggregate.mock.calls[0]

    expect(pipeline).toEqual([
      { $match: {} },
      { $sort: { _id: -1 } },
      {
        $lookup: {
          from: "brand_brains",
          localField: "_id",
          foreignField: "accountConnectionId",
          as: "brandBrains",
        },
      },
    ])
  })

  it("hydrates the children into domain instances", async () => {
    mockCollection.toArray.mockResolvedValue([
      {
        _id: new ObjectId(CUSTOMER_ID),
        brandBrains: [
          {
            _id: new ObjectId(SELLER_ID),
            level: "basic",
            accountConnectionId: new ObjectId(CUSTOMER_ID),
          },
        ],
      },
    ])

    const result = await repository.one(
      { urn: "urn:account:1" },
      { relations: [{ entity: BrandBrainAggregateRoot }] }
    )

    const brains = result?.getBrandBrains() ?? []

    expect(brains).toHaveLength(1)
    expect(brains[0]).toBeInstanceOf(BrandBrainAggregateRoot)
    expect(brains[0].getId()).toBe(SELLER_ID)
  })

  it("does not write a reference for an inverse relation", async () => {
    const brain = new BrandBrainAggregateRoot("basic")
    brain.assignId(SELLER_ID)

    const connection = new ConnectionAggregateRoot([brain])

    await repository.upsert(connection)

    const [, update] = mockCollection.updateOne.mock.calls[0]

    expect(update.$set.brandBrains).toBeUndefined()
    expect(update.$set.brandBrainsId).toBeUndefined()
    expect(update.$unset).toEqual({ brandBrains: "" })
  })
})
