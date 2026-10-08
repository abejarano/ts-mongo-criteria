import { AggregateRelations, AggregateRoot } from "../src/AggregateRoot"
import { Order } from "../src/criteria/Order"
import { MongoClientFactory } from "../src/mongo/MongoClientFactory"
import { MongoRepository } from "../src/mongo/MongoRepository"
import { buildMongoSort } from "../src/mongo/buildMongoSort"

class TestEntity extends AggregateRoot {
  constructor(private readonly name: string = "") {
    super()
  }

  static collectionName(): string {
    return "compound_sort_entities"
  }

  static relations(): AggregateRelations {
    return {}
  }

  static fromPrimitives(data: Record<string, any>): TestEntity {
    return new TestEntity(data.name)
  }

  toPrimitives(): Record<string, unknown> {
    return { id: this.getId(), name: this.name }
  }
}

class CustomerAggregateRoot extends AggregateRoot {
  constructor(private readonly name: string = "") {
    super()
  }

  static collectionName(): string {
    return "compound_sort_customers"
  }

  static relations(): AggregateRelations {
    return {}
  }

  static fromPrimitives(data: Record<string, any>): CustomerAggregateRoot {
    return new CustomerAggregateRoot(data.name)
  }

  toPrimitives(): Record<string, unknown> {
    return { id: this.getId(), name: this.name }
  }
}

class OrderAggregateRoot extends AggregateRoot {
  constructor(
    private readonly number: string = "",
    private readonly customer: CustomerAggregateRoot | null = null
  ) {
    super()
  }

  static collectionName(): string {
    return "compound_sort_orders"
  }

  static relations(): AggregateRelations {
    return { customer: CustomerAggregateRoot }
  }

  static fromPrimitives(data: Record<string, any>): OrderAggregateRoot {
    return new OrderAggregateRoot(data.number, data.customer ?? null)
  }

  toPrimitives(): Record<string, unknown> {
    return {
      id: this.getId(),
      number: this.number,
      customer: this.customer,
    }
  }
}

jest.mock("../src/mongo/MongoClientFactory", () => {
  const mockCollection = {
    find: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    aggregate: jest.fn().mockReturnThis(),
    toArray: jest.fn(),
    createIndex: jest.fn(),
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

class TestRepository extends MongoRepository<TestEntity> {
  constructor() {
    super(TestEntity)
  }

  protected async ensureIndexes(): Promise<void> {}
}

class OrderRepository extends MongoRepository<OrderAggregateRoot> {
  constructor() {
    super(OrderAggregateRoot)
  }

  protected async ensureIndexes(): Promise<void> {}
}

describe("buildMongoSort", () => {
  it("keeps the sequence of a compound sort", () => {
    expect(buildMongoSort([Order.desc("updatedAt"), Order.asc("urn")])).toEqual(
      { updatedAt: -1, urn: 1 }
    )
  })

  it("keeps working with a single order and the historical default", () => {
    expect(buildMongoSort(Order.asc("name"))).toEqual({ name: 1 })
    expect(buildMongoSort()).toEqual({ _id: -1 })
    expect(buildMongoSort([])).toEqual({ _id: -1 })
  })

  it("ignores orders without an order type and maps id to _id", () => {
    expect(buildMongoSort([Order.none(), Order.asc("urn")])).toEqual({
      urn: 1,
    })
    expect(buildMongoSort([Order.desc("id"), Order.asc("urn")])).toEqual({
      _id: -1,
      urn: 1,
    })
  })
})

describe("MongoRepository.many compound sort", () => {
  let repository: TestRepository
  let orderRepository: OrderRepository
  let mockCollection: any

  beforeEach(async () => {
    repository = new TestRepository()
    orderRepository = new OrderRepository()

    const client = await MongoClientFactory.createClient()
    mockCollection = client.db().collection("compound_sort_entities")

    jest.clearAllMocks()
    mockCollection.toArray.mockResolvedValue([])
  })

  it("sorts by every order in the database before applying the limit", async () => {
    await repository.many(
      { workspace: "urn:workspace:workspace-1" },
      { sort: [Order.desc("updatedAt"), Order.asc("urn")], limit: 3 }
    )

    expect(mockCollection.find).toHaveBeenCalledWith(
      { workspace: "urn:workspace:workspace-1" },
      undefined
    )
    expect(mockCollection.sort).toHaveBeenCalledWith({
      updatedAt: -1,
      urn: 1,
    })
    expect(mockCollection.limit).toHaveBeenCalledWith(3)
    expect(mockCollection.sort.mock.invocationCallOrder[0]).toBeLessThan(
      mockCollection.limit.mock.invocationCallOrder[0]
    )
  })

  it("keeps the single-order behavior unchanged", async () => {
    await repository.many({ status: "active" }, { sort: Order.asc("name") })

    expect(mockCollection.sort).toHaveBeenCalledWith({ name: 1 })
    expect(mockCollection.limit).not.toHaveBeenCalled()
  })

  it("applies the compound sort before the limit and the relation lookups", async () => {
    await orderRepository.many(
      { status: "active" },
      {
        sort: [Order.desc("number"), Order.asc("urn")],
        limit: 2,
        relations: [{ entity: CustomerAggregateRoot }],
      }
    )

    const [pipeline] = mockCollection.aggregate.mock.calls[0]

    expect(pipeline[0]).toEqual({ $match: { status: "active" } })
    expect(pipeline[1]).toEqual({ $sort: { number: -1, urn: 1 } })
    expect(pipeline[2]).toEqual({ $limit: 2 })
    expect(pipeline[3].$lookup).toBeDefined()
  })
})
