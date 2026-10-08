import { ObjectId } from "mongodb"

/**
 * Error que lanzan las operaciones cuando un argumento no es válido.
 */
export class InvalidArgumentError extends Error {}

export interface AggregateRootClass<T extends AggregateRoot = AggregateRoot> {
  /**
   * Keeps this contract tied to the static side of an AggregateRoot class
   * without requiring its constructor to be public. Repositories hydrate
   * aggregates exclusively through fromPrimitives().
   */
  readonly prototype: T
  fromPrimitives(data: Record<string, unknown>): T
  collectionName(): string
  relations(): AggregateRelations
  readonly name?: string
}

export type AggregateRelations = Record<string, RelationDeclaration>

/**
 * Relación cuyo documento raíz **guarda** la referencia (`<name>Id` → `_id` del destino).
 * Es el caso MANY_TO_ONE / ONE_TO_ONE propietario.
 */
export type OwnedRelation = AggregateRootClass<any>

/**
 * Relación **inversa**: la referencia vive en la colección destino
 * (`inverseOf` es el campo de ese documento que apunta al `_id` del root).
 *
 * - `many: false | undefined` → ONE_TO_ONE inverso (un documento o `null`).
 * - `many: true` → ONE_TO_MANY (array de documentos, `[]` si no hay).
 */
export interface InverseRelation {
  entity: AggregateRootClass<any>
  inverseOf: string
  many?: boolean
}

export type RelationDeclaration = OwnedRelation | InverseRelation

/**
 * Retorna true si la declaración es una relación inversa.
 * Ojo: una clase AggregateRoot también es un objeto (función), por eso se
 * comprueba `inverseOf` en lugar de sólo el tipo.
 */
export function isInverseRelation(
  declaration: RelationDeclaration
): declaration is InverseRelation {
  return (
    typeof declaration === "object" &&
    declaration !== null &&
    "inverseOf" in declaration
  )
}

/**
 * Clase AggregateRoot destino de una declaración, sea propia o inversa.
 */
export function relationTarget(
  declaration: RelationDeclaration
): AggregateRootClass<any> {
  return isInverseRelation(declaration) ? declaration.entity : declaration
}

/**
 * Selección de relaciones realizada en la query.
 * `entity` es la clase AggregateRoot declarada en `relations()`.
 * `name` desambigua cuando la misma clase está declarada más de una vez
 * (por ejemplo `brandBrain` inversa 1:1 y `brandBrains` inversa 1:N).
 * `fields` lista opcional de nombres de campos extra (aparte de `_id`).
 * Si `fields` es `undefined` o `null`, se trae el documento completo.
 * Si `fields` es `[]`, sólo `_id` (identidad).
 */
export interface AggregateRelationSelection {
  entity: AggregateRootClass<any>
  fields?: string[]
  name?: string
}

/**
 * Helper para convertir un id o entidad a ObjectId en la capa de escritura.
 * Se usa dentro de MongoRepository.resolveReferences().
 */
export function referenceOf(idOrAggregate: string | AggregateRoot): ObjectId {
  if (typeof idOrAggregate === "string") return new ObjectId(idOrAggregate)
  // instanceof funciona aunque haya copias separadas del módulo
  if (idOrAggregate instanceof AggregateRoot)
    return new ObjectId(idOrAggregate.getId() ?? "")
  throw new InvalidArgumentError(
    "referenceOf esperaba un string o un AggregateRoot"
  )
}

/**
 * Retorna true si el valor parece un AggregateRoot (para validaciones ligeras).
 */
export function isAggregateRoot(value: unknown): value is AggregateRoot {
  return value instanceof AggregateRoot
}

export abstract class AggregateRoot {
  private aggregateId?: string

  getId(): string | undefined {
    return this.aggregateId
  }

  assignId(mongoId: string): void {
    if (this.aggregateId !== undefined) {
      throw new Error("AGGREGATE_ID_ALREADY_ASSIGNED")
    }

    this.aggregateId = mongoId
  }

  abstract toPrimitives(): any
}
