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
    id: string,
    private name: string,
    private email: string,
    private status: string
  ) {
    super(id)
  }

  toPrimitives(): any {
    return {
      id: this.getId(),
      name: this.name,
      email: this.email,
      status: this.status,
    }
  }

  static fromPrimitives(data: any): TestEntity {
    return new TestEntity(data.id, data.name, data.email, data.status)
  }
}

// Mock de MongoClientFactory
jest.mock("../src/mongo/MongoClientFactory", () => {
  const mockCollection = {
    findOne: jest.fn(),
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

  describe("many", () => {
    beforeEach(() => {
      mockCollection.sort = jest.fn().mockReturnThis()
    })

    it("should return hydrated entities matching the filter with default sort", async () => {
      const mockResults = [
        {
          _id: "507f1f77bcf86cd799439011",
          id: "507f1f77bcf86cd799439011",
          name: "Alice",
          email: "alice@test.com",
          status: "active",
        },
        {
          _id: "507f1f77bcf86cd799439012",
          id: "507f1f77bcf86cd799439012",
          name: "Bob",
          email: "bob@test.com",
          status: "active",
        },
      ]
      mockCollection.toArray.mockResolvedValue(mockResults)

      const results = await repository.many({ status: "active" })

      expect(results).toHaveLength(2)
      expect(results[0]).toBeInstanceOf(TestEntity)
      expect(results[1]).toBeInstanceOf(TestEntity)
      expect(results[0].toPrimitives()).toEqual({
        id: "507f1f77bcf86cd799439011",
        name: "Alice",
        email: "alice@test.com",
        status: "active",
      })
      expect(results[1].toPrimitives()).toEqual({
        id: "507f1f77bcf86cd799439012",
        name: "Bob",
        email: "bob@test.com",
        status: "active",
      })
      expect(mockCollection.find).toHaveBeenCalledWith(
        { status: "active" },
        undefined
      )
      expect(mockCollection.sort).toHaveBeenCalledWith({ _id: -1 })
    })

    it("should return an empty array when no documents match", async () => {
      mockCollection.toArray.mockResolvedValue([])

      const results = await repository.many({ status: "nonexistent" })

      expect(results).toEqual([])
      expect(mockCollection.find).toHaveBeenCalledWith(
        { status: "nonexistent" },
        undefined
      )
      expect(mockCollection.sort).toHaveBeenCalledWith({ _id: -1 })
    })

    it("should apply custom sort when provided", async () => {
      mockCollection.toArray.mockResolvedValue([])

      await repository.many(
        { status: "active" },
        { sort: { name: 1 } }
      )

      expect(mockCollection.sort).toHaveBeenCalledWith({ name: 1 })
    })

    it("should pass the session to find when a transaction is provided", async () => {
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
      mockCollection.toArray.mockResolvedValue([])

      await MongoTransaction.run(async (transaction) => {
        await repository.many(
          { status: "active" },
          { transaction, sort: { name: 1 } }
        )
      })

      expect(mockCollection.find).toHaveBeenCalledWith(
        { status: "active" },
        { session }
      )
      expect(mockCollection.sort).toHaveBeenCalledWith({ name: 1 })
    })
  })

  describe("upsert", () => {
    it("should assign a new id when entity has no id", async () => {
      mockCollection.updateOne = jest.fn()
      const entityWithoutId = new TestEntity(
        undefined as any,
        "NoID",
        "noid@test.com",
        "pending"
      )

      await repository.upsert(entityWithoutId)

      expect(mockCollection.updateOne).toHaveBeenCalledTimes(1)
      expect(entityWithoutId.getId()).toBeDefined()
    })

    it("should keep the existing id when entity has one", async () => {
      mockCollection.updateOne = jest.fn()
      const entity = new TestEntity(
        "507f1f77bcf86cd799439011",
        "John",
        "john@test.com",
        "active"
      )

      await repository.upsert(entity)

      expect(mockCollection.updateOne).toHaveBeenCalledTimes(1)
      expect(entity.getId()).toBe("507f1f77bcf86cd799439011")
    })

    it("should pass primitives in $set with id from entity", async () => {
      mockCollection.updateOne = jest.fn()
      const entity = new TestEntity(
        "507f1f77bcf86cd799439011",
        "John",
        "john@test.com",
        "active"
      )

      await repository.upsert(entity)

      const updateArg = mockCollection.updateOne.mock.calls[0][1]
      expect(updateArg.$set).toEqual({
        id: "507f1f77bcf86cd799439011",
        name: "John",
        email: "john@test.com",
        status: "active",
      })
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

    it("uses the transaction session for one, list, and pagination count", async () => {
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
      mockCollection.findOne.mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        id: "507f1f77bcf86cd799439011",
        name: "John",
        email: "john@test.com",
        status: "active",
      })
      mockCollection.toArray.mockResolvedValue([])
      mockCollection.countDocuments.mockResolvedValue(0)
      const criteria = new Criteria(Filters.fromValues([]), Order.none(), 10, 1)

      await MongoTransaction.run(async (transaction) => {
        const found = await repository.one(
          { email: "john@test.com" },
          transaction
        )
        const listed = await repository.list(criteria, [], transaction)

        expect(found).toBeInstanceOf(TestEntity)
        expect(listed).toEqual({ nextPag: null, count: 0, results: [] })
      })

      expect(mockCollection.findOne).toHaveBeenCalledWith(
        { email: "john@test.com" },
        { session }
      )
      expect(mockCollection.find).toHaveBeenCalledWith({}, { session })
      expect(mockCollection.countDocuments).toHaveBeenCalledWith(
        {},
        { session }
      )
    })
  })
})
