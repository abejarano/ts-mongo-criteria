# 🔍 @abejarano/ts-mongodb-criteria

[![npm version](https://badge.fury.io/js/@abejarano%2Fts-mongodb-criteria.svg)](https://www.npmjs.com/package/@abejarano/ts-mongodb-criteria)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9+-blue.svg)](https://www.typescriptlang.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6.0+-green.svg)](https://www.mongodb.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Una librería TypeScript robusta que implementa el **patrón Criteria** para construir consultas MongoDB de forma fluida, tipada y mantenible. Diseñada siguiendo principios de **Domain-Driven Design (DDD)** y **Clean Architecture**.

## ✨ Características principales

- 🔒 **Completamente tipado** con TypeScript para máxima seguridad
- 🏗️ **Patrón Criteria** para consultas complejas y reutilizables
- 🧩 **API fluida** fácil de usar y leer
- 🎯 **Compatible con MongoDB 6.0+** 
- 📦 **Zero dependencies** (solo peer dependencies)
- 🔄 **Paginación automática** con metadata completa
- ⚡ **Optimizado para performance** 
- 🧪 **Fácil testing** y mocking

## 📦 Instalación

```bash
# Con npm
npm install @abejarano/ts-mongodb-criteria

# Con yarn
yarn add @abejarano/ts-mongodb-criteria

# Con pnpm
pnpm add @abejarano/ts-mongodb-criteria
```

### Peer Dependencies

```bash
# Instalar MongoDB driver (requerido)
npm install mongodb@^6.0.0
```

## 🚀 Uso rápido

```typescript
import { 
  Criteria, 
  Filters, 
  Order,
  OrderTypes,
  Operator
} from '@abejarano/ts-mongodb-criteria';

// Crear filtros usando Maps (sintaxis simplificada)
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

// Crear criteria con filtros múltiples
const criteria = new Criteria(
  Filters.fromValues(filters),
  Order.fromValues("createdAt", OrderTypes.DESC),
  20, // limit
  1   // page
);

// Usar con MongoRepository
const users = await userRepository.list(criteria);
```

## 🏗️ Arquitectura

### Componentes principales

#### 1. **Criteria** - El constructor de consultas
```typescript
const criteria = new Criteria(
  filters: Filters,    // Conjunto de filtros creado con Filters.fromValues()
  order: Order,        // Ordenamiento creado con Order.fromValues()
  limit?: number,      // Límite de resultados
  page?: number        // Página actual
);
```

#### 2. **Filters** - Conjunto de filtros
```typescript
const filters = [
  new Map([
    ["field", "status"],        // Campo a filtrar
    ["operator", Operator.EQUAL], // Operador de comparación
    ["value", "active"]         // Valor de comparación
  ])
];

const filtersObject = Filters.fromValues(filters);
```

#### 3. **Order** - Ordenamiento
```typescript
// Crear ordenamiento
const order = Order.fromValues("createdAt", OrderTypes.DESC);

// O usar métodos estáticos
const ascOrder = Order.asc("name");
const descOrder = Order.desc("price");
const noOrder = Order.none();
```

## 🔧 Operadores disponibles

| Operador | Descripción | MongoDB Equivalent |
|----------|-------------|-------------------|
| `EQUAL` | Igualdad exacta | `$eq` |
| `NOT_EQUAL` | Desigualdad | `$ne` |
| `GT` | Mayor que | `$gt` |
| `GTE` | Mayor o igual que | `$gte` |
| `LT` | Menor que | `$lt` |
| `LTE` | Menor o igual que | `$lte` |
| `CONTAINS` | Contiene texto | `$regex` |
| `NOT_CONTAINS` | No contiene texto | `$not: { $regex }` |

## 📋 Ejemplos avanzados

### Filtros múltiples
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

### Ordenamiento personalizado
```typescript
// Ordenar por fecha de creación descendente
const order = Order.fromValues("createdAt", OrderTypes.DESC);

// Ordenar por precio ascendente
const priceOrder = Order.fromValues("price", OrderTypes.ASC);

// Sin ordenamiento específico
const noOrder = Order.none();

// Métodos de conveniencia
const descOrder = Order.desc("createdAt");
const ascOrder = Order.asc("name");
```

### Paginación
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
  10, // 10 elementos por página
  2   // página 2
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

## 🏛️ Implementación de Repository

```typescript
import { MongoRepository, Criteria, Filters, Order, OrderTypes, Operator, AggregateRoot } from '@abejarano/ts-mongodb-criteria';

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
  getName(): string { return this.name; }
  getEmail(): string { return this.email; }
  getStatus(): 'active' | 'inactive' { return this.status; }
  getAge(): number { return this.age; }
  getCreatedAt(): Date { return this.createdAt; }

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
    // Implementación específica usando MongoCriteriaConverter
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

// Ejemplo de Use Case siguiendo tu patrón
export class FetchUsersList {
  constructor(private readonly userRepository: UserRepository) {}

  async run(req: UsersListRequest): Promise<Paginate<User>> {
    return this.userRepository.list(this.prepareCriteria(req));
  }

  private prepareCriteria(req: UsersListRequest): Criteria {
    const filters = [];

    // Filtro por status
    if (req.status) {
      filters.push(
        new Map([
          ["field", "status"],
          ["operator", Operator.EQUAL],
          ["value", req.status],
        ])
      );
    }

    // Filtro por edad mínima
    if (req.minAge) {
      filters.push(
        new Map([
          ["field", "age"],
          ["operator", Operator.GTE],
          ["value", req.minAge.toString()],
        ])
      );
    }

    // Filtro por término de búsqueda
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

## ⚡ Performance y mejores prácticas

### Índices recomendados
```javascript
// MongoDB shell
db.users.createIndex({ "status": 1, "createdAt": -1 });
db.products.createIndex({ "category": 1, "price": 1 });
db.orders.createIndex({ "userId": 1, "status": 1, "createdAt": -1 });
```

### Optimización de consultas
```typescript
// ✅ Bueno: Usar límites específicos y filtros eficientes
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

// ❌ Evitar: Consultas sin límite o filtros muy amplios
const badCriteria = new Criteria(
  Filters.fromValues([]), // Sin filtros
  Order.none()            // Sin límite ni paginación
);

// ✅ Bueno: Filtros específicos primero (más selectivos)
const optimizedFilters = [
  // Filtros de igualdad primero (más selectivos)
  new Map([["field", "userId"], ["operator", Operator.EQUAL], ["value", "12345"]]),
  new Map([["field", "status"], ["operator", Operator.EQUAL], ["value", "active"]]),
  
  // Filtros de rango después
  new Map([["field", "createdAt"], ["operator", Operator.GTE], ["value", "2024-01-01"]]),
  
  // Filtros de texto al final (menos selectivos)
  new Map([["field", "description"], ["operator", Operator.CONTAINS], ["value", "keyword"]])
];
```

## 🔧 Configuración

### Variables de entorno requeridas

La librería usa `MongoClientFactory` que requiere las siguientes variables de entorno:

```bash
# .env
MONGO_USER=tu_usuario
MONGO_PASS=tu_password
MONGO_SERVER=tu_servidor.mongodb.net
MONGO_DB=tu_base_de_datos
```

### Configuración del cliente MongoDB

```typescript
// El MongoClientFactory automáticamente lee las variables de entorno
// y construye la URI: mongodb+srv://${MONGO_USER}:${MONGO_PASS}@${MONGO_SERVER}/${MONGO_DB}

// No necesitas configuración adicional, solo asegúrate de tener las variables de entorno
import { MongoClientFactory } from '@abejarano/ts-mongodb-criteria';

// El cliente se conecta automáticamente cuando es necesario
const client = await MongoClientFactory.createClient();

// Cerrar conexión cuando sea necesario
await MongoClientFactory.closeClient();
```

## 🤝 Contribuir

Las contribuciones son bienvenidas! Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'feat: Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

### Conventional Commits

Usamos [Conventional Commits](https://conventionalcommits.org/) para generar automáticamente releases:

- `feat:` - Nueva funcionalidad
- `fix:` - Corrección de bug
- `docs:` - Documentación
- `style:` - Formato, espacios, etc.
- `refactor:` - Refactoring de código
- `test:` - Añadir tests
- `chore:` - Tareas de mantenimiento

## 📋 Roadmap

- [ ] Soporte para agregaciones MongoDB
- [ ] Query Builder con sintaxis fluida
- [ ] Caché de consultas
- [ ] Métricas y logging
- [ ] Soporte para transacciones
- [ ] Validación de esquemas

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo [LICENSE](LICENSE) para más detalles.

## 👨‍💻 Autor

**Ángel Bejarano** - [angel.bejarano@jaspesoft.com](mailto:angel.bejarano@jaspesoft.com)

---

⭐️ Si te gusta este proyecto, ¡dale una estrella en GitHub!
