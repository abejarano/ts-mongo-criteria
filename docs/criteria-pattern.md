# 📋 Understanding the Criteria Pattern

## Table of Contents
- [What is the Criteria Pattern?](#what-is-the-criteria-pattern)
- [Benefits](#benefits)
- [When to Use](#when-to-use)
- [Pattern Structure](#pattern-structure)
- [Implementation Details](#implementation-details)
- [Comparison with Other Patterns](#comparison-with-other-patterns)
- [Real-world Examples](#real-world-examples)

## What is the Criteria Pattern?

The **Criteria Pattern** is a behavioral design pattern that encapsulates query logic in a structured, object-oriented way. Instead of building database queries directly as strings or objects, you compose `Criteria` objects that represent your search intentions.

### Core Concept

```typescript
// Instead of this (raw query building)
const query = {
  status: { $eq: "active" },
  age: { $gte: 18 },
  name: { $regex: "john" }
};

// You build this (criteria composition)
const criteria = new Criteria(
  Filters.fromValues([
    new Map([["field", "status"], ["operator", Operator.EQUAL], ["value", "active"]]),
    new Map([["field", "age"], ["operator", Operator.GTE], ["value", "18"]]),
    new Map([["field", "name"], ["operator", Operator.CONTAINS], ["value", "john"]])
  ]),
  Order.desc("createdAt"),
  20, 1
);
```

## Benefits

### 🔒 **Type Safety**
The pattern provides compile-time validation of your queries:

```typescript
// ✅ Type-safe - catches errors at compile time
const criteria = new Criteria(
  Filters.fromValues([
    new Map([["field", "status"], ["operator", Operator.EQUAL], ["value", "active"]])
  ]),
  Order.desc("createdAt")
);

// ❌ Raw queries - errors caught at runtime
const rawQuery = {
  status: { $eq: "active" },
  createdAt: { $sort: -1 } // Typo: should be in separate sort object
};
```

### 🧩 **Composability**
Build complex queries by combining simpler criteria:

```typescript
class UserCriteriaBuilder {
  static activeUsers(): Criteria {
    return new Criteria(
      Filters.fromValues([
        new Map([["field", "status"], ["operator", Operator.EQUAL], ["value", "active"]])
      ]),
      Order.none()
    );
  }

  static adults(): Criteria {
    return new Criteria(
      Filters.fromValues([
        new Map([["field", "age"], ["operator", Operator.GTE], ["value", "18"]])
      ]),
      Order.none()
    );
  }

  static recentlyActive(): Criteria {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return new Criteria(
      Filters.fromValues([
        new Map([["field", "lastLogin"], ["operator", Operator.GTE], ["value", thirtyDaysAgo.toISOString()]])
      ]),
      Order.none()
    );
  }

  // Combine criteria
  static activeAdultUsers(): Criteria {
    const filters = [
      ...this.activeUsers().filters.filters.map(f => new Map([
        ["field", f.field.value],
        ["operator", f.operator.value],
        ["value", f.value.value]
      ])),
      ...this.adults().filters.filters.map(f => new Map([
        ["field", f.field.value],
        ["operator", f.operator.value],
        ["value", f.value.value]
      ]))
    ];

    return new Criteria(
      Filters.fromValues(filters),
      Order.desc("createdAt")
    );
  }
}
```

### 🔄 **Reusability**
Define common query patterns once and reuse them:

```typescript
class CommonCriteria {
  static paginated(page: number, limit: number): Criteria {
    return new Criteria(
      Filters.none(),
      Order.desc("createdAt"),
      limit,
      page
    );
  }

  static search(searchTerm: string, fields: string[]): Criteria {
    const orConditions: OrCondition[] = fields.map(field => ({
      field,
      operator: Operator.CONTAINS,
      value: searchTerm
    }));

    return new Criteria(
      Filters.fromValues([
        new Map<string, string | string[] | OrCondition[]>([
          ["field", "search"],
          ["operator", Operator.OR],
          ["value", orConditions]
        ])
      ]),
      Order.none()
    );
  }

  static dateRange(field: string, startDate: Date, endDate: Date): Criteria {
    return new Criteria(
      Filters.fromValues([
        new Map([["field", field], ["operator", Operator.GTE], ["value", startDate.toISOString()]]),
        new Map([["field", field], ["operator", Operator.LTE], ["value", endDate.toISOString()]])
      ]),
      Order.none()
    );
  }
}
```

### 🧪 **Testability**
Easily mock and test query logic:

```typescript
describe("UserService", () => {
  it("should build correct criteria for active users search", () => {
    const searchTerm = "john";
    const criteria = userService.buildSearchCriteria(searchTerm);
    
    expect(criteria.hasFilters()).toBe(true);
    expect(criteria.filters.filters).toHaveLength(2); // status + search
    expect(criteria.limit).toBe(20);
  });

  it("should handle empty search gracefully", () => {
    const criteria = userService.buildSearchCriteria("");
    
    expect(criteria.filters.filters).toHaveLength(1); // only status filter
  });
});
```

## When to Use

### ✅ **Perfect For:**

1. **Dynamic Queries**: When query conditions depend on user input or business rules
   ```typescript
   function buildUserSearchCriteria(request: SearchRequest): Criteria {
     const filters = [];
     
     if (request.status) {
       filters.push(new Map([["field", "status"], ["operator", Operator.EQUAL], ["value", request.status]]));
     }
     
     if (request.minAge) {
       filters.push(new Map([["field", "age"], ["operator", Operator.GTE], ["value", request.minAge.toString()]]));
     }
     
     if (request.searchTerm) {
       const orConditions: OrCondition[] = [
         { field: "name", operator: Operator.CONTAINS, value: request.searchTerm },
         { field: "email", operator: Operator.CONTAINS, value: request.searchTerm }
       ];
       filters.push(new Map([["field", "search"], ["operator", Operator.OR], ["value", orConditions]]));
     }
     
     return new Criteria(Filters.fromValues(filters), Order.desc("createdAt"));
   }
   ```

2. **Complex Business Logic**: When queries represent business rules
   ```typescript
   class SubscriptionCriteria {
     static eligibleForUpgrade(): Criteria {
       // Business rule: Active subscribers with low usage
       return new Criteria(
         Filters.fromValues([
           new Map([["field", "status"], ["operator", Operator.EQUAL], ["value", "active"]]),
           new Map([["field", "plan"], ["operator", Operator.EQUAL], ["value", "basic"]]),
           new Map([["field", "usage"], ["operator", Operator.LT], ["value", "50"]])
         ]),
         Order.desc("subscriptionDate")
       );
     }
   }
   ```

3. **Repository Pattern**: When implementing data access layers
   ```typescript
   class ProductRepository extends MongoRepository<Product> {
     async findBestSellers(category?: string): Promise<Product[]> {
       const filters = [
         new Map([["field", "salesCount"], ["operator", Operator.GTE], ["value", "100"]])
       ];
       
       if (category) {
         filters.push(new Map([["field", "category"], ["operator", Operator.EQUAL], ["value", category]]));
       }
       
       const criteria = new Criteria(
         Filters.fromValues(filters),
         Order.desc("salesCount"),
         20
       );
       
       return this.searchByCriteria(criteria);
     }
   }
   ```

### ❌ **Avoid When:**

1. **Simple Static Queries**: When you have fixed, simple queries
   ```typescript
   // Overkill for simple queries
   const criteria = new Criteria(
     Filters.fromValues([
       new Map([["field", "id"], ["operator", Operator.EQUAL], ["value", "123"]])
     ]),
     Order.none()
   );
   
   // Better: Direct query
   const user = await collection.findOne({ _id: "123" });
   ```

2. **Performance Critical Paths**: When you need maximum performance
3. **One-off Queries**: For queries that will never be reused

## Pattern Structure

### Class Diagram

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│    Criteria     │───▶│     Filters      │───▶│     Filter      │
├─────────────────┤    ├──────────────────┤    ├─────────────────┤
│ - filters       │    │ - filters[]      │    │ - field         │
│ - order         │    │                  │    │ - operator      │
│ - limit         │    │ + fromValues()   │    │ - value         │
│ - page          │    │ + none()         │    │                 │
│                 │    └──────────────────┘    │ + fromValues()  │
│ + hasFilters()  │                            └─────────────────┘
│ + hasPagination()│   ┌──────────────────┐
└─────────────────┘───▶│      Order       │
                       ├──────────────────┤
                       │ - orderBy        │
                       │ - orderType      │
                       │                  │
                       │ + asc()          │
                       │ + desc()         │
                       │ + none()         │
                       │ + fromValues()   │
                       └──────────────────┘
```

### Component Responsibilities

#### **Criteria**
- **Purpose**: Main entry point that combines all query aspects
- **Responsibilities**:
  - Hold filter conditions
  - Specify sorting requirements
  - Define pagination parameters
  - Validate query completeness

#### **Filters**
- **Purpose**: Collection of filter conditions
- **Responsibilities**:
  - Manage multiple filter conditions
  - Provide factory methods for creation
  - Support empty filter sets

#### **Filter**
- **Purpose**: Individual filter condition
- **Responsibilities**:
  - Encapsulate field, operator, and value
  - Validate filter parameters
  - Support different value types (including OR conditions)

#### **Order**
- **Purpose**: Sorting specification
- **Responsibilities**:
  - Define sort field and direction
  - Support multiple sorting options
  - Handle no-sort scenarios

## Implementation Details

### Filter Value Types

The library supports multiple value types for different use cases:

```typescript
// String value (most common)
const stringFilter = new Map([
  ["field", "name"],
  ["operator", Operator.EQUAL],
  ["value", "john"]
]);

// OR conditions (complex logical operations)
const orConditions: OrCondition[] = [
  { field: "name", operator: Operator.CONTAINS, value: "john" },
  { field: "email", operator: Operator.CONTAINS, value: "john" }
];

const orFilter = new Map<string, string | string[] | OrCondition[]>([
  ["field", "search"],
  ["operator", Operator.OR],
  ["value", orConditions]
]);
```

### MongoDB Query Generation

The library converts criteria to optimized MongoDB queries:

```typescript
// Input Criteria
const criteria = new Criteria(
  Filters.fromValues([
    new Map([["field", "status"], ["operator", Operator.EQUAL], ["value", "active"]]),
    new Map([["field", "age"], ["operator", Operator.GTE], ["value", "18"]])
  ]),
  Order.desc("createdAt"),
  20, 1
);

// Generated MongoDB Query
{
  filter: {
    status: { $eq: "active" },
    age: { $gte: "18" }
  },
  sort: { createdAt: -1 },
  skip: 0,
  limit: 20
}
```

### Error Handling

The library provides meaningful error messages:

```typescript
try {
  const invalidFilter = new Map([
    ["field", "name"],
    ["operator", "INVALID_OPERATOR"], // Will throw InvalidArgumentError
    ["value", "john"]
  ]);
  
  const criteria = new Criteria(
    Filters.fromValues([invalidFilter]),
    Order.none()
  );
} catch (error) {
  console.error(error.message); // "The filter operator INVALID_OPERATOR is invalid"
}
```

## Comparison with Other Patterns

### vs. Query Builder Pattern

| Criteria Pattern | Query Builder Pattern |
|------------------|----------------------|
| Declarative approach | Fluent interface |
| Immutable objects | Mutable chain |
| Business-focused | Implementation-focused |

```typescript
// Criteria Pattern
const criteria = new Criteria(
  Filters.fromValues([
    new Map([["field", "status"], ["operator", Operator.EQUAL], ["value", "active"]])
  ]),
  Order.desc("createdAt")
);

// Query Builder Pattern (hypothetical)
const query = QueryBuilder
  .select()
  .from("users")
  .where("status", "=", "active")
  .orderBy("createdAt", "desc")
  .build();
```

### vs. Repository Methods

| Criteria Pattern | Repository Methods |
|------------------|-------------------|
| Dynamic composition | Fixed methods |
| Reusable components | Method proliferation |
| Type-safe | Method-specific validation |

```typescript
// Criteria Pattern - One method handles all cases
class UserRepository extends MongoRepository<User> {
  async findByCriteria(criteria: Criteria): Promise<User[]> {
    return this.searchByCriteria(criteria);
  }
}

// Repository Methods - Multiple specific methods
class UserRepository {
  async findActiveUsers(): Promise<User[]> { /* ... */ }
  async findAdultUsers(): Promise<User[]> { /* ... */ }
  async findActiveAdultUsers(): Promise<User[]> { /* ... */ }
  async findActiveAdultUsersByName(name: string): Promise<User[]> { /* ... */ }
  // Method explosion...
}
```

## Real-world Examples

### E-commerce Product Search

```typescript
interface ProductSearchRequest {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  searchTerm?: string;
  inStock?: boolean;
  sortBy?: 'price' | 'popularity' | 'rating';
  sortDirection?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

class ProductSearchService {
  buildSearchCriteria(request: ProductSearchRequest): Criteria {
    const filters: Array<Map<string, string | string[] | OrCondition[]>> = [];

    // Category filter
    if (request.category) {
      filters.push(new Map([
        ["field", "category"],
        ["operator", Operator.EQUAL],
        ["value", request.category]
      ]));
    }

    // Price range filters
    if (request.minPrice) {
      filters.push(new Map([
        ["field", "price"],
        ["operator", Operator.GTE],
        ["value", request.minPrice.toString()]
      ]));
    }

    if (request.maxPrice) {
      filters.push(new Map([
        ["field", "price"],
        ["operator", Operator.LTE],
        ["value", request.maxPrice.toString()]
      ]));
    }

    // Stock filter
    if (request.inStock !== undefined) {
      filters.push(new Map([
        ["field", "stockQuantity"],
        ["operator", request.inStock ? Operator.GT : Operator.EQUAL],
        ["value", request.inStock ? "0" : "0"]
      ]));
    }

    // Text search across multiple fields
    if (request.searchTerm) {
      const searchConditions: OrCondition[] = [
        { field: "name", operator: Operator.CONTAINS, value: request.searchTerm },
        { field: "description", operator: Operator.CONTAINS, value: request.searchTerm },
        { field: "brand", operator: Operator.CONTAINS, value: request.searchTerm }
      ];

      filters.push(new Map([
        ["field", "search"],
        ["operator", Operator.OR],
        ["value", searchConditions]
      ]));
    }

    // Sorting
    const sortField = request.sortBy || 'createdAt';
    const sortDirection = request.sortDirection === 'asc' ? OrderTypes.ASC : OrderTypes.DESC;
    const order = Order.fromValues(sortField, sortDirection);

    return new Criteria(
      Filters.fromValues(filters),
      order,
      request.limit || 20,
      request.page || 1
    );
  }
}
```

### User Management System

```typescript
class UserManagementService {
  // Find users for admin dashboard
  buildAdminUsersCriteria(filters: AdminUserFilters): Criteria {
    const criteriaFilters: Array<Map<string, string | string[] | OrCondition[]>> = [];

    // Role-based access control
    if (filters.roles && filters.roles.length > 0) {
      const roleConditions: OrCondition[] = filters.roles.map(role => ({
        field: "role",
        operator: Operator.EQUAL,
        value: role
      }));

      criteriaFilters.push(new Map([
        ["field", "roles"],
        ["operator", Operator.OR],
        ["value", roleConditions]
      ]));
    }

    // Account status
    if (filters.status) {
      criteriaFilters.push(new Map([
        ["field", "status"],
        ["operator", Operator.EQUAL],
        ["value", filters.status]
      ]));
    }

    // Registration date range
    if (filters.registeredAfter) {
      criteriaFilters.push(new Map([
        ["field", "createdAt"],
        ["operator", Operator.GTE],
        ["value", filters.registeredAfter.toISOString()]
      ]));
    }

    // Activity filters
    if (filters.lastLoginBefore) {
      criteriaFilters.push(new Map([
        ["field", "lastLogin"],
        ["operator", Operator.LTE],
        ["value", filters.lastLoginBefore.toISOString()]
      ]));
    }

    return new Criteria(
      Filters.fromValues(criteriaFilters),
      Order.desc("createdAt"),
      filters.limit || 50,
      filters.page || 1
    );
  }

  // Find users at risk of churning
  buildChurnRiskCriteria(): Criteria {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    return new Criteria(
      Filters.fromValues([
        // Active subscription
        new Map([["field", "subscriptionStatus"], ["operator", Operator.EQUAL], ["value", "active"]]),
        
        // Haven't logged in recently
        new Map([["field", "lastLogin"], ["operator", Operator.LTE], ["value", thirtyDaysAgo.toISOString()]]),
        
        // But were active before
        new Map([["field", "lastLogin"], ["operator", Operator.GTE], ["value", sixtyDaysAgo.toISOString()]]),
        
        // High-value customers
        new Map([["field", "totalSpent"], ["operator", Operator.GTE], ["value", "100"]])
      ]),
      Order.desc("totalSpent")
    );
  }
}
```

### Analytics and Reporting

```typescript
class AnalyticsService {
  // Build criteria for conversion funnel analysis
  buildConversionFunnelCriteria(step: 'visit' | 'signup' | 'purchase', dateRange: DateRange): Criteria {
    const filters: Array<Map<string, string | string[] | OrCondition[]>> = [
      // Date range
      new Map([["field", "createdAt"], ["operator", Operator.GTE], ["value", dateRange.start.toISOString()]]),
      new Map([["field", "createdAt"], ["operator", Operator.LTE], ["value", dateRange.end.toISOString()]])
    ];

    switch (step) {
      case 'visit':
        filters.push(new Map([["field", "eventType"], ["operator", Operator.EQUAL], ["value", "page_view"]]));
        break;
      
      case 'signup':
        filters.push(new Map([["field", "eventType"], ["operator", Operator.EQUAL], ["value", "user_signup"]]));
        break;
      
      case 'purchase':
        filters.push(new Map([["field", "eventType"], ["operator", Operator.EQUAL], ["value", "purchase"]]));
        filters.push(new Map([["field", "amount"], ["operator", Operator.GT], ["value", "0"]]));
        break;
    }

    return new Criteria(
      Filters.fromValues(filters),
      Order.asc("createdAt")
    );
  }
}
```

## Best Practices

### 1. **Use Builder Classes for Complex Criteria**

```typescript
class UserCriteriaBuilder {
  private filters: Array<Map<string, string | string[] | OrCondition[]>> = [];
  private order: Order = Order.none();
  private limit?: number;
  private page?: number;

  active(): this {
    this.filters.push(new Map([["field", "status"], ["operator", Operator.EQUAL], ["value", "active"]]));
    return this;
  }

  ageRange(min?: number, max?: number): this {
    if (min) {
      this.filters.push(new Map([["field", "age"], ["operator", Operator.GTE], ["value", min.toString()]]));
    }
    if (max) {
      this.filters.push(new Map([["field", "age"], ["operator", Operator.LTE], ["value", max.toString()]]));
    }
    return this;
  }

  search(term: string, fields: string[] = ["name", "email"]): this {
    const searchConditions: OrCondition[] = fields.map(field => ({
      field,
      operator: Operator.CONTAINS,
      value: term
    }));

    this.filters.push(new Map([
      ["field", "search"],
      ["operator", Operator.OR],
      ["value", searchConditions]
    ]));
    return this;
  }

  sortBy(field: string, direction: OrderTypes = OrderTypes.DESC): this {
    this.order = Order.fromValues(field, direction);
    return this;
  }

  paginate(page: number, limit: number): this {
    this.page = page;
    this.limit = limit;
    return this;
  }

  build(): Criteria {
    return new Criteria(
      Filters.fromValues(this.filters),
      this.order,
      this.limit,
      this.page
    );
  }
}

// Usage
const criteria = new UserCriteriaBuilder()
  .active()
  .ageRange(18, 65)
  .search("john", ["name", "email", "phone"])
  .sortBy("createdAt", OrderTypes.DESC)
  .paginate(1, 20)
  .build();
```

### 2. **Create Domain-Specific Criteria**

```typescript
class SubscriptionCriteria {
  static expiringSoon(days: number = 7): Criteria {
    const expirationDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    
    return new Criteria(
      Filters.fromValues([
        new Map([["field", "status"], ["operator", Operator.EQUAL], ["value", "active"]]),
        new Map([["field", "expiresAt"], ["operator", Operator.LTE], ["value", expirationDate.toISOString()]])
      ]),
      Order.asc("expiresAt")
    );
  }

  static eligibleForRenewal(): Criteria {
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    
    return new Criteria(
      Filters.fromValues([
        new Map([["field", "status"], ["operator", Operator.EQUAL], ["value", "active"]]),
        new Map([["field", "expiresAt"], ["operator", Operator.LTE], ["value", thirtyDaysFromNow.toISOString()]]),
        new Map([["field", "autoRenew"], ["operator", Operator.EQUAL], ["value", "false"]])
      ]),
      Order.asc("expiresAt")
    );
  }
}
```

### 3. **Test Criteria Logic Separately**

```typescript
describe("UserCriteriaBuilder", () => {
  it("should build active adult users criteria", () => {
    const criteria = new UserCriteriaBuilder()
      .active()
      .ageRange(18)
      .sortBy("name", OrderTypes.ASC)
      .build();

    expect(criteria.hasFilters()).toBe(true);
    expect(criteria.filters.filters).toHaveLength(2);
    expect(criteria.order.orderBy.value).toBe("name");
    expect(criteria.order.orderType.isAsc()).toBe(true);
  });

  it("should handle empty search gracefully", () => {
    const criteria = new UserCriteriaBuilder()
      .search("")
      .build();

    // Should not add search filter for empty term
    expect(criteria.filters.filters).toHaveLength(0);
  });
});
```

The Criteria Pattern provides a powerful, flexible way to build database queries while maintaining type safety, reusability, and testability. It's particularly valuable in complex applications where query logic represents important business rules.