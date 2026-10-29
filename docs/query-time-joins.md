# Joins configurables por consulta

La opción `joins` permite consultar datos de cualquier colección MongoDB comparando uno o varios pares de campos. No es necesario declarar una relación en `relations()` ni crear un `AggregateRoot` para la colección destino.

## Ejemplo: asignaciones de profesores

Para buscar asignaciones que coincidan por usuario, núcleo y año escolar:

```typescript
import { MongoJoin, Order } from "@abejarano/ts-mongodb-criteria"

const assignmentJoin: MongoJoin = {
  from: "teacher_assignments",
  as: "assignment",
  on: [
    { localField: "userId", foreignField: "userId" },
    { localField: "scopeId", foreignField: "nucleusId" },
    { localField: "schoolYear", foreignField: "schoolYear" },
  ],
  fields: ["disciplines"],
  many: false,
}

const professors = await repository.many(
  { profile: "professor", active: true },
  {
    sort: [Order.desc("schoolYear"), Order.asc("createdAt")],
    joins: [assignmentJoin],
  }
)
```

Cada par compara un campo del documento principal (`localField`) con uno de la colección destino (`foreignField`). Todos los pares deben coincidir. En este ejemplo, el documento recibido por `fromPrimitives()` incluye `assignment: { disciplines: [...] }` si hay coincidencia, o `assignment: null` si no la hay.

## Contrato

```typescript
interface MongoJoinField {
  localField: string
  foreignField: string
}

interface MongoJoin {
  from: string
  as: string
  on: MongoJoinField[]
  fields?: string[]
  many?: boolean
}
```

| Opción   | Uso                                                                                                              |
| -------- | ---------------------------------------------------------------------------------------------------------------- |
| `from`   | Nombre de la colección destino.                                                                                  |
| `as`     | Campo del documento raíz donde se entrega el resultado.                                                          |
| `on`     | Uno o más pares de campos; se combinan con AND.                                                                  |
| `fields` | Campos del destino que se quieren devolver. Si se omite, devuelve el documento completo.                         |
| `many`   | `false` por defecto: primer documento o `null`. Con `true`: array de documentos, o `[]` si no hay coincidencias. |

La proyección devuelve exactamente los campos solicitados: `_id` solo se incluye si aparece en `fields`. Un array `fields: []` devuelve documentos vacíos. Los nombres de colección, alias y campos deben ser cadenas no vacías; `on` debe contener al menos un par. Los alias no pueden repetirse, coincidir con una relación seleccionada, ser `_id`, contener `.` ni comenzar por `$`. Una configuración inválida produce `InvalidArgumentError`.

Si existen varias coincidencias con `many: false`, se toma la primera sin garantía de orden. Los valores se comparan con la semántica de igualdad de MongoDB, sin conversión de tipos: por ejemplo, un string y un `ObjectId` no son equivalentes automáticamente.

## Recibir el resultado en el agregado

El resultado del join es un documento MongoDB sin hidratar, no una instancia de `AggregateRoot`. El agregado principal debe conservar o transformar el alias en `fromPrimitives()` para que esté disponible al consumidor. Por ejemplo, dentro de la clase del agregado:

```typescript
static fromPrimitives(data: Record<string, unknown>): Professor {
  const assignment = data.assignment as
    | { disciplines: string[] }
    | null
    | undefined

  return new Professor(
    String(data.name),
    assignment?.disciplines ?? []
  )
}
```

El constructor y los demás campos dependen del modelo de la aplicación. Si la consulta no solicita el join, `assignment` puede ser `undefined`; si lo solicita y no encuentra coincidencias, será `null`. Con `many: true`, el alias contiene un array de documentos.

## Otras operaciones y relaciones

La misma configuración funciona con las tres operaciones de lectura:

```typescript
const professor = await repository.one({ userId }, { joins: [assignmentJoin] })
const professors = await repository.many(
  { active: true },
  { joins: [assignmentJoin] }
)
const page = await repository.list(criteria, { joins: [assignmentJoin] })
```

Se pueden solicitar varios joins y combinarlos con `relations` en las mismas opciones, siempre con alias distintos. Las relaciones declaradas siguen devolviendo entidades hidratadas; los joins devuelven documentos sin hidratar. Los joins son de lectura: la aplicación mantiene y persiste los campos usados para la unión.

El repositorio aplica el filtro, orden, límite y paginación disponibles antes de los joins. Por tanto, no se puede filtrar ni ordenar la página por los campos obtenidos mediante el join; el conteo de `list` tampoco depende de ellos. Para mejorar el rendimiento, crea un índice apropiado en los campos de la colección destino, por ejemplo `{ userId: 1, nucleusId: 1, schoolYear: 1 }` para la consulta anterior.
