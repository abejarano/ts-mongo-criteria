# 🚀 Quick Start Guide

## Table of Contents
- [Installation](#installation)
- [Your First Query (5 minutes)](#your-first-query-5-minutes)
- [Basic Concepts](#basic-concepts)
- [Common Use Cases](#common-use-cases)
- [Repository Setup](#repository-setup)
- [Next Steps](#next-steps)

## Installation

### 1. Install the Package

```bash
# Using npm
npm install @abejarano/ts-mongodb-criteria

# Using yarn
yarn add @abejarano/ts-mongodb-criteria

# Using pnpm
pnpm add @abejarano/ts-mongodb-criteria
```

### 2. Install Peer Dependencies

```bash
# MongoDB driver (required)
npm install mongodb@^6.0.0

# TypeScript (for development)
npm install -D typescript@^5.0.0
```

### 3. Setup Environment Variables

Create a `.env` file in your project root:

```bash
# .env
MONGO_USER=your_mongodb_user
MONGO_PASS=your_mongodb_password
MONGO_SERVER=your_mongodb_server.com
MONGO_DB=your_database_name

# Example for MongoDB Atlas
MONGO_USER=myapp
MONGO_PASS=secretpassword
MONGO_SERVER=cluster0.abc123.mongodb.net
MONGO_DB=production

# Example for local MongoDB
MONGO_USER=admin
MONGO_PASS=password
MONGO_SERVER=localhost:27017
MONGO_DB=development
```

## Your First Query (5 minutes)

### Step 1: Import the Library

```typescript
import {
  Criteria,
  Filters,
  Order,
  OrderTypes,
  Operator,
  MongoRepository,
  AggregateRoot
} from "@abejarano/ts-mongodb-criteria";
```

### Step 2: Create a Simple Query

```typescript
// Find all active users
const activeUsersQuery = new Criteria(
  Filters.fromValues([
    new Map([
      ["field", "status"],
      ["operator", Operator.EQUAL],
      ["value", "active"]
    ])
  ]),
  Order.desc("createdAt"),
  10, // limit to 10 results
  1   // first page
);

console.log("✅ Your first criteria created!");
```

### Step 3: Add More Filters

```typescript
// Find active users over 18 years old
const adultActiveUsers = new Criteria(
  Filters.fromValues([
    new Map([
      ["field", "status"],
      ["operator", Operator.EQUAL],
      ["value", "active"]
    ]),
    new Map([
      ["field", "age"],
      ["operator", Operator.GTE],
      ["value", "18"]
    ])
  ]),
  Order.desc("createdAt"),
  20, 1
);

console.log("✅ Multi-filter criteria created!");
```

### Step 4: Use with Repository

```typescript
// Define your entity
class User extends AggregateRoot {
  constructor(
    private id: string,
    private name: string,
    private email: string,
    private status: string,
    private age: number
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
      status: this.status,
      age: this.age
    };
  }

  // Getters
  getName(): string { return this.name; }
  getEmail(): string { return this.email; }
  getStatus(): string { return this.status; }
  getAge(): number { return this.age; }
}

// Create repository
class UserRepository extends MongoRepository<User> {
  collectionName(): string {
    return "users";
  }
}

// Use it
const userRepo = new UserRepository();
const users = await userRepo.searchByCriteria(adultActiveUsers);

console.log("✅ Query executed successfully!");
console.log(`Found ${users.length} users`);
```

## Basic Concepts

### 1. **Criteria** - The Main Query Builder

Think of `Criteria` as your complete query specification:

```typescript
const criteria = new Criteria(
  filters,    // What conditions to apply
  order,      // How to sort results  
  limit,      // How many results to return
  page        // Which page (for pagination)
);
```

### 2. **Filters** - Your Search Conditions

Filters define what you're looking for:

```typescript
const filters = [
  new Map([
    ["field", "name"],           // Which field
    ["operator", Operator.CONTAINS], // How to compare
    ["value", "john"]            // What value to compare against
  ])
];

const filtersObject = Filters.fromValues(filters);
```

### 3. **Order** - How to Sort Results

```typescript
// Sort by creation date (newest first)
const order = Order.desc("createdAt");

// Sort by name (A-Z)
const order = Order.asc("name");

// No specific sorting
const order = Order.none();
```

### 4. **Operators** - How to Compare Values

| Operator | Description | Example |
|----------|-------------|---------|
| `EQUAL` | Exact match | `status = "active"` |
| `CONTAINS` | Text contains | `name contains "john"` |
| `GT/GTE` | Greater than (or equal) | `age > 18` |
| `LT/LTE` | Less than (or equal) | `price <= 100` |
| `OR` | Multiple conditions | `name OR email contains "john"` |

## Common Use Cases

### 1. **Simple User Lookup**

```typescript
// Find user by email
const userByEmail = new Criteria(
  Filters.fromValues([
    new Map([["field", "email"], ["operator", Operator.EQUAL], ["value", "user@example.com"]])
  ]),
  Order.none()
);
```

### 2. **Age Range Filter**

```typescript
// Find users between 18 and 65
const workingAgeUsers = new Criteria(
  Filters.fromValues([
    new Map([["field", "age"], ["operator", Operator.GTE], ["value", "18"]]),
    new Map([["field", "age"], ["operator", Operator.LTE], ["value", "65"]])
  ]),
  Order.asc("age")
);
```

### 3. **Text Search Across Multiple Fields**

```typescript
import { OrCondition } from "@abejarano/ts-mongodb-criteria";

// Search for "john" in name, email, or phone
const searchConditions: OrCondition[] = [
  { field: "name", operator: Operator.CONTAINS, value: "john" },
  { field: "email", operator: Operator.CONTAINS, value: "john" },
  { field: "phone", operator: Operator.CONTAINS, value: "john" }
];

const multiFieldSearch = new Criteria(
  Filters.fromValues([
    new Map<string, string | string[] | OrCondition[]>([
      ["field", "search"],
      ["operator", Operator.OR],
      ["value", searchConditions]
    ])
  ]),
  Order.desc("createdAt")
);
```

### 4. **Paginated Results**

```typescript
// Get page 2, with 20 items per page
const paginatedUsers = new Criteria(
  Filters.fromValues([
    new Map([["field", "status"], ["operator", Operator.EQUAL], ["value", "active"]])
  ]),
  Order.desc("createdAt"),
  20, // items per page
  2   // page number
);
```

### 5. **Price Range with Category**

```typescript
// Electronics under $500
const affordableElectronics = new Criteria(
  Filters.fromValues([
    new Map([["field", "category"], ["operator", Operator.EQUAL], ["value", "electronics"]]),
    new Map([["field", "price"], ["operator", Operator.LTE], ["value", "500"]])
  ]),
  Order.asc("price")
);
```

## Repository Setup

### 1. **Basic Repository Pattern**

```typescript
// Your domain entity
class Product extends AggregateRoot {
  constructor(
    private id: string,
    private name: string,
    private price: number,
    private category: string,
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
      price: this.price,
      category: this.category,
      status: this.status
    };
  }

  // Business methods
  isAvailable(): boolean {
    return this.status === "active";
  }

  isOnSale(): boolean {
    return this.price < 100;
  }
}

// Repository implementation
class ProductRepository extends MongoRepository<Product> {
  collectionName(): string {
    return "products";
  }

  // Custom query methods
  async findAvailableProducts(): Promise<Product[]> {
    const criteria = new Criteria(
      Filters.fromValues([
        new Map([["field", "status"], ["operator", Operator.EQUAL], ["value", "active"]])
      ]),
      Order.desc("createdAt")
    );

    return this.searchByCriteria(criteria);
  }

  async findByCategory(category: string, page: number = 1): Promise<Product[]> {
    const criteria = new Criteria(
      Filters.fromValues([
        new Map([["field", "category"], ["operator", Operator.EQUAL], ["value", category]])
      ]),
      Order.asc("name"),
      20,
      page
    );

    return this.searchByCriteria(criteria);
  }

  async searchProducts(searchTerm: string): Promise<Product[]> {
    const searchConditions: OrCondition[] = [
      { field: "name", operator: Operator.CONTAINS, value: searchTerm },
      { field: "description", operator: Operator.CONTAINS, value: searchTerm }
    ];

    const criteria = new Criteria(
      Filters.fromValues([
        new Map<string, string | string[] | OrCondition[]>([
          ["field", "search"],
          ["operator", Operator.OR],
          ["value", searchConditions]
        ])
      ]),
      Order.desc("popularity")
    );

    return this.searchByCriteria(criteria);
  }
}
```

### 2. **Using the Repository**

```typescript
async function examples() {
  const productRepo = new ProductRepository();

  // Find all available products
  const availableProducts = await productRepo.findAvailableProducts();
  console.log(`Found ${availableProducts.length} available products`);

  // Find electronics
  const electronics = await productRepo.findByCategory("electronics");
  console.log(`Found ${electronics.length} electronics`);

  // Search for smartphones
  const smartphones = await productRepo.searchProducts("smartphone");
  console.log(`Found ${smartphones.length} smartphones`);
}
```

### 3. **Use Case Implementation**

```typescript
// Following Clean Architecture / DDD patterns
interface ProductSearchRequest {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  searchTerm?: string;
  page?: number;
  limit?: number;
}

class SearchProductsUseCase {
  constructor(private readonly productRepository: ProductRepository) {}

  async execute(request: ProductSearchRequest): Promise<Product[]> {
    const criteria = this.buildCriteria(request);
    return this.productRepository.searchByCriteria(criteria);
  }

  private buildCriteria(request: ProductSearchRequest): Criteria {
    const filters: Array<Map<string, string | string[] | OrCondition[]>> = [];

    // Only show active products
    filters.push(
      new Map([["field", "status"], ["operator", Operator.EQUAL], ["value", "active"]])
    );

    // Category filter
    if (request.category) {
      filters.push(
        new Map([["field", "category"], ["operator", Operator.EQUAL], ["value", request.category]])
      );
    }

    // Price range
    if (request.minPrice) {
      filters.push(
        new Map([["field", "price"], ["operator", Operator.GTE], ["value", request.minPrice.toString()]])
      );
    }

    if (request.maxPrice) {
      filters.push(
        new Map([["field", "price"], ["operator", Operator.LTE], ["value", request.maxPrice.toString()]])
      );
    }

    // Text search
    if (request.searchTerm) {
      const searchConditions: OrCondition[] = [
        { field: "name", operator: Operator.CONTAINS, value: request.searchTerm },
        { field: "description", operator: Operator.CONTAINS, value: request.searchTerm },
        { field: "brand", operator: Operator.CONTAINS, value: request.searchTerm }
      ];

      filters.push(
        new Map<string, string | string[] | OrCondition[]>([
          ["field", "search"],
          ["operator", Operator.OR],
          ["value", searchConditions]
        ])
      );
    }

    return new Criteria(
      Filters.fromValues(filters),
      Order.desc("popularity"),
      request.limit || 20,
      request.page || 1
    );
  }
}

// Usage
const searchUseCase = new SearchProductsUseCase(productRepo);

const searchRequest: ProductSearchRequest = {
  category: "electronics",
  maxPrice: 500,
  searchTerm: "smartphone",
  page: 1,
  limit: 10
};

const results = await searchUseCase.execute(searchRequest);
```

## Quick Tips

### 💡 **Do's**

```typescript
// ✅ Use meaningful filter organization
const filters = [
  // Most selective filters first
  new Map([["field", "userId"], ["operator", Operator.EQUAL], ["value", "12345"]]),
  new Map([["field", "status"], ["operator", Operator.EQUAL], ["value", "active"]]),
  // Less selective filters after
  new Map([["field", "category"], ["operator", Operator.EQUAL], ["value", "electronics"]])
];

// ✅ Use proper pagination
const criteria = new Criteria(filters, order, 20, 1); // 20 items, page 1

// ✅ Use enum constants
new Map([["field", "status"], ["operator", Operator.EQUAL], ["value", "active"]])
```

### ❌ **Don'ts**

```typescript
// ❌ Don't use magic strings
new Map([["field", "status"], ["operator", "="], ["value", "active"]])

// ❌ Don't create queries without limits for large datasets
const criteria = new Criteria(filters, order); // No pagination = potential memory issues

// ❌ Don't put expensive text searches first
const badFilters = [
  new Map([["field", "description"], ["operator", Operator.CONTAINS], ["value", "keyword"]]), // Expensive
  new Map([["field", "id"], ["operator", Operator.EQUAL], ["value", "123"]]) // Should be first
];
```

## Next Steps

### 📚 **Learn More**
- [Complete API Reference](../README.md#-api-reference)
- [Operators Guide](./operators.md)
- [Criteria Pattern Deep Dive](./criteria-pattern.md)
- [Performance Optimization](./performance.md)

### 🎯 **Try These Examples**
1. Build a user search with multiple filters
2. Create a product catalog with categories and price ranges
3. Implement a blog post search with tags and dates
4. Build an order management system with status filters

### 🧪 **Test Your Knowledge**

Try building these queries:

1. **Blog Posts**: Find published posts from last month containing "javascript"
2. **E-commerce**: Find electronics under $200 with rating >= 4.0
3. **Users**: Find active premium users or users who spent > $1000
4. **Orders**: Find pending orders from the last 7 days with value > $50

### 🔗 **Helpful Resources**

- [MongoDB Query Optimization](https://docs.mongodb.com/manual/core/query-optimization/)
- [TypeScript Best Practices](https://typescript-eslint.io/rules/)
- [Domain-Driven Design](https://domainlanguage.com/ddd/)

### 💬 **Get Help**

- 🐛 [Report Issues](https://github.com/abejarano/ts-mongo-criteria/issues)
- 💡 [Feature Requests](https://github.com/abejarano/ts-mongo-criteria/discussions)
- 📧 [Contact Support](mailto:angel.bejarano@jaspesoft.com)

---

🎉 **Congratulations!** You're now ready to build powerful, type-safe MongoDB queries with the Criteria pattern. Start with simple queries and gradually build up to more complex scenarios as you become comfortable with the library.

Remember: The goal is to write clean, maintainable, and performant database queries that represent your business logic clearly. The Criteria pattern helps you achieve all of these goals while maintaining type safety throughout your application.