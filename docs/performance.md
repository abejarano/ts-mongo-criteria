# ⚡ Performance Optimization Guide

## Table of Contents

- [Overview](#overview)
- [MongoDB Index Strategy](#mongodb-index-strategy)
- [Query Optimization](#query-optimization)
- [Criteria Design Patterns](#criteria-design-patterns)
- [Monitoring and Profiling](#monitoring-and-profiling)
- [Common Performance Issues](#common-performance-issues)
- [Best Practices](#best-practices)
- [Real-world Optimizations](#real-world-optimizations)

## Overview

Performance optimization with the Criteria pattern involves understanding both MongoDB query mechanics and how the library generates queries. This guide provides practical strategies to ensure your criteria-based queries perform optimally.

### Performance Principles

1. **Index-First Design**: Design queries that leverage MongoDB indexes effectively
2. **Selectivity Ordering**: Place most selective filters first
3. **Query Shape Consistency**: Maintain consistent query patterns for better caching
4. **Minimal Data Transfer**: Only fetch and project necessary fields
5. **Proper Pagination**: Always use limits for large datasets

## MongoDB Index Strategy

### Basic Index Types

#### Single Field Indexes

```javascript
// MongoDB shell commands
// For EQUAL/NOT_EQUAL operations
db.users.createIndex({ status: 1 })
db.users.createIndex({ userId: 1 })
db.users.createIndex({ email: 1 })

// For range operations (GT, GTE, LT, LTE)
db.products.createIndex({ price: 1 })
db.users.createIndex({ age: 1 })
db.orders.createIndex({ createdAt: 1 })
```

#### Compound Indexes

The order of fields in compound indexes matters greatly:

```javascript
// For queries with multiple equality filters + sorting
db.users.createIndex({
  status: 1, // Equality filter (most selective first)
  category: 1, // Equality filter
  createdAt: -1, // Sort field last
})

// For range queries
db.products.createIndex({
  category: 1, // Equality filter first
  price: 1, // Range filter
  rating: -1, // Sort field
})

// For user search patterns
db.users.createIndex({
  status: 1, // Most selective
  age: 1, // Range filter
  lastLogin: -1, // Sort/range field
})
```

#### Text Indexes

For CONTAINS/NOT_CONTAINS operations:

```javascript
// Simple text index
db.products.createIndex({
  name: "text",
  description: "text",
})

// Weighted text index (prioritize certain fields)
db.products.createIndex(
  {
    name: "text",
    description: "text",
    brand: "text",
  },
  {
    weights: {
      name: 10, // Higher weight for name matches
      brand: 5, // Medium weight for brand
      description: 1, // Lower weight for description
    },
  }
)

// Compound text index
db.products.createIndex({
  category: 1, // Can filter by category first
  name: "text", // Then text search
  description: "text",
})
```

### Index Strategy for Common Criteria Patterns

#### User Management Patterns

```javascript
// For active user lookups
db.users.createIndex({ status: 1, createdAt: -1 })

// For user search functionality
db.users.createIndex({
  status: 1,
  name: "text",
  email: "text",
})

// For age-based filtering
db.users.createIndex({ status: 1, age: 1, createdAt: -1 })

// For user activity analysis
db.users.createIndex({
  status: 1,
  lastLogin: -1,
  totalSpent: -1,
})
```

#### E-commerce Patterns

```javascript
// Product catalog browsing
db.products.createIndex({
  category: 1,
  status: 1,
  price: 1,
})

// Product search
db.products.createIndex({
  status: 1,
  category: 1,
  name: "text",
  description: "text",
})

// Popular products
db.products.createIndex({
  status: 1,
  category: 1,
  popularity: -1,
})

// Price-based filtering
db.products.createIndex({
  category: 1,
  status: 1,
  price: 1,
  rating: -1,
})
```

#### Order Management Patterns

```javascript
// Order status tracking
db.orders.createIndex({
  userId: 1,
  status: 1,
  createdAt: -1,
})

// Order value analysis
db.orders.createIndex({
  status: 1,
  totalAmount: -1,
  createdAt: -1,
})

// Recent orders
db.orders.createIndex({
  userId: 1,
  createdAt: -1,
})
```

## Query Optimization

### Filter Ordering Strategy

The order of filters in your criteria significantly impacts performance:

```typescript
// ✅ Optimal filter ordering
class OptimizedCriteriaBuilder {
  static userSearch(request: UserSearchRequest): Criteria {
    const filters: Array<Map<string, string | string[] | OrCondition[]>> = []

    // 1. Most selective filters first (exact matches)
    if (request.userId) {
      filters.push(
        new Map([
          ["field", "userId"],
          ["operator", Operator.EQUAL],
          ["value", request.userId],
        ])
      )
    }

    // 2. High selectivity filters (status, category)
    if (request.status) {
      filters.push(
        new Map([
          ["field", "status"],
          ["operator", Operator.EQUAL],
          ["value", request.status],
        ])
      )
    }

    if (request.role) {
      filters.push(
        new Map([
          ["field", "role"],
          ["operator", Operator.EQUAL],
          ["value", request.role],
        ])
      )
    }

    // 3. Range filters (medium selectivity)
    if (request.minAge) {
      filters.push(
        new Map([
          ["field", "age"],
          ["operator", Operator.GTE],
          ["value", request.minAge.toString()],
        ])
      )
    }

    if (request.maxAge) {
      filters.push(
        new Map([
          ["field", "age"],
          ["operator", Operator.LTE],
          ["value", request.maxAge.toString()],
        ])
      )
    }

    // 4. Date range filters
    if (request.createdAfter) {
      filters.push(
        new Map([
          ["field", "createdAt"],
          ["operator", Operator.GTE],
          ["value", request.createdAfter.toISOString()],
        ])
      )
    }

    // 5. Text search filters last (lowest selectivity)
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

    return new Criteria(
      Filters.fromValues(filters),
      Order.desc("createdAt"),
      request.limit || 20,
      request.page || 1
    )
  }
}

// ❌ Poor filter ordering
class UnoptimizedCriteriaBuilder {
  static userSearch(request: UserSearchRequest): Criteria {
    const filters: Array<Map<string, string | string[] | OrCondition[]>> = []

    // ❌ Text search first (expensive full scan)
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

    // ❌ Specific filters after expensive operations
    if (request.userId) {
      filters.push(
        new Map([
          ["field", "userId"],
          ["operator", Operator.EQUAL],
          ["value", request.userId],
        ])
      )
    }

    return new Criteria(Filters.fromValues(filters), Order.none())
  }
}
```

### Limit OR Conditions

```typescript
// ✅ Optimal OR usage (3-5 conditions)
const searchConditions: OrCondition[] = [
  { field: "name", operator: Operator.CONTAINS, value: "term" },
  { field: "email", operator: Operator.CONTAINS, value: "term" },
  { field: "phone", operator: Operator.CONTAINS, value: "term" },
]

// ❌ Too many OR conditions (10+ conditions)
const tooManyConditions: OrCondition[] = [
  // ... 15 different field searches
  // This can cause significant performance degradation
]

// ✅ Better approach for many fields: Use text index
// Instead of OR across many fields, create a composite search field
db.users.createIndex({
  searchText: "text", // Combine name, email, phone, etc. into searchText field
})
```

### Pagination Optimization

```typescript
// ✅ Efficient pagination with consistent sorting
class PaginationOptimizer {
  static buildCriteria(page: number, limit: number): Criteria {
    // Always include a consistent sort field (preferably indexed)
    return new Criteria(
      Filters.fromValues([
        new Map([
          ["field", "status"],
          ["operator", Operator.EQUAL],
          ["value", "active"],
        ]),
      ]),
      Order.desc("createdAt"), // Indexed field for consistent pagination
      Math.min(limit, 100), // Cap maximum page size
      Math.max(page, 1) // Ensure page >= 1
    )
  }

  // For large datasets, consider cursor-based pagination
  static buildCursorCriteria(
    lastCreatedAt?: string,
    limit: number = 20
  ): Criteria {
    const filters: Array<Map<string, string>> = [
      new Map([
        ["field", "status"],
        ["operator", Operator.EQUAL],
        ["value", "active"],
      ]),
    ]

    if (lastCreatedAt) {
      filters.push(
        new Map([
          ["field", "createdAt"],
          ["operator", Operator.LT],
          ["value", lastCreatedAt],
        ])
      )
    }

    return new Criteria(
      Filters.fromValues(filters),
      Order.desc("createdAt"),
      limit
    )
  }
}

// ❌ Inefficient deep pagination
const deepPageCriteria = new Criteria(
  Filters.none(),
  Order.desc("createdAt"),
  20,
  1000 // Page 1000 = skip 19,980 documents (very expensive)
)
```

## Criteria Design Patterns

### 1. Cached Criteria Pattern

```typescript
class CachedCriteriaBuilder {
  private static criteriaCache = new Map<string, Criteria>()

  static getCachedCriteria(key: string, builder: () => Criteria): Criteria {
    if (!this.criteriaCache.has(key)) {
      this.criteriaCache.set(key, builder())
    }
    return this.criteriaCache.get(key)!
  }

  static activeUsers(): Criteria {
    return this.getCachedCriteria(
      "activeUsers",
      () =>
        new Criteria(
          Filters.fromValues([
            new Map([
              ["field", "status"],
              ["operator", Operator.EQUAL],
              ["value", "active"],
            ]),
          ]),
          Order.desc("createdAt")
        )
    )
  }

  static premiumUsers(): Criteria {
    return this.getCachedCriteria(
      "premiumUsers",
      () =>
        new Criteria(
          Filters.fromValues([
            new Map([
              ["field", "status"],
              ["operator", Operator.EQUAL],
              ["value", "active"],
            ]),
            new Map([
              ["field", "plan"],
              ["operator", Operator.EQUAL],
              ["value", "premium"],
            ]),
          ]),
          Order.desc("upgradeDate")
        )
    )
  }
}
```

### 2. Conditional Filter Pattern

```typescript
class ConditionalFilterBuilder {
  static buildProductCriteria(filters: ProductFilters): Criteria {
    const criteriaFilters: Array<
      Map<string, string | string[] | OrCondition[]>
    > = []

    // Always include base filters
    criteriaFilters.push(
      new Map([
        ["field", "status"],
        ["operator", Operator.EQUAL],
        ["value", "active"],
      ])
    )

    // Add conditional filters efficiently
    this.addConditionalFilter(
      criteriaFilters,
      "category",
      filters.category,
      Operator.EQUAL
    )
    this.addConditionalFilter(
      criteriaFilters,
      "brand",
      filters.brand,
      Operator.EQUAL
    )
    this.addRangeFilters(
      criteriaFilters,
      "price",
      filters.minPrice,
      filters.maxPrice
    )

    // Add text search last
    if (filters.searchTerm) {
      this.addTextSearch(criteriaFilters, filters.searchTerm)
    }

    return new Criteria(
      Filters.fromValues(criteriaFilters),
      Order.desc("popularity"),
      filters.limit || 20,
      filters.page || 1
    )
  }

  private static addConditionalFilter(
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

  private static addRangeFilters(
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

  private static addTextSearch(
    filters: Array<Map<string, string | string[] | OrCondition[]>>,
    searchTerm: string
  ): void {
    const searchConditions: OrCondition[] = [
      { field: "name", operator: Operator.CONTAINS, value: searchTerm },
      { field: "description", operator: Operator.CONTAINS, value: searchTerm },
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
```

### 3. Query Hint Pattern

```typescript
class UserRepository extends MongoRepository<User> {
  constructor() {
    super(User)
  }

  async findActiveUsersByAge(minAge: number): Promise<Paginate<User>> {
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
      Order.desc("createdAt")
    )

    return this.list(criteria, ["internalNotes", "temporaryData"])
  }
}
```

If you need index hints, prefer using the native MongoDB driver in a separate
data-access method. `MongoRepository` keeps its internal query helpers private.

## Monitoring and Profiling

### Query Performance Monitoring

```typescript
class PerformanceMonitoringRepository<
  T extends AggregateRoot,
> extends MongoRepository<T> {
  private performanceLogger = console // Replace with your logging system

  constructor(aggregateRootClass: AggregateRootClass<T>) {
    super(aggregateRootClass)
  }

  async listWithMonitoring(
    criteria: Criteria,
    fieldsToExclude?: string[]
  ): Promise<Paginate<T>> {
    const startTime = Date.now()
    const queryFingerprint = this.generateQueryFingerprint(criteria)

    try {
      const results = await this.list<T>(
        criteria,
        fieldsToExclude ? fieldsToExclude : []
      )
      const duration = Date.now() - startTime

      this.logQueryPerformance(
        queryFingerprint,
        duration,
        results.count,
        false
      )

      // Alert on slow queries
      if (duration > 1000) {
        // More than 1 second
        this.performanceLogger.warn("Slow query detected", {
          collection: this.collectionName(),
          duration,
          fingerprint: queryFingerprint,
          resultCount: results.count,
        })
      }

      return results
    } catch (error) {
      const duration = Date.now() - startTime
      this.logQueryPerformance(queryFingerprint, duration, 0, true)
      throw error
    }
  }

  private generateQueryFingerprint(criteria: Criteria): string {
    const filterTypes = criteria.filters.filters
      .map((f) => `${f.field.value}:${f.operator.value}`)
      .sort()
      .join(",")

    const hasOrder = criteria.order.hasOrder()
    const hasLimit = criteria.limit > 0

    return `${filterTypes}|order:${hasOrder}|limit:${hasLimit}`
  }

  private logQueryPerformance(
    fingerprint: string,
    duration: number,
    resultCount: number,
    failed: boolean
  ): void {
    this.performanceLogger.log("Query Performance", {
      collection: this.collectionName(),
      fingerprint,
      duration,
      resultCount,
      failed,
      timestamp: new Date().toISOString(),
    })
  }
}
```

### Query Explain Integration

```typescript
class ExplainableRepository<
  T extends AggregateRoot,
> extends MongoRepository<T> {
  async explainQuery(criteria: Criteria): Promise<any> {
    const converter = new MongoCriteriaConverter()
    const mongoQuery = converter.convert(criteria)

    const collection = await this.collection()

    const explainResult = await collection
      .find(mongoQuery.filter)
      .sort(mongoQuery.sort)
      .skip(mongoQuery.skip)
      .limit(mongoQuery.limit || 0)
      .explain("executionStats")

    return {
      query: mongoQuery,
      explanation: explainResult,
      recommendations: this.analyzeExplanation(explainResult),
    }
  }

  private analyzeExplanation(explanation: any): string[] {
    const recommendations: string[] = []
    const stats = explanation.executionStats

    // Check if query used an index
    if (stats.executionStages.stage === "COLLSCAN") {
      recommendations.push(
        "Query performed a collection scan. Consider adding an index."
      )
    }

    // Check examined vs returned documents ratio
    const examineRatio = stats.totalDocsExamined / stats.totalDocsReturned
    if (examineRatio > 10) {
      recommendations.push(
        `Query examined ${stats.totalDocsExamined} documents but returned only ${stats.totalDocsReturned}. Consider more selective filters or better indexes.`
      )
    }

    // Check execution time
    if (stats.executionTimeMillis > 100) {
      recommendations.push(
        `Query took ${stats.executionTimeMillis}ms. Consider optimization.`
      )
    }

    return recommendations
  }
}

// Usage
const userRepo = new ExplainableRepository<User>()
const criteria = new Criteria(/* your criteria */)
const analysis = await userRepo.explainQuery(criteria)
console.log("Query Analysis:", analysis.recommendations)
```

## Common Performance Issues

### 1. **Collection Scans**

```typescript
// ❌ Problem: No index on filtered field
const inefficientCriteria = new Criteria(
  Filters.fromValues([
    new Map([
      ["field", "customField"],
      ["operator", Operator.EQUAL],
      ["value", "value"],
    ]),
  ]),
  Order.none()
)

// ✅ Solution: Create index
// db.collection.createIndex({ customField: 1 });
```

### 2. **Inefficient Text Search**

```typescript
// ❌ Problem: OR across many unindexed fields
const inefficientTextSearch: OrCondition[] = [
  { field: "field1", operator: Operator.CONTAINS, value: "term" },
  { field: "field2", operator: Operator.CONTAINS, value: "term" },
  { field: "field3", operator: Operator.CONTAINS, value: "term" },
  { field: "field4", operator: Operator.CONTAINS, value: "term" },
  { field: "field5", operator: Operator.CONTAINS, value: "term" },
]

// ✅ Solution: Use text index
// db.collection.createIndex({
//   field1: "text",
//   field2: "text",
//   field3: "text"
// });

const efficientTextSearch = new Criteria(
  Filters.fromValues([
    new Map([
      ["field", "$text"],
      ["operator", Operator.EQUAL],
      ["value", "term"],
    ]),
  ]),
  Order.none()
)
```

### 3. **Deep Pagination**

```typescript
// ❌ Problem: Deep pagination with skip
const deepPagination = new Criteria(
  Filters.none(),
  Order.desc("createdAt"),
  20,
  500 // Skip 9,980 documents
)

// ✅ Solution: Cursor-based pagination
class CursorPagination {
  static getNextPage(lastId: string, limit: number = 20): Criteria {
    return new Criteria(
      Filters.fromValues([
        new Map([
          ["field", "_id"],
          ["operator", Operator.GT],
          ["value", lastId],
        ]),
      ]),
      Order.asc("_id"),
      limit
    )
  }
}
```

### 4. **Unused Sorting**

```typescript
// ❌ Problem: Sorting without corresponding index
const unsortedCriteria = new Criteria(
  Filters.fromValues([
    new Map([
      ["field", "status"],
      ["operator", Operator.EQUAL],
      ["value", "active"],
    ]),
  ]),
  Order.desc("customField"), // No index on customField
  20,
  1
)

// ✅ Solution: Create compound index
// db.collection.createIndex({ status: 1, customField: -1 });
```

## Best Practices

### 1. **Query Pattern Analysis**

```typescript
class QueryPatternAnalyzer {
  private queryPatterns = new Map<string, number>()

  trackQuery(criteria: Criteria): void {
    const pattern = this.extractPattern(criteria)
    const count = this.queryPatterns.get(pattern) || 0
    this.queryPatterns.set(pattern, count + 1)
  }

  getTopPatterns(
    limit: number = 10
  ): Array<{ pattern: string; count: number }> {
    return Array.from(this.queryPatterns.entries())
      .map(([pattern, count]) => ({ pattern, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
  }

  private extractPattern(criteria: Criteria): string {
    const fields = criteria.filters.filters
      .map((f) => f.field.value)
      .sort()
      .join(",")

    const operators = criteria.filters.filters
      .map((f) => f.operator.value)
      .sort()
      .join(",")

    return `fields:${fields}|ops:${operators}|sorted:${criteria.order.hasOrder()}`
  }
}
```

### 2. **Automated Index Suggestions**

```typescript
class IndexSuggester {
  static suggestIndexes(criteria: Criteria): string[] {
    const suggestions: string[] = []
    const fields: string[] = []

    // Analyze filter fields
    criteria.filters.filters.forEach((filter) => {
      if (filter.operator.value === Operator.EQUAL) {
        fields.unshift(filter.field.value) // Equality fields first
      } else if (
        [Operator.GT, Operator.GTE, Operator.LT, Operator.LTE].includes(
          filter.operator.value
        )
      ) {
        fields.push(filter.field.value) // Range fields after equality
      }
    })

    // Add sort field last
    if (criteria.order.hasOrder()) {
      fields.push(criteria.order.orderBy.value)
    }

    if (fields.length > 0) {
      const direction = criteria.order.isDesc() ? -1 : 1
      const lastField = fields[fields.length - 1]

      if (fields.length === 1) {
        suggestions.push(
          `db.collection.createIndex({ ${lastField}: ${direction} });`
        )
      } else {
        const indexSpec = fields
          .map((field, index) => {
            const dir = index === fields.length - 1 ? direction : 1
            return `${field}: ${dir}`
          })
          .join(", ")
        suggestions.push(`db.collection.createIndex({ ${indexSpec} });`)
      }
    }

    // Suggest text indexes for OR conditions with CONTAINS
    const hasTextSearch = criteria.filters.filters.some(
      (filter) =>
        filter.operator.value === Operator.OR && filter.value.isOrConditions
    )

    if (hasTextSearch) {
      suggestions.push("Consider creating a text index for search fields")
    }

    return suggestions
  }
}
```

### 3. **Connection Pool Optimization**

```typescript
// Optimize MongoDB connection settings
const optimizedConnectionOptions = {
  maxPoolSize: 10, // Maximum number of connections
  minPoolSize: 5, // Minimum number of connections
  maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
  serverSelectionTimeoutMS: 5000, // How long to try to connect
  socketTimeoutMS: 45000, // How long to wait for a response
  bufferMaxEntries: 0, // Disable mongoose buffering
  bufferCommands: false, // Disable mongoose buffering
}
```

## Real-world Optimizations

### E-commerce Product Search

```typescript
class OptimizedProductSearchService {
  // Optimized for: category + price range + text search + sorting
  // Required index: { category: 1, status: 1, price: 1, popularity: -1 }
  // Text index: { name: "text", description: "text" }

  buildOptimizedProductCriteria(request: ProductSearchRequest): Criteria {
    const filters: Array<Map<string, string | string[] | OrCondition[]>> = []

    // 1. Most selective: exact category match
    if (request.category) {
      filters.push(
        new Map([
          ["field", "category"],
          ["operator", Operator.EQUAL],
          ["value", request.category],
        ])
      )
    }

    // 2. High selectivity: status filter
    filters.push(
      new Map([
        ["field", "status"],
        ["operator", Operator.EQUAL],
        ["value", "active"],
      ])
    )

    // 3. Range filters: price
    if (request.minPrice) {
      filters.push(
        new Map([
          ["field", "price"],
          ["operator", Operator.GTE],
          ["value", request.minPrice.toString()],
        ])
      )
    }

    if (request.maxPrice) {
      filters.push(
        new Map([
          ["field", "price"],
          ["operator", Operator.LTE],
          ["value", request.maxPrice.toString()],
        ])
      )
    }

    // 4. Text search (use text index instead of OR)
    if (request.searchTerm) {
      // Use MongoDB text search instead of regex OR
      filters.push(
        new Map([
          ["field", "$text"],
          ["operator", Operator.EQUAL],
          ["value", `"${request.searchTerm}"`],
        ])
      )
    }

    return new Criteria(
      Filters.fromValues(filters),
      Order.desc("popularity"), // Indexed sort field
      Math.min(request.limit || 20, 50), // Cap limit
      request.page || 1
    )
  }
}
```

### User Analytics Dashboard

```typescript
class OptimizedAnalyticsService {
  // Optimized for: time-series data with aggregation
  // Required index: { status: 1, createdAt: -1, userType: 1 }

  buildTimeSeriesCriteria(
    startDate: Date,
    endDate: Date,
    userType?: string
  ): Criteria {
    const filters: Array<Map<string, string>> = [
      // Status filter first (highest selectivity)
      new Map([
        ["field", "status"],
        ["operator", Operator.EQUAL],
        ["value", "active"],
      ]),

      // Date range (good selectivity for time-series)
      new Map([
        ["field", "createdAt"],
        ["operator", Operator.GTE],
        ["value", startDate.toISOString()],
      ]),
      new Map([
        ["field", "createdAt"],
        ["operator", Operator.LTE],
        ["value", endDate.toISOString()],
      ]),
    ]

    if (userType) {
      filters.push(
        new Map([
          ["field", "userType"],
          ["operator", Operator.EQUAL],
          ["value", userType],
        ])
      )
    }

    return new Criteria(
      Filters.fromValues(filters),
      Order.desc("createdAt"),
      1000 // Larger limit for analytics
    )
  }

  // For real-time dashboards: cache frequently accessed criteria
  private static readonly CACHE_TTL = 60000 // 1 minute
  private criteriaCache = new Map<
    string,
    { criteria: Criteria; timestamp: number }
  >()

  getCachedTimeSeriesCriteria(
    startDate: Date,
    endDate: Date,
    userType?: string
  ): Criteria {
    const key = `${startDate.getTime()}-${endDate.getTime()}-${userType || "all"}`
    const cached = this.criteriaCache.get(key)

    if (
      cached &&
      Date.now() - cached.timestamp < OptimizedAnalyticsService.CACHE_TTL
    ) {
      return cached.criteria
    }

    const criteria = this.buildTimeSeriesCriteria(startDate, endDate, userType)
    this.criteriaCache.set(key, { criteria, timestamp: Date.now() })

    return criteria
  }
}
```

### High-Volume Order Processing

```typescript
class OptimizedOrderService {
  // Optimized for: order status updates and reporting
  // Required indexes:
  // - { userId: 1, status: 1, createdAt: -1 }
  // - { status: 1, totalAmount: -1, createdAt: -1 }

  buildOrderReportCriteria(
    userId?: string,
    status?: string[],
    minAmount?: number,
    startDate?: Date
  ): Criteria {
    const filters: Array<Map<string, string | string[] | OrCondition[]>> = []

    // User-specific queries (most selective)
    if (userId) {
      filters.push(
        new Map([
          ["field", "userId"],
          ["operator", Operator.EQUAL],
          ["value", userId],
        ])
      )
    }

    // Status filter with OR optimization
    if (status && status.length > 0) {
      if (status.length === 1) {
        // Single status: use equality
        filters.push(
          new Map([
            ["field", "status"],
            ["operator", Operator.EQUAL],
            ["value", status[0]],
          ])
        )
      } else {
        // Multiple statuses: use OR
        const statusConditions: OrCondition[] = status.map((s) => ({
          field: "status",
          operator: Operator.EQUAL,
          value: s,
        }))

        filters.push(
          new Map([
            ["field", "status_options"],
            ["operator", Operator.OR],
            ["value", statusConditions],
          ])
        )
      }
    }

    // Amount filter
    if (minAmount) {
      filters.push(
        new Map([
          ["field", "totalAmount"],
          ["operator", Operator.GTE],
          ["value", minAmount.toString()],
        ])
      )
    }

    // Date range
    if (startDate) {
      filters.push(
        new Map([
          ["field", "createdAt"],
          ["operator", Operator.GTE],
          ["value", startDate.toISOString()],
        ])
      )
    }

    return new Criteria(
      Filters.fromValues(filters),
      Order.desc("createdAt"),
      100 // Reasonable limit for order reports
    )
  }
}
```

By following these performance optimization strategies, you can ensure that your Criteria-based queries perform efficiently even with large datasets and complex filtering requirements. Remember to always measure performance in your specific environment and adjust indexes and query patterns based on your actual usage patterns.
