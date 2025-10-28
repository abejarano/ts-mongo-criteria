# 🔄 Migration Guide

## Table of Contents

- [Overview](#overview)
- [Migration Strategies](#migration-strategies)
- [From Raw MongoDB Queries](#from-raw-mongodb-queries)
- [From Mongoose Queries](#from-mongoose-queries)
- [From Other Query Builders](#from-other-query-builders)
- [Common Patterns](#common-patterns)
- [Step-by-Step Migration](#step-by-step-migration)
- [Testing Strategy](#testing-strategy)
- [Performance Validation](#performance-validation)
- [Rollback Plan](#rollback-plan)

## Overview

This guide helps you migrate existing query logic to the MongoDB Criteria pattern. The migration can be done incrementally, allowing you to transition gradually while maintaining existing functionality.

### Migration Benefits

- **Type Safety**: Eliminate runtime query errors with compile-time validation
- **Consistency**: Standardize query patterns across your application
- **Maintainability**: Centralize query logic and reduce code duplication
- **Testability**: Easily test query logic without database dependencies
- **Flexibility**: Build dynamic queries based on runtime conditions

## Migration Strategies

### 1. Incremental Migration (Recommended)

Migrate one query pattern at a time while keeping existing code functional:

```typescript
// Phase 1: Keep existing queries while adding Criteria alternatives
class UserService {
  // Existing method (keep during transition)
  async findActiveUsersOld(minAge: number): Promise<User[]> {
    return this.userRepository
      .find({
        status: "active",
        age: { $gte: minAge },
      })
      .sort({ createdAt: -1 })
      .limit(20)
  }

  // New method using Criteria pattern
  async findActiveUsers(minAge: number): Promise<User[]> {
    const criteria = new Criteria(
      Filters.fromValues([
        new Map([
          ["field", "status"],
          ["operator", Operator.EQUAL],
          ["value", "active"],
        ]),
        new Map([
          ["field", "age"],
          ["operator", Operator.GTE],
          ["value", minAge.toString()],
        ]),
      ]),
      Order.desc("createdAt"),
      20
    )

    return this.userRepository.searchByCriteria(criteria)
  }

  // Gradually replace calls to findActiveUsersOld with findActiveUsers
}
```

### 2. Wrapper Migration

Create wrappers that translate existing query objects to Criteria:

```typescript
class QueryMigrationWrapper {
  static mongoQueryToCriteria(
    mongoQuery: any,
    sort?: any,
    limit?: number,
    skip?: number
  ): Criteria {
    const filters: Array<Map<string, string | string[] | OrCondition[]>> = []

    // Convert MongoDB query to filters
    Object.entries(mongoQuery).forEach(([field, value]) => {
      if (typeof value === "string" || typeof value === "number") {
        filters.push(
          new Map([
            ["field", field],
            ["operator", Operator.EQUAL],
            ["value", value.toString()],
          ])
        )
      } else if (value && typeof value === "object") {
        this.convertComplexValue(field, value, filters)
      }
    })

    const order = sort ? this.convertSort(sort) : Order.none()
    const page = skip && limit ? Math.floor(skip / limit) + 1 : 1

    return new Criteria(Filters.fromValues(filters), order, limit || 0, page)
  }

  private static convertComplexValue(
    field: string,
    value: any,
    filters: Array<Map<string, string | string[] | OrCondition[]>>
  ): void {
    if (value.$eq !== undefined) {
      filters.push(
        new Map([
          ["field", field],
          ["operator", Operator.EQUAL],
          ["value", value.$eq.toString()],
        ])
      )
    }

    if (value.$ne !== undefined) {
      filters.push(
        new Map([
          ["field", field],
          ["operator", Operator.NOT_EQUAL],
          ["value", value.$ne.toString()],
        ])
      )
    }

    if (value.$gt !== undefined) {
      filters.push(
        new Map([
          ["field", field],
          ["operator", Operator.GT],
          ["value", value.$gt.toString()],
        ])
      )
    }

    if (value.$gte !== undefined) {
      filters.push(
        new Map([
          ["field", field],
          ["operator", Operator.GTE],
          ["value", value.$gte.toString()],
        ])
      )
    }

    if (value.$lt !== undefined) {
      filters.push(
        new Map([
          ["field", field],
          ["operator", Operator.LT],
          ["value", value.$lt.toString()],
        ])
      )
    }

    if (value.$lte !== undefined) {
      filters.push(
        new Map([
          ["field", field],
          ["operator", Operator.LTE],
          ["value", value.$lte.toString()],
        ])
      )
    }

    if (value.$regex !== undefined) {
      filters.push(
        new Map([
          ["field", field],
          ["operator", Operator.CONTAINS],
          ["value", value.$regex.toString().replace(/\/.*\/.*/, "")],
        ])
      )
    }

    if (value.$or && Array.isArray(value.$or)) {
      const orConditions: OrCondition[] = value.$or.map((condition: any) => {
        const [orField, orValue] = Object.entries(condition)[0]
        return {
          field: orField,
          operator: Operator.EQUAL,
          value: orValue.toString(),
        }
      })

      filters.push(
        new Map([
          ["field", "or_condition"],
          ["operator", Operator.OR],
          ["value", orConditions],
        ])
      )
    }
  }

  private static convertSort(sort: any): Order {
    const entries = Object.entries(sort)
    if (entries.length === 0) return Order.none()

    const [field, direction] = entries[0] as [string, number]
    return direction === 1 ? Order.asc(field) : Order.desc(field)
  }
}

// Usage in existing code
class LegacyUserService {
  async findUsers(
    query: any,
    sort?: any,
    limit?: number,
    skip?: number
  ): Promise<User[]> {
    // Convert legacy query to Criteria
    const criteria = QueryMigrationWrapper.mongoQueryToCriteria(
      query,
      sort,
      limit,
      skip
    )

    // Use new repository method
    return this.userRepository.searchByCriteria(criteria)
  }
}
```

### 3. Side-by-Side Migration

Run both old and new queries during migration to validate results:

```typescript
class ValidationMigrationService {
  private logger = console // Replace with your logging system

  async findUsersWithValidation(
    searchRequest: UserSearchRequest
  ): Promise<User[]> {
    // Execute both old and new queries
    const [oldResults, newResults] = await Promise.all([
      this.findUsersOldWay(searchRequest),
      this.findUsersNewWay(searchRequest),
    ])

    // Validate results match
    this.validateResults(oldResults, newResults, searchRequest)

    // Return new results (or old results during validation phase)
    return newResults
  }

  private async findUsersOldWay(request: UserSearchRequest): Promise<User[]> {
    const query: any = {}

    if (request.status) query.status = request.status
    if (request.minAge) query.age = { $gte: request.minAge }
    if (request.searchTerm) {
      query.$or = [
        { name: { $regex: request.searchTerm, $options: "i" } },
        { email: { $regex: request.searchTerm, $options: "i" } },
      ]
    }

    return this.userRepository
      .find(query)
      .sort({ createdAt: -1 })
      .limit(request.limit || 20)
      .skip(((request.page || 1) - 1) * (request.limit || 20))
  }

  private async findUsersNewWay(request: UserSearchRequest): Promise<User[]> {
    const filters: Array<Map<string, string | string[] | OrCondition[]>> = []

    if (request.status) {
      filters.push(
        new Map([
          ["field", "status"],
          ["operator", Operator.EQUAL],
          ["value", request.status],
        ])
      )
    }

    if (request.minAge) {
      filters.push(
        new Map([
          ["field", "age"],
          ["operator", Operator.GTE],
          ["value", request.minAge.toString()],
        ])
      )
    }

    if (request.searchTerm) {
      const searchConditions: OrCondition[] = [
        {
          field: "name",
          operator: Operator.CONTAINS,
          value: request.searchTerm,
        },
        {
          field: "email",
          operator: Operator.CONTAINS,
          value: request.searchTerm,
        },
      ]

      filters.push(
        new Map([
          ["field", "search"],
          ["operator", Operator.OR],
          ["value", searchConditions],
        ])
      )
    }

    const criteria = new Criteria(
      Filters.fromValues(filters),
      Order.desc("createdAt"),
      request.limit || 20,
      request.page || 1
    )

    return this.userRepository.searchByCriteria(criteria)
  }

  private validateResults(
    oldResults: User[],
    newResults: User[],
    request: UserSearchRequest
  ): void {
    if (oldResults.length !== newResults.length) {
      this.logger.warn("Migration validation: Result count mismatch", {
        old: oldResults.length,
        new: newResults.length,
        request,
      })
    }

    // Compare first few results to ensure ordering is correct
    const compareCount = Math.min(5, oldResults.length, newResults.length)
    for (let i = 0; i < compareCount; i++) {
      if (oldResults[i].id !== newResults[i].id) {
        this.logger.warn("Migration validation: Result ordering mismatch", {
          position: i,
          oldId: oldResults[i].id,
          newId: newResults[i].id,
          request,
        })
        break
      }
    }
  }
}
```

## From Raw MongoDB Queries

### Basic Find Operations

```typescript
// Before: Raw MongoDB queries
const oldUserService = {
  async findActiveUsers(): Promise<User[]> {
    return db.collection("users").find({ status: "active" }).toArray()
  },

  async findUsersByAge(minAge: number, maxAge: number): Promise<User[]> {
    return db
      .collection("users")
      .find({
        age: { $gte: minAge, $lte: maxAge },
      })
      .toArray()
  },

  async searchUsers(term: string): Promise<User[]> {
    return db
      .collection("users")
      .find({
        $or: [
          { name: { $regex: term, $options: "i" } },
          { email: { $regex: term, $options: "i" } },
        ],
      })
      .toArray()
  },
}

// After: Using Criteria pattern
class UserService {
  constructor(private userRepository: MongoRepository<User>) {}

  async findActiveUsers(): Promise<User[]> {
    const criteria = new Criteria(
      Filters.fromValues([
        new Map([
          ["field", "status"],
          ["operator", Operator.EQUAL],
          ["value", "active"],
        ]),
      ]),
      Order.none()
    )

    return this.userRepository.searchByCriteria(criteria)
  }

  async findUsersByAge(minAge: number, maxAge: number): Promise<User[]> {
    const criteria = new Criteria(
      Filters.fromValues([
        new Map([
          ["field", "age"],
          ["operator", Operator.GTE],
          ["value", minAge.toString()],
        ]),
        new Map([
          ["field", "age"],
          ["operator", Operator.LTE],
          ["value", maxAge.toString()],
        ]),
      ]),
      Order.none()
    )

    return this.userRepository.searchByCriteria(criteria)
  }

  async searchUsers(term: string): Promise<User[]> {
    const searchConditions: OrCondition[] = [
      { field: "name", operator: Operator.CONTAINS, value: term },
      { field: "email", operator: Operator.CONTAINS, value: term },
    ]

    const criteria = new Criteria(
      Filters.fromValues([
        new Map([
          ["field", "search"],
          ["operator", Operator.OR],
          ["value", searchConditions],
        ]),
      ]),
      Order.none()
    )

    return this.userRepository.searchByCriteria(criteria)
  }
}
```

### Complex Aggregation Queries

```typescript
// Before: Complex aggregation
const oldProductService = {
  async findPopularProducts(
    category: string,
    minRating: number
  ): Promise<Product[]> {
    return db
      .collection("products")
      .aggregate([
        { $match: { category, rating: { $gte: minRating }, status: "active" } },
        { $sort: { popularity: -1, createdAt: -1 } },
        { $limit: 20 },
      ])
      .toArray()
  },
}

// After: Using Criteria with custom repository method
class ProductService {
  constructor(private productRepository: ProductRepository) {}

  async findPopularProducts(
    category: string,
    minRating: number
  ): Promise<Product[]> {
    const criteria = new Criteria(
      Filters.fromValues([
        new Map([
          ["field", "category"],
          ["operator", Operator.EQUAL],
          ["value", category],
        ]),
        new Map([
          ["field", "rating"],
          ["operator", Operator.GTE],
          ["value", minRating.toString()],
        ]),
        new Map([
          ["field", "status"],
          ["operator", Operator.EQUAL],
          ["value", "active"],
        ]),
      ]),
      Order.desc("popularity").then(Order.desc("createdAt")), // Custom compound ordering
      20
    )

    return this.productRepository.searchByCriteria(criteria)
  }
}

// Extended repository for compound sorting
class ProductRepository extends MongoRepository<Product> {
  protected async searchByCriteria(criteria: Criteria): Promise<Product[]> {
    const converter = new MongoCriteriaConverter()
    const mongoQuery = converter.convert(criteria)

    const collection = await this.getCollection()

    // Custom sort for popularity + createdAt
    const sort = { popularity: -1, createdAt: -1 }

    const documents = await collection
      .find(mongoQuery.filter)
      .sort(sort)
      .limit(mongoQuery.limit)
      .skip(mongoQuery.skip)
      .toArray()

    return documents.map((doc) => this.mapDocumentToEntity(doc))
  }
}
```

## From Mongoose Queries

### Basic Mongoose to Criteria

```typescript
// Before: Mongoose queries
const oldUserModel = {
  async findActiveUsers(): Promise<User[]> {
    return UserModel.find({ status: "active" })
      .sort({ createdAt: -1 })
      .limit(20)
      .exec()
  },

  async findUsersPaginated(page: number, limit: number): Promise<User[]> {
    const skip = (page - 1) * limit
    return UserModel.find({ status: "active" })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec()
  },

  async searchUsersByName(name: string): Promise<User[]> {
    return UserModel.find({
      status: "active",
      name: { $regex: name, $options: "i" },
    })
      .sort({ name: 1 })
      .exec()
  },
}

// After: Criteria pattern
class UserService {
  constructor(private userRepository: MongoRepository<User>) {}

  async findActiveUsers(): Promise<User[]> {
    const criteria = new Criteria(
      Filters.fromValues([
        new Map([
          ["field", "status"],
          ["operator", Operator.EQUAL],
          ["value", "active"],
        ]),
      ]),
      Order.desc("createdAt"),
      20
    )

    return this.userRepository.searchByCriteria(criteria)
  }

  async findUsersPaginated(page: number, limit: number): Promise<User[]> {
    const criteria = new Criteria(
      Filters.fromValues([
        new Map([
          ["field", "status"],
          ["operator", Operator.EQUAL],
          ["value", "active"],
        ]),
      ]),
      Order.desc("createdAt"),
      limit,
      page
    )

    return this.userRepository.searchByCriteria(criteria)
  }

  async searchUsersByName(name: string): Promise<User[]> {
    const criteria = new Criteria(
      Filters.fromValues([
        new Map([
          ["field", "status"],
          ["operator", Operator.EQUAL],
          ["value", "active"],
        ]),
        new Map([
          ["field", "name"],
          ["operator", Operator.CONTAINS],
          ["value", name],
        ]),
      ]),
      Order.asc("name")
    )

    return this.userRepository.searchByCriteria(criteria)
  }
}
```

### Mongoose Population to Separate Queries

```typescript
// Before: Mongoose population
const oldOrderService = {
  async findOrdersWithUser(userId: string): Promise<any[]> {
    return OrderModel.find({ userId })
      .populate("user")
      .populate("products")
      .sort({ createdAt: -1 })
      .exec()
  },
}

// After: Separate queries with proper aggregation
class OrderService {
  constructor(
    private orderRepository: MongoRepository<Order>,
    private userRepository: MongoRepository<User>,
    private productRepository: MongoRepository<Product>
  ) {}

  async findOrdersWithUser(userId: string): Promise<OrderWithRelations[]> {
    // Find orders
    const orderCriteria = new Criteria(
      Filters.fromValues([
        new Map([
          ["field", "userId"],
          ["operator", Operator.EQUAL],
          ["value", userId],
        ]),
      ]),
      Order.desc("createdAt")
    )

    const orders = await this.orderRepository.searchByCriteria(orderCriteria)

    // Get related data
    const [user, products] = await Promise.all([
      this.getUserById(userId),
      this.getProductsByOrders(orders),
    ])

    // Combine results
    return orders.map((order) => ({
      ...order,
      user,
      products: products.filter((p) => order.productIds.includes(p.id)),
    }))
  }

  private async getUserById(userId: string): Promise<User> {
    const criteria = new Criteria(
      Filters.fromValues([
        new Map([
          ["field", "id"],
          ["operator", Operator.EQUAL],
          ["value", userId],
        ]),
      ]),
      Order.none()
    )

    const users = await this.userRepository.searchByCriteria(criteria)
    return users[0]
  }

  private async getProductsByOrders(orders: Order[]): Promise<Product[]> {
    const allProductIds = Array.from(
      new Set(orders.flatMap((order) => order.productIds))
    )

    if (allProductIds.length === 0) return []

    const productConditions: OrCondition[] = allProductIds.map((id) => ({
      field: "id",
      operator: Operator.EQUAL,
      value: id,
    }))

    const criteria = new Criteria(
      Filters.fromValues([
        new Map([
          ["field", "product_ids"],
          ["operator", Operator.OR],
          ["value", productConditions],
        ]),
      ]),
      Order.none()
    )

    return this.productRepository.searchByCriteria(criteria)
  }
}
```

## From Other Query Builders

### From SQL-style Builders

```typescript
// Before: SQL-style query builder
const oldQueryBuilder = {
  findUsers(filters: any): Promise<User[]> {
    let query = this.queryBuilder
      .select("*")
      .from("users")
      .where("status", "=", "active")

    if (filters.minAge) {
      query = query.where("age", ">=", filters.minAge)
    }

    if (filters.maxAge) {
      query = query.where("age", "<=", filters.maxAge)
    }

    if (filters.searchTerm) {
      query = query.where(function () {
        this.where("name", "like", `%${filters.searchTerm}%`).orWhere(
          "email",
          "like",
          `%${filters.searchTerm}%`
        )
      })
    }

    return query.orderBy("createdAt", "desc").limit(20)
  },
}

// After: Criteria pattern
class UserQueryService {
  constructor(private userRepository: MongoRepository<User>) {}

  async findUsers(filters: UserFilters): Promise<User[]> {
    const criteriaFilters: Array<
      Map<string, string | string[] | OrCondition[]>
    > = [
      new Map([
        ["field", "status"],
        ["operator", Operator.EQUAL],
        ["value", "active"],
      ]),
    ]

    if (filters.minAge) {
      criteriaFilters.push(
        new Map([
          ["field", "age"],
          ["operator", Operator.GTE],
          ["value", filters.minAge.toString()],
        ])
      )
    }

    if (filters.maxAge) {
      criteriaFilters.push(
        new Map([
          ["field", "age"],
          ["operator", Operator.LTE],
          ["value", filters.maxAge.toString()],
        ])
      )
    }

    if (filters.searchTerm) {
      const searchConditions: OrCondition[] = [
        {
          field: "name",
          operator: Operator.CONTAINS,
          value: filters.searchTerm,
        },
        {
          field: "email",
          operator: Operator.CONTAINS,
          value: filters.searchTerm,
        },
      ]

      criteriaFilters.push(
        new Map([
          ["field", "search"],
          ["operator", Operator.OR],
          ["value", searchConditions],
        ])
      )
    }

    const criteria = new Criteria(
      Filters.fromValues(criteriaFilters),
      Order.desc("createdAt"),
      20
    )

    return this.userRepository.searchByCriteria(criteria)
  }
}
```

## Common Patterns

### Dynamic Query Building

```typescript
// Before: Dynamic query building
const oldDynamicQuery = {
  buildUserQuery(request: UserSearchRequest): any {
    const query: any = { status: "active" }

    if (request.role) query.role = request.role
    if (request.department) query.department = request.department
    if (request.minSalary) query.salary = { $gte: request.minSalary }
    if (request.maxSalary) {
      query.salary = query.salary || {}
      query.salary.$lte = request.maxSalary
    }

    return query
  },
}

// After: Dynamic Criteria building
class DynamicCriteriaBuilder {
  static buildUserCriteria(request: UserSearchRequest): Criteria {
    const filters: Array<Map<string, string | string[] | OrCondition[]>> = [
      new Map([
        ["field", "status"],
        ["operator", Operator.EQUAL],
        ["value", "active"],
      ]),
    ]

    // Dynamically add filters based on request
    this.addOptionalFilter(filters, "role", request.role, Operator.EQUAL)
    this.addOptionalFilter(
      filters,
      "department",
      request.department,
      Operator.EQUAL
    )
    this.addOptionalFilter(
      filters,
      "salary",
      request.minSalary?.toString(),
      Operator.GTE
    )
    this.addOptionalFilter(
      filters,
      "salary",
      request.maxSalary?.toString(),
      Operator.LTE
    )

    return new Criteria(
      Filters.fromValues(filters),
      Order.desc("createdAt"),
      request.limit || 20,
      request.page || 1
    )
  }

  private static addOptionalFilter(
    filters: Array<Map<string, string>>,
    field: string,
    value: string | undefined,
    operator: Operator
  ): void {
    if (value) {
      filters.push(
        new Map([
          ["field", field],
          ["operator", operator],
          ["value", value],
        ])
      )
    }
  }
}
```

### Search and Filter Combinations

```typescript
// Before: Complex search logic
const oldSearchService = {
  async searchProducts(request: ProductSearchRequest): Promise<Product[]> {
    const pipeline: any[] = []

    // Match stage
    const matchStage: any = { status: "active" }

    if (request.category) matchStage.category = request.category
    if (request.brand) matchStage.brand = request.brand
    if (request.minPrice) matchStage.price = { $gte: request.minPrice }
    if (request.maxPrice) {
      matchStage.price = matchStage.price || {}
      matchStage.price.$lte = request.maxPrice
    }

    if (request.searchTerm) {
      matchStage.$or = [
        { name: { $regex: request.searchTerm, $options: "i" } },
        { description: { $regex: request.searchTerm, $options: "i" } },
        { tags: { $in: [request.searchTerm] } },
      ]
    }

    pipeline.push({ $match: matchStage })

    // Sort stage
    if (request.sortBy === "price") {
      pipeline.push({ $sort: { price: request.sortOrder === "desc" ? -1 : 1 } })
    } else {
      pipeline.push({ $sort: { popularity: -1, createdAt: -1 } })
    }

    // Pagination
    if (request.page && request.limit) {
      pipeline.push({ $skip: (request.page - 1) * request.limit })
      pipeline.push({ $limit: request.limit })
    }

    return db.collection("products").aggregate(pipeline).toArray()
  },
}

// After: Clean Criteria-based search
class ProductSearchService {
  constructor(private productRepository: MongoRepository<Product>) {}

  async searchProducts(request: ProductSearchRequest): Promise<Product[]> {
    const criteria = this.buildSearchCriteria(request)
    return this.productRepository.searchByCriteria(criteria)
  }

  private buildSearchCriteria(request: ProductSearchRequest): Criteria {
    const filters: Array<Map<string, string | string[] | OrCondition[]>> = [
      new Map([
        ["field", "status"],
        ["operator", Operator.EQUAL],
        ["value", "active"],
      ]),
    ]

    // Category and brand filters
    this.addExactFilter(filters, "category", request.category)
    this.addExactFilter(filters, "brand", request.brand)

    // Price range filters
    this.addRangeFilter(filters, "price", request.minPrice, request.maxPrice)

    // Search term across multiple fields
    this.addSearchFilter(filters, request.searchTerm)

    // Build sort order
    const order = this.buildSortOrder(request.sortBy, request.sortOrder)

    return new Criteria(
      Filters.fromValues(filters),
      order,
      request.limit || 20,
      request.page || 1
    )
  }

  private addExactFilter(
    filters: Array<Map<string, string>>,
    field: string,
    value: string | undefined
  ): void {
    if (value) {
      filters.push(
        new Map([
          ["field", field],
          ["operator", Operator.EQUAL],
          ["value", value],
        ])
      )
    }
  }

  private addRangeFilter(
    filters: Array<Map<string, string>>,
    field: string,
    min?: number,
    max?: number
  ): void {
    if (min !== undefined) {
      filters.push(
        new Map([
          ["field", field],
          ["operator", Operator.GTE],
          ["value", min.toString()],
        ])
      )
    }

    if (max !== undefined) {
      filters.push(
        new Map([
          ["field", field],
          ["operator", Operator.LTE],
          ["value", max.toString()],
        ])
      )
    }
  }

  private addSearchFilter(
    filters: Array<Map<string, string | string[] | OrCondition[]>>,
    searchTerm: string | undefined
  ): void {
    if (searchTerm) {
      const searchConditions: OrCondition[] = [
        { field: "name", operator: Operator.CONTAINS, value: searchTerm },
        {
          field: "description",
          operator: Operator.CONTAINS,
          value: searchTerm,
        },
        { field: "tags", operator: Operator.CONTAINS, value: searchTerm },
      ]

      filters.push(
        new Map([
          ["field", "search"],
          ["operator", Operator.OR],
          ["value", searchConditions],
        ])
      )
    }
  }

  private buildSortOrder(sortBy?: string, sortOrder?: string): Order {
    if (sortBy === "price") {
      return sortOrder === "desc" ? Order.desc("price") : Order.asc("price")
    }

    // Default: popularity desc, then createdAt desc
    return Order.desc("popularity")
  }
}
```

## Step-by-Step Migration

### Phase 1: Setup (Week 1)

1. **Install and Configure**

   ```bash
   npm install ts-mongodb-criteria
   ```

2. **Create Base Repository**

   ```typescript
   // Create your base repository extending MongoRepository
   class BaseRepository<T extends AggregateRoot> extends MongoRepository<T> {
     // Add any custom logic here
   }
   ```

3. **Choose Migration Target**
   ```typescript
   // Start with the most frequently used query pattern
   // Usually user authentication or content listing
   ```

### Phase 2: Simple Queries (Week 2)

1. **Migrate Basic Find Operations**

   ```typescript
   // Replace simple equality filters first
   // These are safest and easiest to verify
   ```

2. **Add Unit Tests**
   ```typescript
   // Test criteria building logic
   describe("UserCriteria", () => {
     it("should build active user criteria", () => {
       const criteria = UserCriteriaBuilder.activeUsers()
       expect(criteria.filters.filters).toHaveLength(1)
       expect(criteria.filters.filters[0].field.value).toBe("status")
     })
   })
   ```

### Phase 3: Complex Queries (Week 3-4)

1. **Migrate Range and Search Queries**

   ```typescript
   // Add support for GTE, LTE, CONTAINS operations
   // Include OR conditions for search functionality
   ```

2. **Performance Testing**
   ```typescript
   // Compare query performance with previous implementation
   // Ensure indexes are properly utilized
   ```

### Phase 4: Advanced Features (Week 5-6)

1. **Dynamic Query Building**

   ```typescript
   // Migrate conditional query logic
   // Add support for complex filtering scenarios
   ```

2. **Pagination and Sorting**
   ```typescript
   // Implement consistent pagination patterns
   // Add compound sorting support
   ```

### Phase 5: Cleanup (Week 7)

1. **Remove Old Code**

   ```typescript
   // Remove deprecated query methods
   // Update all call sites to use new pattern
   ```

2. **Documentation Update**
   ```typescript
   // Update API documentation
   // Add migration notes for team members
   ```

## Testing Strategy

### Unit Testing Criteria Building

```typescript
describe("CriteriaMigration", () => {
  describe("UserCriteriaBuilder", () => {
    it("should build equivalent criteria for old query", () => {
      // Old query
      const oldQuery = { status: "active", age: { $gte: 18 } }

      // New criteria
      const criteria = UserCriteriaBuilder.activeAdults()

      // Convert criteria to MongoDB query for comparison
      const converter = new MongoCriteriaConverter()
      const mongoQuery = converter.convert(criteria)

      expect(mongoQuery.filter).toEqual(oldQuery)
    })

    it("should handle OR conditions correctly", () => {
      const searchTerm = "john"
      const criteria = UserCriteriaBuilder.searchUsers(searchTerm)

      const converter = new MongoCriteriaConverter()
      const mongoQuery = converter.convert(criteria)

      expect(mongoQuery.filter.$or).toBeDefined()
      expect(mongoQuery.filter.$or).toHaveLength(2)
    })
  })
})
```

### Integration Testing

```typescript
describe("MigrationIntegration", () => {
  it("should return same results as old implementation", async () => {
    const searchRequest = {
      status: "active",
      minAge: 25,
      searchTerm: "developer",
    }

    // Execute both implementations
    const oldResults = await oldUserService.searchUsers(searchRequest)
    const newResults = await newUserService.searchUsers(searchRequest)

    // Compare results
    expect(newResults).toHaveLength(oldResults.length)
    expect(newResults.map((u) => u.id).sort()).toEqual(
      oldResults.map((u) => u.id).sort()
    )
  })
})
```

## Performance Validation

### Query Performance Comparison

```typescript
class MigrationPerformanceValidator {
  async validateQueryPerformance(
    oldQuery: () => Promise<any[]>,
    newQuery: () => Promise<any[]>,
    testName: string
  ): Promise<void> {
    const iterations = 10
    const oldTimes: number[] = []
    const newTimes: number[] = []

    // Warm up
    await oldQuery()
    await newQuery()

    // Test old implementation
    for (let i = 0; i < iterations; i++) {
      const start = Date.now()
      await oldQuery()
      oldTimes.push(Date.now() - start)
    }

    // Test new implementation
    for (let i = 0; i < iterations; i++) {
      const start = Date.now()
      await newQuery()
      newTimes.push(Date.now() - start)
    }

    // Calculate averages
    const oldAvg = oldTimes.reduce((a, b) => a + b, 0) / iterations
    const newAvg = newTimes.reduce((a, b) => a + b, 0) / iterations

    console.log(`${testName} Performance Comparison:`)
    console.log(`Old implementation: ${oldAvg.toFixed(2)}ms`)
    console.log(`New implementation: ${newAvg.toFixed(2)}ms`)
    console.log(
      `Performance change: ${(((newAvg - oldAvg) / oldAvg) * 100).toFixed(1)}%`
    )

    // Alert if new implementation is significantly slower
    if (newAvg > oldAvg * 1.2) {
      console.warn(`Warning: New implementation is 20% slower for ${testName}`)
    }
  }
}

// Usage
const validator = new MigrationPerformanceValidator()
await validator.validateQueryPerformance(
  () => oldUserService.findActiveUsers(),
  () => newUserService.findActiveUsers(),
  "Find Active Users"
)
```

## Rollback Plan

### Feature Flag Implementation

```typescript
class FeatureFlaggedService {
  constructor(
    private oldService: OldUserService,
    private newService: NewUserService,
    private featureFlags: FeatureFlagService
  ) {}

  async findUsers(request: UserSearchRequest): Promise<User[]> {
    const useCriteriaPattern = await this.featureFlags.isEnabled(
      "criteria-pattern-migration",
      request.userId
    )

    if (useCriteriaPattern) {
      try {
        return await this.newService.findUsers(request)
      } catch (error) {
        // Log error and fallback to old implementation
        console.error("Criteria pattern error, falling back:", error)
        return await this.oldService.findUsers(request)
      }
    }

    return await this.oldService.findUsers(request)
  }
}
```

### Database State Validation

```typescript
class MigrationStateValidator {
  async validateDatabaseState(): Promise<boolean> {
    try {
      // Test critical queries with both implementations
      const testCases = [
        { method: "findActiveUsers", params: [] },
        { method: "searchUsers", params: ["test"] },
        { method: "findUsersByAge", params: [25, 65] },
      ]

      for (const testCase of testCases) {
        const oldResult = await this.oldService[testCase.method](
          ...testCase.params
        )
        const newResult = await this.newService[testCase.method](
          ...testCase.params
        )

        if (!this.arraysEqual(oldResult, newResult)) {
          console.error(`Validation failed for ${testCase.method}`)
          return false
        }
      }

      return true
    } catch (error) {
      console.error("Migration validation failed:", error)
      return false
    }
  }

  private arraysEqual(a: any[], b: any[]): boolean {
    return (
      a.length === b.length && a.every((val, index) => val.id === b[index].id)
    )
  }
}
```

By following this migration guide, you can safely and systematically transition from your existing query patterns to the MongoDB Criteria pattern, ensuring improved type safety, maintainability, and consistency across your application.
