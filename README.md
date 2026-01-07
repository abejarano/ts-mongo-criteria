# 🔍 TypeScript MongoDB Criteria Pattern

[![npm version](https://badge.fury.io/js/@abejarano%2Fts-mongodb-criteria.svg)](https://www.npmjs.com/package/@abejarano/ts-mongodb-criteria)
[![GitHub Package](https://img.shields.io/badge/GitHub-Package-blue.svg)](https://github.com/abejarano/ts-mongo-criteria/packages)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9+-blue.svg)](https://www.typescriptlang.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6.0+-green.svg)](https://www.mongodb.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![Tests](https://img.shields.io/badge/Tests-30%2F30%20passing-brightgreen.svg)](#testing)

> A robust, type-safe implementation of the **Criteria Pattern** for MongoDB queries in TypeScript. Build complex database queries dynamically with a fluent, composable API designed following Domain-Driven Design (DDD) and Clean Architecture principles.

## 📚 Table of Contents

- [🎯 Overview](#-overview)
- [✨ Key Features](#-key-features)
- [📦 Installation](#-installation)
- [🚀 Quick Start](#-quick-start)
- [📖 Documentation](#-documentation)
- [🧪 Testing](#-testing)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

## 🎯 Overview

The **Criteria Pattern** is a powerful design pattern that enables dynamic query construction without writing raw database queries. This library provides a type-safe, MongoDB-specific implementation that helps you:

- **Build queries dynamically** based on runtime conditions
- **Maintain type safety** throughout your query construction
- **Compose and reuse** query components across your application
- **Separate concerns** between query logic and data models
- **Test queries easily** with a mockable interface

### What is the Criteria Pattern?

The Criteria pattern encapsulates query logic in a structured, object-oriented way. Instead of building query strings or objects directly, you compose `Criteria` objects that represent your search intentions. This approach provides flexibility, reusability, testability, and type safety.

## ✨ Key Features

### 🔒 **Type Safety First**

- Full TypeScript support with strict typing
- Compile-time validation of query structure
- IntelliSense support for all operations

### 🧩 **Flexible Query Building**

- Support for all common MongoDB operators (EQUAL, NOT_EQUAL, GT, GTE, LT, LTE, CONTAINS, NOT_CONTAINS)
- **NEW**: OR operator for complex logical combinations
- Composable filters that can be combined and reused
- Dynamic query construction based on runtime conditions

### 📊 **Advanced Querying**

```typescript
// Simple equality
{ status: { $eq: "active" } }

// Complex OR conditions
{ $or: [
  { name: { $regex: "john" } },
  { email: { $regex: "john" } }
]}

// Range queries
{ age: { $gte: 18 }, price: { $lte: 999.99 } }
```

### 🎯 **MongoDB Optimized**

- Native MongoDB 6.0+ support
- Efficient query generation
- Automatic index-friendly query structure

### 📦 **Zero Dependencies**

- Only peer dependencies (MongoDB driver)
- Lightweight bundle size

### 🏗️ **Clean Architecture**

- Repository pattern implementation
- Domain-driven design principles
- Separation of concerns

## 📦 Installation

```bash
# Using npm
npm install @abejarano/ts-mongodb-criteria

# Using yarn
yarn add @abejarano/ts-mongodb-criteria

# Using pnpm
pnpm add @abejarano/ts-mongodb-criteria
```

### Peer Dependencies

```bash
# MongoDB driver (required)
npm install mongodb@^6.0.0

# TypeScript (for development)
npm install -D typescript@^5.0.0
```

### System Requirements

- **Node.js**: 20.0.0 or higher
- **TypeScript**: 5.0.0 or higher (for development)
- **MongoDB**: 6.0.0 or higher

## 🚀 Quick Start

```typescript
import {
  Criteria,
  Filters,
  Order,
  Operator,
  MongoRepository,
} from "@abejarano/ts-mongodb-criteria"

// 1. Create filters using a simple Map-based syntax
const filters = [
  new Map([
    ["field", "status"],
    ["operator", Operator.EQUAL],
    ["value", "active"],
  ]),
  new Map([
    ["field", "age"],
    ["operator", Operator.GTE],
    ["value", "18"],
  ]),
]

// 2. Build criteria with filters, sorting, and pagination
const criteria = new Criteria(
  Filters.fromValues(filters),
  Order.desc("createdAt"),
  20, // limit
  1 // page
)

// 3. Use with your MongoDB repository
class UserRepository extends MongoRepository<User> {
  collectionName(): string {
    return "users"
  }
}

const userRepo = new UserRepository()
const users = await userRepo.searchByCriteria(criteria)
```

MongoRepository provides ready-to-use public methods for repositories that extend it:
- `list(criteria, fieldsToExclude?)` for paginated queries
- `one(filter)` to fetch a single entity
- `upsert(entity)` to persist an aggregate

**Your First Query in 30 Seconds:**

```typescript
// Find active users over 18, sorted by creation date
const activeAdultUsers = new Criteria(
  Filters.fromValues([
    new Map([
      ["field", "status"],
      ["operator", Operator.EQUAL],
      ["value", "active"],
    ]),
    new Map([
      ["field", "age"],
      ["operator", Operator.GTE],
      ["value", "18"],
    ]),
  ]),
  Order.desc("createdAt"),
  10, // Get 10 results
  1 // First page
)

const results = await repository.list(activeAdultUsers)
```

## 📖 Documentation

### 📖 Complete Documentation

- **[📘 Quick Start Guide](./docs/quick-start.md)** - Get up and running in minutes
- **[🏗️ Criteria Pattern Guide](./docs/criteria-pattern.md)** - Deep dive into the pattern, architecture, and theory
- **[🔧 Operators Reference](./docs/operators.md)** - Complete guide to all available operators and their usage
- **[⚡ Performance Guide](./docs/performance.md)** - Optimization strategies and best practices
- **[🔄 Migration Guide](./docs/migration.md)** - Migrate from other query systems to Criteria pattern

### 🎯 Key Concepts

#### 1. **Criteria** - The main query builder

```typescript
const criteria = new Criteria(filters, order, limit?, page?)
```

#### 2. **Filters** - Collection of filter conditions

```typescript
const filters = Filters.fromValues([...filterMaps])
```

#### 3. **Order** - Sorting specification

```typescript
const order = Order.desc("createdAt") // or Order.asc("name")
```

#### 4. **Operators** - Available filter operations

- `EQUAL`, `NOT_EQUAL` - Exact matching
- `GT`, `GTE`, `LT`, `LTE` - Range operations
- `BETWEEN` - Inclusive range with lower and upper bounds
- `CONTAINS`, `NOT_CONTAINS` - Text search
- `OR` - Logical OR combinations

## ✅ Runtime Compatibility

This library ships dual builds (CJS + ESM) and works in both Node.js and Bun.

### 🆕 OR Operator Example

```typescript
import { OrCondition } from "@abejarano/ts-mongodb-criteria"

// Search across multiple fields
const searchConditions: OrCondition[] = [
  { field: "name", operator: Operator.CONTAINS, value: "john" },
  { field: "email", operator: Operator.CONTAINS, value: "john" },
]

const filters = [
  new Map([
    ["field", "search"],
    ["operator", Operator.OR],
    ["value", searchConditions],
  ]),
]

// Generates: { $or: [
//   { name: { $regex: "john" } },
//   { email: { $regex: "john" } }
// ]}
```

### ⏱️ BETWEEN Operator Example

```typescript
// Filter users created between two dates
const filters = [
  new Map([
    ["field", "createdAt"],
    ["operator", Operator.BETWEEN],
    ["value", { start: new Date("2024-01-01"), end: new Date("2024-01-31") }],
  ]),
]

const criteria = new Criteria(Filters.fromValues(filters), Order.none())

// Generates: { createdAt: { $gte: 2024-01-01, $lte: 2024-01-31 } }
```

## 🧪 Testing

The library includes comprehensive test coverage (30/30 tests passing).

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

### Development Setup

```bash
# Clone the repository
git clone https://github.com/abejarano/ts-mongo-criteria.git
cd ts-mongo-criteria

# Install dependencies
yarn install

# Run tests
yarn test

# Build the project
yarn build
```

### Contribution Process

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Write** tests for your changes
4. **Ensure** all tests pass (`yarn test`)
5. **Commit** using conventional commits (`git commit -m 'feat: add amazing feature'`)
6. **Push** to your branch (`git push origin feature/amazing-feature`)
7. **Open** a Pull Request

## 📄 License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.

---

## 👨‍💻 Author

**Ángel Bejarano**  
📧 [angel.bejarano@jaspesoft.com](mailto:angel.bejarano@jaspesoft.com)  
🐙 [GitHub](https://github.com/abejarano)  
🏢 [Jaspesoft](https://jaspesoft.com)

---

⭐️ **If this project helps you, please give it a star on GitHub!**

🤝 **Questions or suggestions?** Open an issue or start a discussion.

📢 **Follow us** for updates and new features!
