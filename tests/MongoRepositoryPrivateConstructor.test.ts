import { ObjectId } from "mongodb"
import { AggregateRelations, AggregateRoot } from "../src/AggregateRoot"
import { MongoClientFactory } from "../src/mongo/MongoClientFactory"
import { MongoRepository } from "../src/mongo/MongoRepository"

const ROOT_ID = "507f1f77bcf86cd799439011"
const RELATED_ID = "507f191e810c19729de860ea"

class PrivateCustomerAggregateRoot extends AggregateRoot {
  private constructor(private readonly name: string) {
    super()
  }

  static collectionName(): string {
    return "private_customers"
  }

  static relations(): AggregateRelations {
    return {}
  }

  static fromPrimitives(
    data: Record<string, any>
  ): PrivateCustomerAggregateRoot {
    return new PrivateCustomerAggregateRoot(data.name)
  }

  getName(): string {
    return this.name
  }

  toPrimitives(): Record<string, unknown> {
    return { id: this.getId(), name: this.name }
  }
}

class PrivateOrderAggregateRoot extends AggregateRoot {
  private constructor(
    private readonly number: string,
    private readonly customer: PrivateCustomerAggregateRoot | null
  ) {
    super()
  }

  static collectionName(): string {
    return "private_orders"
  }

  static relations(): AggregateRelations {
    return { customer: PrivateCustomerAggregateRoot }
  }

  static fromPrimitives(data: Record<string, any>): PrivateOrderAggregateRoot {
    return new PrivateOrderAggregateRoot(data.number, data.customer ?? null)
  }

  getNumber(): string {
    return this.number
  }

  getCustomer(): PrivateCustomerAggregateRoot | null {
    return this.customer
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
    findOne: jest.fn(),
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

class PrivateOrderRepository extends MongoRepository<PrivateOrderAggregateRoot> {
  constructor() {
    super(PrivateOrderAggregateRoot)
  }

  protected async ensureIndexes(): Promise<void> {}
}

describe("MongoRepository private aggregate constructors", () => {
  let repository: PrivateOrderRepository
  let mockCollection: any

  beforeEach(async () => {
    repository = new PrivateOrderRepository()

    const client = await MongoClientFactory.createClient()
    mockCollection = client.db().collection("private_orders")

    jest.clearAllMocks()
    mockCollection.toArray.mockResolvedValue([])
  })

  it("hydrates a root with a private constructor through fromPrimitives", async () => {
    mockCollection.findOne.mockResolvedValue({
      _id: new ObjectId(ROOT_ID),
      number: "ORD-001",
      customer: null,
    })

    const result = await repository.one({ number: "ORD-001" })

    expect(result).toBeInstanceOf(PrivateOrderAggregateRoot)
    expect(result?.getId()).toBe(ROOT_ID)
    expect(result?.getNumber()).toBe("ORD-001")
  })

  it("hydrates a related aggregate with a private constructor through fromPrimitives", async () => {
    mockCollection.toArray.mockResolvedValue([
      {
        _id: new ObjectId(ROOT_ID),
        number: "ORD-001",
        customerId: new ObjectId(RELATED_ID),
        customer: {
          _id: new ObjectId(RELATED_ID),
          name: "ACME",
        },
      },
    ])

    const result = await repository.one(
      { number: "ORD-001" },
      { relations: [{ entity: PrivateCustomerAggregateRoot }] }
    )

    expect(result).toBeInstanceOf(PrivateOrderAggregateRoot)
    expect(result?.getCustomer()).toBeInstanceOf(PrivateCustomerAggregateRoot)
    expect(result?.getCustomer()?.getId()).toBe(RELATED_ID)
    expect(result?.getCustomer()?.getName()).toBe("ACME")
  })
})
