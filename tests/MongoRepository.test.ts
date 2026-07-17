import { MongoRepository } from "../src/mongo/MongoRepository"
import { Criteria } from "../src/criteria/Criteria"
import { Filters } from "../src/criteria/Filters"
import { Order } from "../src/criteria/Order"
import { OrderTypes } from "../src/criteria/OrderType"
import { Operator } from "../src/criteria/FilterOperator"
import { AggregateRoot } from "../src/AggregateRoot"

// Mock de AggregateRoot para tests
class TestEntity extends AggregateRoot {
  constructor(
    private id: string,
    private name: string,
    private email: string,
    private status: string
  ) {
    super()
  }

  getId(): string {
    return this.id
  }

  toPrimitives(): any {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      status: this.status,
    }
  }

  static override fromPrimitives(data: any): TestEntity {
    return new TestEntity(data.id, data.name, data.email, data.status)
  }
}

// Mock de MongoClientFactory
jest.mock("../src/mongo/MongoClientFactory", () => {
  const mockCollection = {
    find: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    toArray: jest.fn(),
    countDocuments: jest.fn(),
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

// Import después del mock para evitar problemas de inicialización
import { MongoClientFactory } from "../src/mongo/MongoClientFactory"
import { MongoTransaction } from "../src/mongo/MongoTransaction"

// Mock de MongoRepository para tests
class TestRepository extends MongoRepository<TestEntity> {
  constructor() {
    super(TestEntity)
  }

  collectionName(): string {
    return "test_collection"
  }

  protected async ensureIndexes(_collection: any): Promise<void> {
    // no-op for tests
  }

  async update(
    filter: object,
    update: object,
    transaction?: MongoTransaction
  ): Promise<void> {
    await this.updateOne(filter, update, transaction)
  }
}

describe("MongoRepository", () => {
  let repository: TestRepository
  let mockCollection: any

  beforeEach(async () => {
    repository = new TestRepository()

    // Obtener el mock de collection
    const client = await MongoClientFactory.createClient()
    const db = client.db()
    mockCollection = db.collection("test_collection")

    jest.clearAllMocks()
  })

  describe("list", () => {
    it("should list with simple criteria without field exclusion", async () => {
      // Arrange
      const mockResults = [
        {
          _id: "objectId1",
          id: "1",
          name: "John",
          email: "john@test.com",
          status: "active",
        },
        {
          _id: "objectId2",
          id: "2",
          name: "Jane",
          email: "jane@test.com",
          status: "active",
        },
      ]

      const expectedResults = [
        { id: "1", name: "John", email: "john@test.com", status: "active" },
        { id: "2", name: "Jane", email: "jane@test.com", status: "active" },
      ]

      mockCollection.toArray.mockResolvedValue(mockResults)
      mockCollection.countDocuments.mockResolvedValue(2)

      const filters = [
        new Map([
          ["field", "status"],
          ["operator", Operator.EQUAL],
          ["value", "active"],
        ]),
      ]

      const criteria = new Criteria(
        Filters.fromValues(filters),
        Order.fromValues("name", OrderTypes.ASC),
        10,
        1
      )

      // Act
      const result = await repository.list(criteria)

      // Assert
      expect(result).toEqual({
        nextPag: null,
        count: 2,
        results: expectedResults,
      })
      expect(mockCollection.find).toHaveBeenCalledWith(
        { status: { $eq: "active" } },
        {}
      )
      expect(mockCollection.sort).toHaveBeenCalledWith({ name: 1 })
      expect(mockCollection.skip).toHaveBeenCalledWith(0)
      expect(mockCollection.limit).toHaveBeenCalledWith(10)
      expect(mockCollection.countDocuments).toHaveBeenCalledWith({
        status: { $eq: "active" },
      })
    })

    it("should list with field exclusion", async () => {
      // Arrange
      const mockResults = [
        { _id: "objectId1", id: "1", name: "John", status: "active" },
        { _id: "objectId2", id: "2", name: "Jane", status: "active" },
      ]

      const expectedResults = [
        { id: "1", name: "John", status: "active" },
        { id: "2", name: "Jane", status: "active" },
      ]

      mockCollection.toArray.mockResolvedValue(mockResults)
      mockCollection.countDocuments.mockResolvedValue(2)

      const filters = [
        new Map([
          ["field", "status"],
          ["operator", Operator.EQUAL],
          ["value", "active"],
        ]),
      ]

      const criteria = new Criteria(
        Filters.fromValues(filters),
        Order.fromValues("name", OrderTypes.ASC),
        10,
        1
      )

      const fieldsToExclude = ["email", "createdAt"]

      // Act
      const result = await repository.list(criteria, fieldsToExclude)

      // Assert
      expect(result).toEqual({
        nextPag: null,
        count: 2,
        results: expectedResults,
      })
      expect(mockCollection.find).toHaveBeenCalledWith(
        { status: { $eq: "active" } },
        { projection: { email: 0, createdAt: 0 } }
      )
      expect(mockCollection.sort).toHaveBeenCalledWith({ name: 1 })
      expect(mockCollection.skip).toHaveBeenCalledWith(0)
      expect(mockCollection.limit).toHaveBeenCalledWith(10)
      expect(mockCollection.countDocuments).toHaveBeenCalledWith({
        status: { $eq: "active" },
      })
    })

    it("should handle multiple filters with pagination", async () => {
      // Arrange
      const mockResults = [
        {
          _id: "objectId3",
          id: "3",
          name: "Bob",
          email: "bob@test.com",
          status: "active",
        },
      ]

      const expectedResults = [
        { id: "3", name: "Bob", email: "bob@test.com", status: "active" },
      ]

      mockCollection.toArray.mockResolvedValue(mockResults)
      mockCollection.countDocuments.mockResolvedValue(12)

      const filters = [
        new Map([
          ["field", "status"],
          ["operator", Operator.EQUAL],
          ["value", "active"],
        ]),
        new Map([
          ["field", "name"],
          ["operator", Operator.CONTAINS],
          ["value", "Bo"],
        ]),
      ]

      const criteria = new Criteria(
        Filters.fromValues(filters),
        Order.fromValues("createdAt", OrderTypes.DESC),
        5,
        2 // Segunda página
      )

      // Act
      const result = await repository.list(criteria)

      // Assert
      expect(result).toEqual({
        nextPag: 3,
        count: 12,
        results: expectedResults,
      })
      expect(mockCollection.find).toHaveBeenCalledWith(
        {
          status: { $eq: "active" },
          name: { $regex: "Bo" },
        },
        {}
      )
      expect(mockCollection.sort).toHaveBeenCalledWith({ createdAt: -1 })
      expect(mockCollection.skip).toHaveBeenCalledWith(5) // (page 2 - 1) * limit 5
      expect(mockCollection.limit).toHaveBeenCalledWith(5)
      expect(mockCollection.countDocuments).toHaveBeenCalledWith({
        status: { $eq: "active" },
        name: { $regex: "Bo" },
      })
    })

    it("should return empty results when no results found", async () => {
      // Arrange
      mockCollection.toArray.mockResolvedValue([])
      mockCollection.countDocuments.mockResolvedValue(0)

      const filters = [
        new Map([
          ["field", "status"],
          ["operator", Operator.EQUAL],
          ["value", "nonexistent"],
        ]),
      ]

      const criteria = new Criteria(
        Filters.fromValues(filters),
        Order.none(),
        10,
        1
      )

      // Act
      const result = await repository.list(criteria)

      // Assert
      expect(result).toEqual({
        nextPag: null,
        count: 0,
        results: [],
      })
      expect(mockCollection.toArray).toHaveBeenCalled()
      expect(mockCollection.countDocuments).toHaveBeenCalledWith({
        status: { $eq: "nonexistent" },
      })
    })

    it("should remove _id field from results", async () => {
      // Arrange
      const mockResults = [
        { _id: "shouldBeRemoved", id: "1", name: "Test", data: "value" },
      ]

      const expectedResults = [{ id: "1", name: "Test", data: "value" }]

      mockCollection.toArray.mockResolvedValue(mockResults)
      mockCollection.countDocuments.mockResolvedValue(1)

      const criteria = new Criteria(Filters.fromValues([]), Order.none(), 10, 1)

      // Act
      const result = await repository.list(criteria)

      // Assert
      expect(result.results).toEqual(expectedResults)
      expect(result.results[0]).not.toHaveProperty("_id")
    })
  })

  describe("transactions", () => {
    const entity = new TestEntity(
      "507f1f77bcf86cd799439011",
      "John",
      "john@test.com",
      "active"
    )

    it("passes the transaction session to upsert, delete and protected updates", async () => {
      const session = {
        withTransaction: jest.fn(async (callback) => callback()),
        endSession: jest.fn(),
      }
      ;(MongoClientFactory.createClient as jest.Mock).mockResolvedValue({
        startSession: jest.fn().mockReturnValue(session),
        db: jest.fn().mockReturnValue({
          collection: jest.fn().mockReturnValue(mockCollection),
        }),
      })
      mockCollection.updateOne = jest.fn()
      mockCollection.deleteMany = jest.fn()

      await MongoTransaction.run(async (transaction) => {
        await repository.upsert(entity, transaction)
        await repository.delete({ status: "inactive" }, undefined, transaction)
        await repository.update(
          { email: "john@test.com" },
          { $set: { name: "Jane" } },
          transaction
        )
      })

      expect(mockCollection.updateOne).toHaveBeenNthCalledWith(
        1,
        { _id: expect.anything() },
        expect.anything(),
        { upsert: true, session }
      )
      expect(mockCollection.deleteMany).toHaveBeenCalledWith(
        { status: "inactive" },
        { session }
      )
      expect(mockCollection.updateOne).toHaveBeenNthCalledWith(
        2,
        { email: "john@test.com" },
        { $set: { name: "Jane" } },
        { upsert: true, session }
      )
    })

    it("preserves write options when no transaction is provided", async () => {
      mockCollection.updateOne = jest.fn()
      mockCollection.deleteMany = jest.fn()

      await repository.delete({ status: "inactive" })
      await repository.update(
        { email: "john@test.com" },
        { $set: { name: "Jane" } }
      )

      expect(mockCollection.deleteMany).toHaveBeenCalledWith(
        { status: "inactive" },
        undefined
      )
      expect(mockCollection.updateOne).toHaveBeenCalledWith(
        { email: "john@test.com" },
        { $set: { name: "Jane" } },
        { upsert: true }
      )
    })
  })
})
