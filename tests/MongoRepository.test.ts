import { MongoRepository } from "../src/mongo/MongoRepository";
import { Criteria } from "../src/criteria/Criteria";
import { Filters } from "../src/criteria/Filters";
import { Order } from "../src/criteria/Order";
import { OrderTypes } from "../src/criteria/OrderType";
import { Operator } from "../src/criteria/FilterOperator";
import { AggregateRoot } from "../src/AggregateRoot";

// Mock de AggregateRoot para tests
class TestEntity extends AggregateRoot {
  constructor(
    private id: string,
    private name: string,
    private email: string,
    private status: string
  ) {
    super();
  }

  getId(): string {
    return this.id;
  }

  toPrimitives(): any {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      status: this.status
    };
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
    countDocuments: jest.fn()
  };

  return {
    MongoClientFactory: {
      createClient: jest.fn().mockResolvedValue({
        db: jest.fn().mockReturnValue({
          collection: jest.fn().mockReturnValue(mockCollection)
        })
      })
    }
  };
});

// Import después del mock para evitar problemas de inicialización
import { MongoClientFactory } from "../src/mongo/MongoClientFactory";

// Mock de MongoRepository para tests
class TestRepository extends MongoRepository<TestEntity> {
  constructor() {
    super();
  }

  collectionName(): string {
    return 'test_collection';
  }

  // Exponemos el método protegido para testing
  async testSearchByCriteria<D>(criteria: Criteria, fieldsToExclude: string[] = []): Promise<D[]> {
    return this.searchByCriteria<D>(criteria, fieldsToExclude);
  }
}

describe('MongoRepository', () => {
  let repository: TestRepository;
  let mockCollection: any;

  beforeEach(async () => {
    repository = new TestRepository();
    
    // Obtener el mock de collection
    const client = await MongoClientFactory.createClient();
    const db = client.db();
    mockCollection = db.collection('test_collection');
    
    jest.clearAllMocks();
  });

  describe('searchByCriteria', () => {
    it('should search with simple criteria without field exclusion', async () => {
      // Arrange
      const mockResults = [
        { _id: 'objectId1', id: '1', name: 'John', email: 'john@test.com', status: 'active' },
        { _id: 'objectId2', id: '2', name: 'Jane', email: 'jane@test.com', status: 'active' }
      ];

      const expectedResults = [
        { id: '1', name: 'John', email: 'john@test.com', status: 'active' },
        { id: '2', name: 'Jane', email: 'jane@test.com', status: 'active' }
      ];

      mockCollection.toArray.mockResolvedValue(mockResults);

      const filters = [
        new Map([
          ["field", "status"],
          ["operator", Operator.EQUAL],
          ["value", "active"]
        ])
      ];

      const criteria = new Criteria(
        Filters.fromValues(filters),
        Order.fromValues("name", OrderTypes.ASC),
        10,
        1
      );

      // Act
      const result = await repository.testSearchByCriteria(criteria);

      // Assert
      expect(result).toEqual(expectedResults);
      expect(mockCollection.find).toHaveBeenCalledWith(
        { status: { $eq: "active" } },
        {}
      );
      expect(mockCollection.sort).toHaveBeenCalledWith({ name: 1 });
      expect(mockCollection.skip).toHaveBeenCalledWith(0);
      expect(mockCollection.limit).toHaveBeenCalledWith(10);
    });

    it('should search with field exclusion', async () => {
      // Arrange
      const mockResults = [
        { _id: 'objectId1', id: '1', name: 'John', status: 'active' },
        { _id: 'objectId2', id: '2', name: 'Jane', status: 'active' }
      ];

      const expectedResults = [
        { id: '1', name: 'John', status: 'active' },
        { id: '2', name: 'Jane', status: 'active' }
      ];

      mockCollection.toArray.mockResolvedValue(mockResults);

      const filters = [
        new Map([
          ["field", "status"],
          ["operator", Operator.EQUAL],
          ["value", "active"]
        ])
      ];

      const criteria = new Criteria(
        Filters.fromValues(filters),
        Order.fromValues("name", OrderTypes.ASC),
        10,
        1
      );

      const fieldsToExclude = ['email', 'createdAt'];

      // Act
      const result = await repository.testSearchByCriteria(criteria, fieldsToExclude);

      // Assert
      expect(result).toEqual(expectedResults);
      expect(mockCollection.find).toHaveBeenCalledWith(
        { status: { $eq: "active" } },
        { projection: { email: 0, createdAt: 0 } }
      );
      expect(mockCollection.sort).toHaveBeenCalledWith({ name: 1 });
      expect(mockCollection.skip).toHaveBeenCalledWith(0);
      expect(mockCollection.limit).toHaveBeenCalledWith(10);
    });

    it('should handle multiple filters with pagination', async () => {
      // Arrange
      const mockResults = [
        { _id: 'objectId3', id: '3', name: 'Bob', email: 'bob@test.com', status: 'active' }
      ];

      const expectedResults = [
        { id: '3', name: 'Bob', email: 'bob@test.com', status: 'active' }
      ];

      mockCollection.toArray.mockResolvedValue(mockResults);

      const filters = [
        new Map([
          ["field", "status"],
          ["operator", Operator.EQUAL],
          ["value", "active"]
        ]),
        new Map([
          ["field", "name"],
          ["operator", Operator.CONTAINS],
          ["value", "Bo"]
        ])
      ];

      const criteria = new Criteria(
        Filters.fromValues(filters),
        Order.fromValues("createdAt", OrderTypes.DESC),
        5,
        2 // Segunda página
      );

      // Act
      const result = await repository.testSearchByCriteria(criteria);

      // Assert
      expect(result).toEqual(expectedResults);
      expect(mockCollection.find).toHaveBeenCalledWith(
        { 
          status: { $eq: "active" },
          name: { $regex: "Bo" }
        },
        {}
      );
      expect(mockCollection.sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(mockCollection.skip).toHaveBeenCalledWith(5); // (page 2 - 1) * limit 5
      expect(mockCollection.limit).toHaveBeenCalledWith(5);
    });

    it('should return empty array when no results found', async () => {
      // Arrange
      mockCollection.toArray.mockResolvedValue([]);

      const filters = [
        new Map([
          ["field", "status"],
          ["operator", Operator.EQUAL],
          ["value", "nonexistent"]
        ])
      ];

      const criteria = new Criteria(
        Filters.fromValues(filters),
        Order.none(),
        10,
        1
      );

      // Act
      const result = await repository.testSearchByCriteria(criteria);

      // Assert
      expect(result).toEqual([]);
      expect(mockCollection.toArray).toHaveBeenCalled();
    });

    it('should remove _id field from results', async () => {
      // Arrange
      const mockResults = [
        { _id: 'shouldBeRemoved', id: '1', name: 'Test', data: 'value' }
      ];

      const expectedResults = [
        { id: '1', name: 'Test', data: 'value' }
      ];

      mockCollection.toArray.mockResolvedValue(mockResults);

      const criteria = new Criteria(
        Filters.fromValues([]),
        Order.none(),
        10,
        1
      );

      // Act
      const result = await repository.testSearchByCriteria(criteria);

      // Assert
      expect(result).toEqual(expectedResults);
      expect(result[0]).not.toHaveProperty('_id');
    });
  });
});