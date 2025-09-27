# 🔍 @abejarano/ts-mongodb-criteria

[![npm version](https://badge.fury.io/js/@abejarano%2Fts-mongodb-criteria.svg)](https://www.npmjs.com/package/@abejarano/ts-mongodb-criteria)
[![GitHub Package](https://img.shields.io/badge/GitHub-Package-blue.svg)](https://github.com/abejarano/ts-mongo-criteria/packages)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9+-blue.svg)](https://www.typescriptlang.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6.0+-green.svg)](https://www.mongodb.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## The Criteria Pattern

The Criteria pattern is a design pattern that allows you to build database queries dynamically and programmatically,
without the need to write raw SQL.

This is a robust TypeScript library that implements the **Criteria pattern** for building MongoDB queries in a fluent,
typed, and maintainable way. Designed following **Domain-Driven Design (DDD)** and **Clean Architecture** principles.

### Main features:

- **Dynamic construction**: Enables creating queries based on conditions determined at runtime
- **Type-safe**: Especially useful in TypeScript to maintain type safety
- **Reusable**: Criteria can be combined and reused
- **Separation of concerns**: Separates query-building logic from the data model

## ✨ Main Features

- 🔒 **Fully typed** with TypeScript for maximum safety
- 🏗️ **Criteria pattern** for complex and reusable queries
- 🧩 **Fluent API** easy to use and read
- 🎯 **Compatible with MongoDB 6.0+**
- 📦 **Zero dependencies** (only peer dependencies)
- 🔄 **Automatic pagination** with complete metadata
- ⚡ **Performance optimized**
- 🧪 **Easy testing** and mocking

## 📦 Installation

```bash
# With npm
npm install @abejarano/ts-mongodb-criteria

# With yarn
yarn add @abejarano/ts-mongodb-criteria

# With pnpm
pnpm add @abejarano/ts-mongodb-criteria
```

### Peer Dependencies

```bash
# Install MongoDB driver (required)
npm install mongodb@^6.0.0
```

## 🚀 Quick Start

```typescript
import {
    Criteria,
    Filters,
    Order,
    OrderTypes,
    Operator
} from '@abejarano/ts-mongodb-criteria';

// Create filters using Maps (simplified syntax)
const filters = [
    new Map([
        ["field", "status"],
        ["operator", Operator.EQUAL],
        ["value", "active"]
    ]),
    new Map([
        ["field", "age"],
        ["operator", Operator.GT],
        ["value", "18"]
    ])
];

// Create criteria with multiple filters
const criteria = new Criteria(
    Filters.fromValues(filters),
    Order.fromValues("createdAt", OrderTypes.DESC),
    20, // limit
    1   // page
);

// Use with MongoRepository
const users = await userRepository.list(criteria);
```

## 🏗️ Architecture

### Main Components

#### 1. **Criteria** - The query builder

```typescript
const criteria = new Criteria(
    filters
:
Filters,    // Set of filters created with Filters.fromValues()
    order
:
Order,        // Sorting created with Order.fromValues()
    limit ? : number,      // Result limit
    page ? : number        // Current page
)
;
```

#### 2. **Filters** - Set of filters

```typescript
const filters = [
    new Map([
        ["field", "status"],        // Field to filter
        ["operator", Operator.EQUAL], // Comparison operator
        ["value", "active"]         // Comparison value
    ])
];

const filtersObject = Filters.fromValues(filters);
```

#### 3. **Order** - Sorting

```typescript
// Create sorting
const order = Order.fromValues("createdAt", OrderTypes.DESC);

// Or use static methods
const ascOrder = Order.asc("name");
const descOrder = Order.desc("price");
const noOrder = Order.none();
```

## 🔧 Available Operators

| Operator       | Description           | MongoDB Equivalent |
|----------------|-----------------------|--------------------|
| `EQUAL`        | Exact equality        | `$eq`              |
| `NOT_EQUAL`    | Inequality            | `$ne`              |
| `GT`           | Greater than          | `$gt`              |
| `GTE`          | Greater than or equal | `$gte`             |
| `LT`           | Less than             | `$lt`              |
| `LTE`          | Less than or equal    | `$lte`             |
| `CONTAINS`     | Contains text         | `$regex`           |
| `NOT_CONTAINS` | Does not contain text | `$not: { $regex }` |

## 📋 Advanced Examples

### Multiple Filters

```typescript
const filters = [
    new Map([
        ["field", "category"],
        ["operator", Operator.EQUAL],
        ["value", "electronics"]
    ]),
    new Map([
        ["field", "price"],
        ["operator", Operator.LTE],
        ["value", "999.99"]
    ]),
    new Map([
        ["field", "name"],
        ["operator", Operator.CONTAINS],
        ["value", "smartphone"]
    ])
];

const criteria = new Criteria(
    Filters.fromValues(filters),
    Order.fromValues("price", OrderTypes.ASC),
    10,
    1
);
```

### Custom Sorting

```typescript
// Sort by creation date descending
const order = Order.fromValues("createdAt", OrderTypes.DESC);

// Sort by price ascending
const priceOrder = Order.fromValues("price", OrderTypes.ASC);

// No specific sorting
const noOrder = Order.none();

// Convenience methods
const descOrder = Order.desc("createdAt");
const ascOrder = Order.asc("name");
```

### Pagination

```typescript
const filters = [
    new Map([
        ["field", "status"],
        ["operator", Operator.EQUAL],
        ["value", "active"]
    ])
];

const criteria = new Criteria(
    Filters.fromValues(filters),
    Order.fromValues("createdAt", OrderTypes.DESC),
    10, // 10 elements per page
    2   // page 2
);

const result = await repository.list(criteria);
const paginatedResult = await repository.paginate(result);

console.log(paginatedResult);
// {
//   results: [...],
//   count: 150,
//   nextPag: 3
// }
```

## 🏛️ Repository Implementation

```typescript
import {
    MongoRepository,
    Criteria,
    Filters,
    Order,
    OrderTypes,
    Operator,
    AggregateRoot
} from '@abejarano/ts-mongodb-criteria';

class User extends AggregateRoot {
    constructor(
        private id: string,
        private name: string,
        private email: string,
        private status: 'active' | 'inactive',
        private age: number,
        private createdAt: Date
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
            age: this.age,
            createdAt: this.createdAt
        };
    }

    // Getters
    getName(): string {
        return this.name;
    }

    getEmail(): string {
        return this.email;
    }

    getStatus(): 'active' | 'inactive' {
        return this.status;
    }

    getAge(): number {
        return this.age;
    }

    getCreatedAt(): Date {
        return this.createdAt;
    }

    // Business methods
    isActive(): boolean {
        return this.status === 'active';
    }

    isAdult(): boolean {
        return this.age >= 18;
    }
}

interface UsersListRequest {
    status?: string;
    minAge?: number;
    searchTerm?: string;
    page?: number;
    perPage?: number;
}

class UserRepository extends MongoRepository<User> {
    collectionName(): string {
        return 'users';
    }

    async list(criteria: Criteria): Promise<User[]> {
        // Specific implementation using MongoCriteriaConverter
        return this.searchByCriteria(criteria);
    }

    async findActiveUsers(page: number = 1, limit: number = 10): Promise<Paginate<User>> {
        const filters = [
            new Map([
                ["field", "status"],
                ["operator", Operator.EQUAL],
                ["value", "active"]
            ])
        ];

        const criteria = new Criteria(
            Filters.fromValues(filters),
            Order.fromValues("createdAt", OrderTypes.DESC),
            limit,
            page
        );

        const users = await this.list(criteria);
        return this.paginate(users);
    }

    async searchUsers(searchTerm: string): Promise<User[]> {
        const filters = [
            new Map([
                ["field", "name"],
                ["operator", Operator.CONTAINS],
                ["value", searchTerm]
            ])
        ];

        const criteria = new Criteria(
            Filters.fromValues(filters),
            Order.asc("name")
        );

        return this.list(criteria);
    }
}

// Example Use Case following your pattern
export class FetchUsersList {
    constructor(private readonly userRepository: UserRepository) {
    }

    async run(req: UsersListRequest): Promise<Paginate<User>> {
        return this.userRepository.list(this.prepareCriteria(req));
    }

    private prepareCriteria(req: UsersListRequest): Criteria {
        const filters = [];

        // Status filter
        if (req.status) {
            filters.push(
                new Map([
                    ["field", "status"],
                    ["operator", Operator.EQUAL],
                    ["value", req.status],
                ])
            );
        }

        // Minimum age filter
        if (req.minAge) {
            filters.push(
                new Map([
                    ["field", "age"],
                    ["operator", Operator.GTE],
                    ["value", req.minAge.toString()],
                ])
            );
        }

        // Search term filter
        if (req.searchTerm) {
            filters.push(
                new Map([
                    ["field", "name"],
                    ["operator", Operator.CONTAINS],
                    ["value", req.searchTerm],
                ])
            );
        }

        return new Criteria(
            Filters.fromValues(filters),
            Order.fromValues("createdAt", OrderTypes.DESC),
            Number(req.perPage || 10),
            Number(req.page || 1)
        );
    }
}
```

## ⚡ Performance and Best Practices

### Recommended Indexes

```javascript
// MongoDB shell
db.users.createIndex({"status": 1, "createdAt": -1});
db.products.createIndex({"category": 1, "price": 1});
db.orders.createIndex({"userId": 1, "status": 1, "createdAt": -1});
```

### Query Optimization

```typescript
// ✅ Good: Use specific limits and efficient filters
const filters = [
    new Map([["field", "status"], ["operator", Operator.EQUAL], ["value", "active"]]),
    new Map([["field", "category"], ["operator", Operator.EQUAL], ["value", "premium"]]),
    new Map([["field", "name"], ["operator", Operator.CONTAINS], ["value", "search_term"]])
];

const criteria = new Criteria(
    Filters.fromValues(filters),
    Order.fromValues("createdAt", OrderTypes.DESC),
    20,
    1
);

// ❌ Avoid: Queries without limits or very broad filters
const badCriteria = new Criteria(
    Filters.fromValues([]), // No filters
    Order.none()            // No limit or pagination
);

// ✅ Good: Specific filters first (more selective)
const optimizedFilters = [
    // Equality filters first (more selective)
    new Map([["field", "userId"], ["operator", Operator.EQUAL], ["value", "12345"]]),
    new Map([["field", "status"], ["operator", Operator.EQUAL], ["value", "active"]]),

    // Range filters after
    new Map([["field", "createdAt"], ["operator", Operator.GTE], ["value", "2024-01-01"]]),

    // Text filters last (less selective)
    new Map([["field", "description"], ["operator", Operator.CONTAINS], ["value", "keyword"]])
];
```

## 🔧 Configuration

### Required Environment Variables

The library uses `MongoClientFactory` which requires the following environment variables:

```bash
# .env
MONGO_USER=your_user
MONGO_PASS=your_password
MONGO_SERVER=your_server.mongodb.net
MONGO_DB=your_database
```

### MongoDB Client Configuration

```typescript
// MongoClientFactory automatically reads environment variables
// and builds the URI: mongodb+srv://${MONGO_USER}:${MONGO_PASS}@${MONGO_SERVER}/${MONGO_DB}

// No additional configuration needed, just make sure you have the environment variables
import {MongoClientFactory} from '@abejarano/ts-mongodb-criteria';

// Client connects automatically when needed
const client = await MongoClientFactory.createClient();

// Close connection when necessary
await MongoClientFactory.closeClient();
```

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the project
2. Create a branch for your feature (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'feat: Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Conventional Commits

We use [Conventional Commits](https://conventionalcommits.org/) to automatically generate releases:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `style:` - Format, spaces, etc.
- `refactor:` - Code refactoring
- `test:` - Add tests
- `chore:` - Maintenance tasks

## 📋 Roadmap

- [ ] Support for MongoDB aggregations
- [ ] Query Builder with fluent syntax
- [ ] Query cache
- [ ] Metrics and logging
- [ ] Transaction support
- [ ] Schema validation

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more details.

## 👨‍💻 Author

**Ángel Bejarano** - [angel.bejarano@jaspesoft.com](mailto:angel.bejarano@jaspesoft.com)

---

⭐️ If you like this project, give it a star on GitHub!
