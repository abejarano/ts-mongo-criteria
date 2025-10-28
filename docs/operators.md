# 🔧 Operators Reference Guide

## Table of Contents

- [Overview](#overview)
- [Basic Operators](#basic-operators)
- [Text Operators](#text-operators)
- [Logical Operators](#logical-operators)
- [Usage Examples](#usage-examples)
- [MongoDB Query Generation](#mongodb-query-generation)
- [Performance Considerations](#performance-considerations)
- [Best Practices](#best-practices)

## Overview

The TypeScript MongoDB Criteria library supports a comprehensive set of operators that cover most common database query
needs. Each operator is type-safe and generates optimized MongoDB queries.

## Supported Operators

| Operator       | Description           | MongoDB Equivalent | Example                                         |
| -------------- | --------------------- | ------------------ | ----------------------------------------------- |
| `EQUAL`        | Exact match           | `$eq`              | `status = "active"`                             |
| `NOT_EQUAL`    | Not equal             | `$ne`              | `status != "inactive"`                          |
| `GT`           | Greater than          | `$gt`              | `age > 18`                                      |
| `GTE`          | Greater than or equal | `$gte`             | `age >= 21`                                     |
| `LT`           | Less than             | `$lt`              | `price < 100`                                   |
| `LTE`          | Less than or equal    | `$lte`             | `price <= 50`                                   |
| `BETWEEN`      | Inclusive range       | `$gte` + `$lte`    | `createdAt between 2024-01-01 and 2024-01-31`   |
| `CONTAINS`     | Text contains         | `$regex`           | `name contains "john"`                          |
| `NOT_CONTAINS` | Text doesn't contain  | `$not: { $regex }` | `name not contains "spam"`                      |
| `OR`           | Logical OR            | `$or`              | `name contains "john" OR email contains "john"` |

## Basic Operators

### EQUAL (`=`)

Tests for exact equality between field and value.

```typescript
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

// Generates: { status: { $eq: "active" } }
```

**Use Cases:**

- Status checks (`status = "active"`)
- ID lookups (`userId = "12345"`)
- Boolean flags (`isVerified = true`)
- Category filtering (`category = "electronics"`)

**Performance Tips:**

- Create indexes on fields used with EQUAL
- Most selective operator - use early in compound filters

### NOT_EQUAL (`!=`)

Tests for inequality between field and value.

```typescript
const criteria = new Criteria(
  Filters.fromValues([
    new Map([
      ["field", "status"],
      ["operator", Operator.NOT_EQUAL],
      ["value", "deleted"],
    ]),
  ]),
  Order.none()
)

// Generates: { status: { $ne: "deleted" } }
```

**Use Cases:**

- Excluding specific values (`status != "deleted"`)
- Finding non-matching items (`category != "archived"`)

**Performance Tips:**

- Less efficient than EQUAL - consider using positive conditions when possible
- May require full collection scan without proper indexes

### GT (Greater Than)

Tests if field value is greater than the specified value.

```typescript
const criteria = new Criteria(
  Filters.fromValues([
    new Map([
      ["field", "age"],
      ["operator", Operator.GT],
      ["value", "18"],
    ]),
  ]),
  Order.none()
)

// Generates: { age: { $gt: "18" } }
```

**Use Cases:**

- Age restrictions (`age > 18`)
- Price filtering (`price > 100`)
- Date comparisons (`createdAt > "2024-01-01"`)
- Quantity thresholds (`stock > 0`)

### GTE (Greater Than or Equal)

Tests if field value is greater than or equal to the specified value.

```typescript
const criteria = new Criteria(
  Filters.fromValues([
    new Map([
      ["field", "rating"],
      ["operator", Operator.GTE],
      ["value", "4.0"],
    ]),
  ]),
  Order.none()
)

// Generates: { rating: { $gte: "4.0" } }
```

**Use Cases:**

- Minimum thresholds (`rating >= 4.0`)
- Date ranges (`startDate >= "2024-01-01"`)
- Inclusive comparisons (`score >= 80`)

### LT (Less Than)

Tests if field value is less than the specified value.

```typescript
const criteria = new Criteria(
  Filters.fromValues([
    new Map([
      ["field", "price"],
      ["operator", Operator.LT],
      ["value", "100"],
    ]),
  ]),
  Order.none()
)

// Generates: { price: { $lt: "100" } }
```

**Use Cases:**

- Maximum price filters (`price < 100`)
- Age restrictions (`age < 65`)
- Budget constraints (`cost < 1000`)

### LTE (Less Than or Equal)

Tests if field value is less than or equal to the specified value.

```typescript
const criteria = new Criteria(
  Filters.fromValues([
    new Map([
      ["field", "discount"],
      ["operator", Operator.LTE],
      ["value", "50"],
    ]),
  ]),
  Order.none()
)

// Generates: { discount: { $lte: "50" } }
```

**Use Cases:**

- Maximum limits (`discount <= 50%`)
- Date boundaries (`endDate <= "2024-12-31"`)
- Capacity constraints (`attendees <= 100`)

### BETWEEN (Inclusive Range)

Combines lower and upper bounds on the same field using a single operator.

```typescript
const criteria = new Criteria(
  Filters.fromValues([
    new Map([
      ["field", "createdAt"],
      ["operator", Operator.BETWEEN],
      ["value", { start: new Date("2024-01-01"), end: new Date("2024-01-31") }],
    ]),
  ]),
  Order.none()
)

// Generates: { createdAt: { $gte: 2024-01-01, $lte: 2024-01-31 } }
```

**Use Cases:**

- Date windows (`createdAt between start and end`)
- Numeric ranges (`price between 50 and 200`)
- Score thresholds (`score between 0 and 100`)

**Performance Tips:**

- Works best with indexes on the filtered field
- Use `BETWEEN` instead of stacking `GTE` + `LTE` on the same field for clearer intent
- Accepts `start`/`end` or `startDate`/`endDate` keys when building the filter map

## Text Operators

### CONTAINS

Tests if field contains the specified text (case-insensitive partial match).

```typescript
const criteria = new Criteria(
  Filters.fromValues([
    new Map([
      ["field", "name"],
      ["operator", Operator.CONTAINS],
      ["value", "john"],
    ]),
  ]),
  Order.none()
)

// Generates: { name: { $regex: "john" } }
```

**Use Cases:**

- Search functionality (`name contains "john"`)
- Partial matching (`email contains "@gmail"`)
- Tag filtering (`tags contains "urgent"`)
- Description searches (`description contains "mongodb"`)

**Performance Tips:**

- Create text indexes for better performance
- Consider using MongoDB's full-text search for complex text queries
- Prefix patterns (`startsWith`) perform better than infix patterns

### NOT_CONTAINS

Tests if field does NOT contain the specified text.

```typescript
const criteria = new Criteria(
  Filters.fromValues([
    new Map([
      ["field", "email"],
      ["operator", Operator.NOT_CONTAINS],
      ["value", "spam"],
    ]),
  ]),
  Order.none()
)

// Generates: { email: { $not: { $regex: "spam" } } }
```

**Use Cases:**

- Filtering out unwanted content (`email not contains "noreply"`)
- Excluding patterns (`filename not contains "temp"`)
- Content moderation (`content not contains "banned_word"`)

**Performance Tips:**

- Generally slower than positive matches
- Consider maintaining exclusion lists separately for better performance

## Logical Operators

### OR

Performs logical OR operation across multiple conditions.

```typescript
import {
  Criteria,
  FilterInputValue,
  Filters,
  Operator,
  Order,
  OrCondition,
} from "@abejarano/ts-mongodb-criteria"

const orConditions: OrCondition[] = [
  { field: "name", operator: Operator.CONTAINS, value: "john" },
  { field: "email", operator: Operator.CONTAINS, value: "john" },
  { field: "phone", operator: Operator.CONTAINS, value: "john" },
]

const criteria = new Criteria(
  Filters.fromValues([
    new Map<string, FilterInputValue>([
      ["field", "search"],
      ["operator", Operator.OR],
      ["value", orConditions],
    ]),
  ]),
  Order.none()
)

// Generates:
// {
//   $or: [
//     { name: { $regex: "john" } },
//     { email: { $regex: "john" } },
//     { phone: { $regex: "john" } }
//   ]
// }
```

**Use Cases:**

- Multi-field search (`name OR email OR phone contains "john"`)
- Alternative conditions (`status = "premium" OR totalSpent >= 1000`)
- Flexible matching (`category = "sale" OR discount > 20`)

**Performance Tips:**

- Place most selective conditions first
- Consider creating compound indexes that support OR queries
- Limit the number of OR conditions to avoid performance degradation

## Usage Examples

### Simple Filtering

```typescript
// Find active users over 21
const adultActiveUsers = new Criteria(
  Filters.fromValues([
    new Map([
      ["field", "status"],
      ["operator", Operator.EQUAL],
      ["value", "active"],
    ]),
    new Map([
      ["field", "age"],
      ["operator", Operator.GT],
      ["value", "21"],
    ]),
  ]),
  Order.desc("createdAt")
)
```

### Range Queries

```typescript
// Find products in price range $50-$200
const priceRangeProducts = new Criteria(
  Filters.fromValues([
    new Map([
      ["field", "price"],
      ["operator", Operator.GTE],
      ["value", "50"],
    ]),
    new Map([
      ["field", "price"],
      ["operator", Operator.LTE],
      ["value", "200"],
    ]),
  ]),
  Order.asc("price")
)
```

### Text Search

```typescript
// Search for products containing "smartphone" in name or description
const searchConditions: OrCondition[] = [
  { field: "name", operator: Operator.CONTAINS, value: "smartphone" },
  { field: "description", operator: Operator.CONTAINS, value: "smartphone" },
]

const smartphoneSearch = new Criteria(
  Filters.fromValues([
    new Map<string, string | string[] | OrCondition[]>([
      ["field", "search"],
      ["operator", Operator.OR],
      ["value", searchConditions],
    ]),
  ]),
  Order.desc("popularity")
)
```

### Complex Business Logic

```typescript
// Find VIP customers: Premium members OR high spenders OR long-term customers
const vipConditions: OrCondition[] = [
  { field: "membershipType", operator: Operator.EQUAL, value: "premium" },
  { field: "totalSpent", operator: Operator.GTE, value: "5000" },
  { field: "memberSince", operator: Operator.LTE, value: "2020-01-01" },
]

const vipCustomers = new Criteria(
  Filters.fromValues([
    // Must be active
    new Map([
      ["field", "status"],
      ["operator", Operator.EQUAL],
      ["value", "active"],
    ]),
    // AND meet VIP criteria
    new Map<string, string | string[] | OrCondition[]>([
      ["field", "vip_criteria"],
      ["operator", Operator.OR],
      ["value", vipConditions],
    ]),
  ]),
  Order.desc("totalSpent")
)
```

### E-commerce Product Filters

```typescript
interface ProductFilters {
  category?: string
  minPrice?: number
  maxPrice?: number
  searchTerm?: string
  inStock?: boolean
  rating?: number
}

function buildProductCriteria(filters: ProductFilters): Criteria {
  const criteriaFilters: Array<Map<string, string | string[] | OrCondition[]>> =
    []

  // Category filter
  if (filters.category) {
    criteriaFilters.push(
      new Map([
        ["field", "category"],
        ["operator", Operator.EQUAL],
        ["value", filters.category],
      ])
    )
  }

  // Price range
  if (filters.minPrice) {
    criteriaFilters.push(
      new Map([
        ["field", "price"],
        ["operator", Operator.GTE],
        ["value", filters.minPrice.toString()],
      ])
    )
  }

  if (filters.maxPrice) {
    criteriaFilters.push(
      new Map([
        ["field", "price"],
        ["operator", Operator.LTE],
        ["value", filters.maxPrice.toString()],
      ])
    )
  }

  // Stock availability
  if (filters.inStock) {
    criteriaFilters.push(
      new Map([
        ["field", "stockQuantity"],
        ["operator", Operator.GT],
        ["value", "0"],
      ])
    )
  }

  // Minimum rating
  if (filters.rating) {
    criteriaFilters.push(
      new Map([
        ["field", "averageRating"],
        ["operator", Operator.GTE],
        ["value", filters.rating.toString()],
      ])
    )
  }

  // Text search across multiple fields
  if (filters.searchTerm) {
    const searchConditions: OrCondition[] = [
      { field: "name", operator: Operator.CONTAINS, value: filters.searchTerm },
      {
        field: "description",
        operator: Operator.CONTAINS,
        value: filters.searchTerm,
      },
      {
        field: "brand",
        operator: Operator.CONTAINS,
        value: filters.searchTerm,
      },
      { field: "tags", operator: Operator.CONTAINS, value: filters.searchTerm },
    ]

    criteriaFilters.push(
      new Map([
        ["field", "search"],
        ["operator", Operator.OR],
        ["value", searchConditions],
      ])
    )
  }

  return new Criteria(
    Filters.fromValues(criteriaFilters),
    Order.desc("createdAt"),
    20,
    1
  )
}
```

## MongoDB Query Generation

### Simple Operators

```typescript
// Input: age > 18
new Map([
  ["field", "age"],
  ["operator", Operator.GT],
  ["value", "18"],
])

// Output: { age: { $gt: "18" } }
```

### Multiple Filters (AND)

```typescript
// Input: status = "active" AND age >= 21
;[
  new Map([
    ["field", "status"],
    ["operator", Operator.EQUAL],
    ["value", "active"],
  ]),
  new Map([
    ["field", "age"],
    ["operator", Operator.GTE],
    ["value", "21"],
  ]),
]

// Output:
// {
//   status: { $eq: "active" },
//   age: { $gte: "21" }
// }
```

### OR Conditions

```typescript
// Input: name contains "john" OR email contains "john"
const orConditions: OrCondition[] = [
  { field: "name", operator: Operator.CONTAINS, value: "john" },
  { field: "email", operator: Operator.CONTAINS, value: "john" },
]

// Output:
// {
//   $or: [
//     { name: { $regex: "john" } },
//     { email: { $regex: "john" } }
//   ]
// }
```

### Complex Mixed Queries

```typescript
// Input: Active users who are either premium OR have spent > $1000
;[
  new Map([
    ["field", "status"],
    ["operator", Operator.EQUAL],
    ["value", "active"],
  ]),
  new Map([
    ["field", "premium_or_high_spender"],
    ["operator", Operator.OR],
    [
      "value",
      [
        { field: "membershipType", operator: Operator.EQUAL, value: "premium" },
        { field: "totalSpent", operator: Operator.GT, value: "1000" },
      ],
    ],
  ]),
]

// Output:
// {
//   status: { $eq: "active" },
//   $or: [
//     { membershipType: { $eq: "premium" } },
//     { totalSpent: { $gt: "1000" } }
//   ]
// }
```

## Performance Considerations

### Index Strategy

```javascript
// MongoDB shell commands for common operator patterns

// Single field indexes
db.users.createIndex({ status: 1 }) // For EQUAL/NOT_EQUAL
db.products.createIndex({ price: 1 }) // For GT/GTE/LT/LTE
db.articles.createIndex({ title: "text" }) // For CONTAINS/NOT_CONTAINS

// Compound indexes (order matters!)
db.users.createIndex({ status: 1, age: 1, createdAt: -1 })
db.products.createIndex({ category: 1, price: 1, rating: -1 })

// Text indexes for better text search performance
db.products.createIndex({
  name: "text",
  description: "text",
  brand: "text",
})
```

### Query Optimization Tips

#### 1. **Filter Order Matters**

Place most selective filters first:

```typescript
// ✅ Good: Most selective first
const optimizedCriteria = new Criteria(
  Filters.fromValues([
    new Map([
      ["field", "userId"],
      ["operator", Operator.EQUAL],
      ["value", "specific_id"],
    ]), // Most selective
    new Map([
      ["field", "status"],
      ["operator", Operator.EQUAL],
      ["value", "active"],
    ]), // Moderately selective
    new Map([
      ["field", "category"],
      ["operator", Operator.EQUAL],
      ["value", "electronics"],
    ]), // Less selective
    new Map([
      ["field", "description"],
      ["operator", Operator.CONTAINS],
      ["value", "phone"],
    ]), // Least selective
  ]),
  Order.none()
)

// ❌ Bad: Least selective first
const unoptimizedCriteria = new Criteria(
  Filters.fromValues([
    new Map([
      ["field", "description"],
      ["operator", Operator.CONTAINS],
      ["value", "phone"],
    ]), // Expensive scan
    new Map([
      ["field", "userId"],
      ["operator", Operator.EQUAL],
      ["value", "specific_id"],
    ]), // Should be first
  ]),
  Order.none()
)
```

#### 2. **Use Appropriate Data Types**

```typescript
// ✅ Good: Use proper date formatting
new Map([
  ["field", "createdAt"],
  ["operator", Operator.GTE],
  ["value", new Date().toISOString()],
])

// ✅ Good: Use numbers as strings consistently
new Map([
  ["field", "age"],
  ["operator", Operator.GT],
  ["value", "18"],
])

// ❌ Bad: Inconsistent formatting
new Map([
  ["field", "createdAt"],
  ["operator", Operator.GTE],
  ["value", "2024-01-01"],
])
```

#### 3. **Limit OR Conditions**

```typescript
// ✅ Good: Reasonable number of OR conditions
const searchConditions: OrCondition[] = [
  { field: "name", operator: Operator.CONTAINS, value: "term" },
  { field: "email", operator: Operator.CONTAINS, value: "term" },
  { field: "phone", operator: Operator.CONTAINS, value: "term" },
] // 3 conditions - reasonable

// ❌ Avoid: Too many OR conditions
const tooManyConditions: OrCondition[] = [
  // 20+ OR conditions - performance issues
]
```

### Performance Monitoring

```typescript
class PerformantUserRepository extends MongoRepository<User> {
  async findWithCriteria(criteria: Criteria): Promise<User[]> {
    const startTime = Date.now()

    try {
      const results = await this.searchByCriteria(criteria)
      const duration = Date.now() - startTime

      // Log slow queries
      if (duration > 1000) {
        console.warn(`Slow query detected: ${duration}ms`, {
          filters: criteria.filters.filters.length,
          hasOrder: criteria.order.hasOrder(),
          limit: criteria.limit,
        })
      }

      return results
    } catch (error) {
      console.error("Query failed:", error)
      throw error
    }
  }
}
```

## Best Practices

### 1. **Use Type-Safe Operator Constants**

```typescript
// ✅ Good: Use enum constants
new Map([
  ["field", "status"],
  ["operator", Operator.EQUAL],
  ["value", "active"],
])

// ❌ Bad: Magic strings
new Map([
  ["field", "status"],
  ["operator", "="],
  ["value", "active"],
])
```

### 2. **Validate Input Values**

```typescript
class SafeCriteriaBuilder {
  static userAgeRange(min?: number, max?: number): Map<string, string>[] {
    const filters: Map<string, string>[] = []

    if (min !== undefined) {
      if (min < 0 || min > 150) {
        throw new Error("Invalid minimum age")
      }
      filters.push(
        new Map([
          ["field", "age"],
          ["operator", Operator.GTE],
          ["value", min.toString()],
        ])
      )
    }

    if (max !== undefined) {
      if (max < 0 || max > 150 || (min && max < min)) {
        throw new Error("Invalid maximum age")
      }
      filters.push(
        new Map([
          ["field", "age"],
          ["operator", Operator.LTE],
          ["value", max.toString()],
        ])
      )
    }

    return filters
  }
}
```

### 3. **Create Reusable Operator Combinations**

```typescript
import {
  FilterInputValue,
  OrCondition,
  Operator,
} from "@abejarano/ts-mongodb-criteria"

class CommonOperators {
  static dateRange(
    field: string,
    start: Date,
    end: Date
  ): Map<string, FilterInputValue>[] {
    return [
      new Map([
        ["field", field],
        ["operator", Operator.BETWEEN],
        ["value", { start, end }],
      ]),
    ]
  }

  static multiFieldSearch(
    searchTerm: string,
    fields: string[]
  ): Map<string, FilterInputValue> {
    const orConditions: OrCondition[] = fields.map((field) => ({
      field,
      operator: Operator.CONTAINS,
      value: searchTerm,
    }))

    return new Map([
      ["field", "search"],
      ["operator", Operator.OR],
      ["value", orConditions],
    ])
  }

  static statusIn(statuses: string[]): Map<string, FilterInputValue> {
    const orConditions: OrCondition[] = statuses.map((status) => ({
      field: "status",
      operator: Operator.EQUAL,
      value: status,
    }))

    return new Map([
      ["field", "status_options"],
      ["operator", Operator.OR],
      ["value", orConditions],
    ])
  }
}

// Usage
const criteria = new Criteria(
  Filters.fromValues([
    ...CommonOperators.dateRange("createdAt", startDate, endDate),
    CommonOperators.statusIn(["active", "pending"]),
    CommonOperators.multiFieldSearch("john", ["name", "email"]),
  ]),
  Order.desc("createdAt")
)
```

### 4. **Test Operator Behavior**

```typescript
describe("Operators", () => {
  describe("EQUAL operator", () => {
    it("should generate correct MongoDB query", () => {
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

      const converter = new MongoCriteriaConverter()
      const mongoQuery = converter.convert(criteria)

      expect(mongoQuery.filter).toEqual({
        status: { $eq: "active" },
      })
    })
  })

  describe("OR operator", () => {
    it("should handle multiple conditions correctly", () => {
      const orConditions: OrCondition[] = [
        { field: "name", operator: Operator.CONTAINS, value: "john" },
        { field: "email", operator: Operator.CONTAINS, value: "john" },
      ]

      const criteria = new Criteria(
        Filters.fromValues([
          new Map<string, string | string[] | OrCondition[]>([
            ["field", "search"],
            ["operator", Operator.OR],
            ["value", orConditions],
          ]),
        ]),
        Order.none()
      )

      const converter = new MongoCriteriaConverter()
      const mongoQuery = converter.convert(criteria)

      expect(mongoQuery.filter).toEqual({
        $or: [{ name: { $regex: "john" } }, { email: { $regex: "john" } }],
      })
    })
  })
})
```

The operators in this library provide a comprehensive foundation for building complex, efficient MongoDB queries while
maintaining type safety and performance. Choose the right operators for your use case and follow the performance
guidelines for optimal results.
