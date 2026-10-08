import {
  AggregateRelations,
  AggregateRoot,
  InvalidArgumentError,
} from "../src/AggregateRoot"
import { Order } from "../src/criteria/Order"
import { MongoClientFactory } from "../src/mongo/MongoClientFactory"
import { MongoRepository } from "../src/mongo/MongoRepository"

class TestEntity extends AggregateRoot {
  constructor(private readonly name: string = "") {
    super()
  }

  static collectionName(): string {
    return "many_limit_entities"
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
    return "many_limit_customers"
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
    return "many_limit_orders"
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

describe("MongoRepository.many limit", () => {
  let repository: TestRepository
  let orderRepository: OrderRepository
  let mockCollection: any

  beforeEach(async () => {
    repository = new TestRepository()
    orderRepository = new OrderRepository()

    const client = await MongoClientFactory.createClient()
    mockCollection = client.db().collection("many_limit_entities")

    jest.clearAllMocks()
    mockCollection.toArray.mockResolvedValue([])
  })

  it("applies the limit to the Mongo cursor after sorting", async () => {
    await repository.many(
      { status: "active" },
      { sort: Order.asc("name"), limit: 3 }
    )

    expect(mockCollection.find).toHaveBeenCalledWith(
      { status: "active" },
      undefined
    )
    expect(mockCollection.sort).toHaveBeenCalledWith({ name: 1 })
    expect(mockCollection.limit).toHaveBeenCalledWith(3)
    expect(mockCollection.sort.mock.invocationCallOrder[0]).toBeLessThan(
      mockCollection.limit.mock.invocationCallOrder[0]
    )
  })

  it("preserves the unbounded many behavior when limit is omitted", async () => {
    await repository.many({ status: "active" })

    expect(mockCollection.sort).toHaveBeenCalledWith({ _id: -1 })
    expect(mockCollection.limit).not.toHaveBeenCalled()
  })

  it.each([0, -1, 1.5])(
    "rejects invalid limit %p before database I/O",
    async (limit) => {
      await expect(repository.many({}, { limit })).rejects.toEqual(
        new InvalidArgumentError("The many limit must be a positive integer")
      )

      expect(MongoClientFactory.createClient).not.toHaveBeenCalled()
    }
  )

  it("places the limit before relation lookups", async () => {
    await orderRepository.many(
      { status: "active" },
      {
        sort: Order.asc("number"),
        limit: 2,
        relations: [{ entity: CustomerAggregateRoot }],
      }
    )

    const [pipeline] = mockCollection.aggregate.mock.calls[0]

    expect(pipeline[0]).toEqual({ $match: { status: "active" } })
    expect(pipeline[1]).toEqual({ $sort: { number: 1 } })
    expect(pipeline[2]).toEqual({ $limit: 2 })
    expect(pipeline[3].$lookup).toBeDefined()
  })
})
