# Reference Relations (Explicit Selection)

`MongoRepository` resolves references only when the caller explicitly asks for them via the `relations` option. The relation is declared on the `AggregateRoot` class, not on the repository.

This keeps the query efficient by default (plain `find` / `findOne`) and avoids pulling related documents you don't need.

Two kinds of declaration are supported:

| Declaración                                                                             | Cardinalidad                         | Quién guarda la FK               |
| --------------------------------------------------------------------------------------- | ------------------------------------ | -------------------------------- |
| `{ customer: CustomerAggregateRoot }`                                                   | MANY_TO_ONE / ONE_TO_ONE propietario | el documento raíz (`customerId`) |
| `{ brandBrain: { entity: BrandBrain, inverseOf: "accountConnectionId" } }`              | ONE_TO_ONE inverso                   | el documento destino             |
| `{ brandBrains: { entity: BrandBrain, inverseOf: "accountConnectionId", many: true } }` | ONE_TO_MANY                          | el documento destino             |

## Design (breaking: 2.0.0)

- **Declaration**: in the aggregate class, not in the repository.
  `static relations(): AggregateRelations = { customer: CustomerAggregateRoot }`
- **Collection**: `CustomerAggregateRoot.collectionName()` defines the target collection; the repository no longer declares `collectionName()`.
- **Reference value**: canonical MongoDB manual reference — the related document's `_id` stored in `customerId` (ObjectId).
- **Selection**: in the query options: `{ relations: [{ entity: CustomerAggregateRoot, fields: ["name","cnpj"] }] }`.
- **Hydration**: the library resolves the reference and passes a hydrated `CustomerAggregateRoot` instance to `fromPrimitives()` (or `null` if missing). The root aggregate can then use `data.customer.getId()`. For `many: true` it passes an array (`[]` when there are no matches).

## Convention

```text
customer -> customerId -> customers._id -> customer
```

The relation key (`customer`) determines the local reference field (`customerId`). The class (`CustomerAggregateRoot`) determines the collection and identity (`_id` via `getId()`).

## Declaration on AggregateRoot

```typescript
export class CustomerAggregateRoot extends AggregateRoot {
  static collectionName(): string {
    return "customers"
  }
  static relations(): AggregateRelations {
    return {}
  }

  static fromPrimitives(data: Record<string, unknown>): CustomerAggregateRoot {
    return new CustomerAggregateRoot(data.name, data.cnpj)
  }

  toPrimitives(): any {
    return { id: this.getId(), name: this.name, cnpj: this.cnpj }
  }
}

export class OrderAggregateRoot extends AggregateRoot {
  static collectionName(): string {
    return "orders"
  }
  static relations(): AggregateRelations {
    return { customer: CustomerAggregateRoot }
  }

  static fromPrimitives(data: Record<string, unknown>): OrderAggregateRoot {
    return new OrderAggregateRoot(
      data.number,
      data.status,
      data.customerId,
      data.customer ?? null
    )
  }

  toPrimitives(): any {
    return { id: this.getId(), number: this.number, status: this.status }
  }
}

export class OrderRepository extends MongoRepository<OrderAggregateRoot> {
  constructor() {
    super(OrderAggregateRoot)
  }

  protected async ensureIndexes(collection: Collection): Promise<void> {
    await collection.createIndex({ customerId: 1 })
  }
}
```

Notes:

- The repository no longer defines `relations()` or `collectionName()` (it delegates to the aggregate).
- If you want to declare a relation with a different local field name, use a different key (`buyer: CustomerAggregateRoot` → `buyerId`).
- A class can only appear once as a **propietaria**; si necesitas dos cardinalidades de la misma clase usa relaciones inversas con `name` (ver [inverse relations](#inverse-relations-one_to_one-inverso-y-one_to_many)).

## Explicit query-time selection

```typescript
// Without relations -> find/findOne, zero aggregation
const plain = await repository.one({ urn: "ORD-001" })

// Full related document
const withCustomer = await repository.one(
  { urn: "ORD-001" },
  { relations: [{ entity: CustomerAggregateRoot }] }
)

// Only selected fields (plus `_id`) — projection inside $lookup
const partial = await repository.one(
  { urn: "ORD-001" },
  { relations: [{ entity: CustomerAggregateRoot, fields: ["name", "cnpj"] }] }
)

// Multiple selected relations
const page = await repository.list(criteria, {
  relations: [
    { entity: CustomerAggregateRoot, fields: ["name"] },
    { entity: UserAggregateRoot },
  ],
})
```

`data.customer` will be:

- `CustomerAggregateRoot` instance when a match exists (with `getId()` from `_id`); or
- `null` when the reference points to a missing document.

Only `fields` that exist on the target document are included; missing fields are omitted (MongoDB `$project` behavior). Always include `_id`: it is used for `assignId()` and is stripped from the primitives before `fromPrimitives()`.

## Canonical reference: `_id` (ObjectId)

The stored reference is the related document's `_id` (BSON `ObjectId`), not a business identifier. This aligns with MongoDB's recommended [manual reference](https://www.mongodb.com/docs/manual/reference/database-references/) pattern.

Write-time (upsert): the library derives the reference from the related entity, removes the embedded document, and writes `customerId: new ObjectId(customer.getId())`. At read-time: `localField: "customerId"` / `foreignField: "_id"` uses the always-present `_id` index.

## Pipeline (light, index-backed)

For a selected relation `customer` (no projection):

```text
$match
$limit: 1
$lookup { from: "customers", localField: "customerId", foreignField: "_id", as: "customer" }
$set { customer: { $ifNull: [{ $arrayElemAt: ["$customer", 0] }, null] } }
```

This is the simple equality `$lookup` recommended by the [`$lookup` docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/lookup/): uses the `_id` index, compatible with the slot-based execution engine (SBE), and avoids the overhead of `$expr` / `$convert`.

When `fields` is given (e.g., `fields: ["name","cnpj"]`):

```text
$lookup {
  from: "customers",
  localField: "customerId",
  foreignField: "_id",
  pipeline: [ { $project: { _id: 1, name: 1, cnpj: 1 } } ],
  as: "customer"
}
```

This is the [concise correlated subquery](https://www.mongodb.com/docs/manual/reference/operator/aggregation/lookup/) form (MongoDB 5.0+). It disables SBE (opt-in cost only when you need projection), but avoids `$convert`/`$expr` because both sides are `ObjectId`.

Performance notes from the docs:

- Filter before `$lookup` (`$match` / `$sort` / `$limit` first) so only the page's documents are joined.
- `countDocuments()` for pagination never runs `$lookup`.
- `_id` index is always present on the foreign collection.
- When `customerId` is missing or null, the simple form handles it gracefully (`null` match → `null` result).

## Missing references

A missing referenced document does not remove the base document. The resolved relation is returned as `null`:

```typescript
const result = await repository.one(
  { number: "ORD-001" },
  {
    relations: [{ entity: CustomerAggregateRoot }],
  }
)
// result.toPrimitives().customer === null
```

## Multiple relations

```typescript
static relations(): AggregateRelations {
  return {
    customer: CustomerAggregateRoot,
    seller: UserAggregateRoot,
  }
}
```

Requested via query options independently; only requested ones run `$lookup`.

## Inverse relations (ONE_TO_ONE inverso y ONE_TO_MANY)

Cuando la referencia vive en el **otro** documento declaras la relación con `inverseOf` (el campo FK de la colección destino). El `localField` pasa a ser el `_id` del root:

```typescript
export class AccountConnectionAggregateRoot extends AggregateRoot {
  static collectionName(): string {
    return "account_connections"
  }
  static relations(): AggregateRelations {
    return {
      // 1:1 inverso — como mucho un BrandBrain por conexión
      brandBrain: {
        entity: BrandBrainAggregateRoot,
        inverseOf: "accountConnectionId",
      },
      // 1:N — todos los BrandBrains de la conexión
      brandBrains: {
        entity: BrandBrainAggregateRoot,
        inverseOf: "accountConnectionId",
        many: true,
      },
    }
  }
}
```

```typescript
// ONE_TO_ONE inverso → una instancia o null
const connection = await connectionRepository.one(
  { urn },
  { relations: [{ entity: BrandBrainAggregateRoot, name: "brandBrain" }] }
)
connection.brandBrain?.getId()

// ONE_TO_MANY → array de instancias ([] si no hay)
const withChildren = await connectionRepository.one(
  { urn },
  { relations: [{ entity: BrandBrainAggregateRoot, name: "brandBrains" }] }
)
withChildren.brandBrains.map((brain) => brain.getId())
```

Pipeline generado (no hay `$set` de colapso cuando `many: true`):

```text
$lookup { from: "brand_brains", localField: "_id", foreignField: "accountConnectionId", as: "brandBrains" }
```

Notas importantes:

- `name` es **obligatorio** cuando la misma clase está declarada más de una vez; si no, la selección lanza `InvalidArgumentError` pidiendo que la desambigües.
- El campo de `inverseOf` **necesita un índice** en la colección destino (`$lookup` hace collection scan si no existe). El `_id` del root ya está indexado.
- Para que `many: false` sea un 1:1 **real** la unicidad la garantiza un índice único sobre ese campo:
  ```typescript
  // en BrandBrainRepository.ensureIndexes
  await collection.createIndex({ accountConnectionId: 1 }, { unique: true })
  ```
  Sin él, `$arrayElemAt [.., 0]` elegiría el primero y escondería duplicados.
- `upsert` **no escribe** nada por las relaciones inversas: la FK pertenece al otro documento. Sólo hace `$unset` del campo si venía hidratado.

## `fromPrimitives()` responsibility (updated)

Because `MongoRelationResolver` hydrates the related aggregate, the root receives the instance directly:

```typescript
static fromPrimitives(data: any): OrderAggregateRoot {
  return new OrderAggregateRoot(
    data.number,
    data.status,
    data.customerId,
    data.customer ?? null,   // CustomerAggregateRoot instance or null
  )
}
```

This lets you call `data.customer?.getId()` immediately. The library strips `_id` from the related primitive (into `assignId`) before passing to `fromPrimitives`, so the domain never sees MongoDB's `_id`.

If you only want the identity, request `fields: []`; `fromPrimitives()` will receive `{}` and `getId()` will work.

## `upsert` — writing the reference

The library manages the reference storage automatically:

```typescript
const order = new OrderAggregateRoot("ORD-001", "active")
const customer = new CustomerAggregateRoot("Name", "CNPJ")
order.assignCustomer(customer) // or pass in constructor

await repository.upsert(order)
```

The repository:

1. Reads `entity.toPrimitives()`.
2. For each declared relation (`customer`), checks `primitives.customer` (instance / doc / `id` / `null`) or `primitives.customerId`.
3. Derives `customerId: new ObjectId(customer.getId())`.
4. Writes `$set: { ..., customerId: ObjectId(...) }` and `$unset: { customer: "" }` (removes embedded legacy docs).
5. If the related instance has no id, throws `InvalidArgumentError`.

You can also set the reference directly as string/`ObjectId`:

```typescript
// primitives from domain with no instance
order.toPrimitives() // => { number: "ORD-001", customerId: "665f..." }
```

The library normalizes `customerId` to `ObjectId` automatically.

Las relaciones inversas nunca escriben referencia: la FK vive en el documento destino, así que se guarda con el `upsert` **de ese** documento.

## Supported scope

- `MANY_TO_ONE` / ONE_TO_ONE propietario: `{ customer: CustomerAggregateRoot }`.
- ONE_TO_ONE inverso: `{ brandBrain: { entity, inverseOf } }`.
- `ONE_TO_MANY`: `{ brandBrains: { entity, inverseOf, many: true } }`.
- Explicit `relations` selection per query (not automatic).
- `_id`-based reference (manual reference). If you need business-id references (`id`, `code`), this version requires storing that as the `_id` of the target document or using a separate mechanism.
- `fields` projection (opt-in, requires MongoDB 5.0+ for concise form; simple form works on 3.6+).
- Hydration of related entities into domain instances (single instance or array).
- Multiple relations, including several declarations pointing to the same class (desambiguadas con `name`).
- `null` when reference missing (`[]` for `many`).
- Transactions supported (`MongoTransaction` passed in `MongoReadOptions.transaction`).
- No backward compatibility for the old automatic-resolution design.

Not supported:

- `MANY_TO_MANY`.
- Filtering by related fields (`customer.name` in `Criteria`).
- Sorting by related fields.
- Nested relations (cascade).
- Decorators / reflection.

## Migration from 1.2.0 (PR #12 automatic resolution)

If you had references stored as strings (`customerId: "customer-123"`) or using a business-id field (`foreignField: "id"`), migrate data to `ObjectId` references before using 2.0:

```javascript
db.orders.updateMany({ customerId: { $type: "string" } }, [
  { $set: { customerId: { $toObjectId: "$customerId" } } },
])
```

Then update `AggregateRoot.relations()` to reference the class (`CustomerAggregateRoot` instead of `{ collection: "customers", foreignField: "id" }`), and update queries to pass `{ relations: [{ entity: CustomerAggregateRoot }] }`.
