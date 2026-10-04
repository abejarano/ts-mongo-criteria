import {
  AggregateRootClass,
  AggregateRelations,
  AggregateRelationSelection,
  InvalidArgumentError,
  AggregateRoot,
  RelationDeclaration,
  isInverseRelation,
  relationTarget,
} from "../AggregateRoot"
import { Document } from "mongodb"

export interface ResolvedRelation {
  name: string
  /** Campo del documento raíz que se usa para el match. */
  localField: string
  /** Campo del documento destino que se usa para el match. */
  foreignField: string
  /** `true` → el `$lookup` se deja como array (ONE_TO_MANY). */
  many: boolean
  target: AggregateRootClass<any>
  collection: string
  fields?: string[]
}

export class MongoRelationResolver {
  private readonly declared: AggregateRelations

  constructor(declared: AggregateRelations) {
    this.declared = declared
    this.validateDeclarations()
  }

  public resolve(
    selections?: AggregateRelationSelection[]
  ): ResolvedRelation[] {
    if (!selections || selections.length === 0) {
      return []
    }

    const resolved: ResolvedRelation[] = []
    const seenNames = new Set<string>()

    for (const selection of selections) {
      const { name, declaration } = this.findDeclaration(selection)

      if (seenNames.has(name)) {
        throw new InvalidArgumentError(
          `La relación "${name}" se pide dos veces en la misma consulta. ` +
            "Cada relación declarada se resuelve una sola vez."
        )
      }
      seenNames.add(name)

      const inverse = isInverseRelation(declaration)
      const target = relationTarget(declaration)

      resolved.push({
        name,
        // El lado que guarda la FK usa `<name>Id` → `_id`.
        // El lado inverso usa `_id` del root → el campo declarado en el destino.
        localField: inverse ? "_id" : `${name}Id`,
        foreignField: inverse ? declaration.inverseOf : "_id",
        many: inverse ? declaration.many === true : false,
        target,
        collection: target.collectionName(),
        fields: selection.fields,
      })
    }

    return resolved
  }

  public buildStages(relations: ResolvedRelation[]): Document[] {
    return relations.flatMap((relation): Document[] => {
      const lookup: Document = { $lookup: this.lookupStage(relation) }

      // ONE_TO_MANY conserva el array del $lookup tal cual.
      if (relation.many) {
        return [lookup]
      }

      return [
        lookup,
        {
          $set: {
            [relation.name]: {
              $ifNull: [{ $arrayElemAt: [`$${relation.name}`, 0] }, null],
            },
          },
        },
      ]
    })
  }

  public hydrateRelated(
    document: Document,
    relations: ResolvedRelation[]
  ): Document {
    const hydrated: Document = { ...document }

    for (const relation of relations) {
      const raw = document[relation.name]

      if (relation.many) {
        hydrated[relation.name] = Array.isArray(raw)
          ? raw
              .map((item) => this.hydrateOne(item as Document, relation.target))
              .filter((entity): entity is AggregateRoot => entity !== null)
          : []
        continue
      }

      hydrated[relation.name] =
        raw === undefined || raw === null
          ? null
          : this.hydrateOne(raw as Document, relation.target)
    }

    return hydrated
  }

  /**
   * Busca la declaración pedida. Si `selection.name` viene, desambigua;
   * si no, la clase debe estar declarada exactamente una vez.
   */
  private findDeclaration(selection: AggregateRelationSelection): {
    name: string
    declaration: RelationDeclaration
  } {
    if (selection.name !== undefined) {
      const declaration = this.declared[selection.name]

      if (declaration === undefined) {
        throw new InvalidArgumentError(
          `"${selection.name}" no es una relación declarada. ` +
            `Relaciones declaradas: ${this.declaredNames()}`
        )
      }

      const target = relationTarget(declaration)

      if (target !== selection.entity) {
        throw new InvalidArgumentError(
          `La relación "${selection.name}" apunta a ${target.name}, ` +
            `no a ${selection.entity.name}`
        )
      }

      return { name: selection.name, declaration }
    }

    const matches = Object.entries(this.declared).filter(
      ([, declaration]) => relationTarget(declaration) === selection.entity
    )

    if (matches.length === 0) {
      throw new InvalidArgumentError(
        `${selection.entity.name} no es una relación declarada. ` +
          `Relaciones declaradas: ${this.declaredNames()}`
      )
    }

    if (matches.length > 1) {
      const names = matches.map(([name]) => `"${name}"`).join(", ")

      throw new InvalidArgumentError(
        `${selection.entity.name} está declarada más de una vez (${names}). ` +
          "Usa `name` en la selección para elegir cuál."
      )
    }

    return { name: matches[0][0], declaration: matches[0][1] }
  }

  private lookupStage(relation: ResolvedRelation): Record<string, unknown> {
    const base: Record<string, unknown> = {
      from: relation.collection,
      localField: relation.localField,
      foreignField: relation.foreignField,
      as: relation.name,
    }

    if (relation.fields !== undefined) {
      base.pipeline = [{ $project: this.projection(relation.fields) }]
    }

    return base
  }

  private hydrateOne(
    raw: Document,
    target: AggregateRootClass<any>
  ): AggregateRoot | null {
    const { _id, ...primitives } = raw

    if (_id === undefined) {
      return null
    }

    const entity = target.fromPrimitives(primitives)

    entity.assignId(_id.toString())

    return entity
  }

  private projection(fields: string[]): Document {
    const projection: Document = { _id: 1 }

    for (const field of fields) {
      projection[field] = 1
    }

    return projection
  }

  private validateDeclarations(): void {
    for (const [name, declaration] of Object.entries(this.declared)) {
      if (!isInverseRelation(declaration)) {
        continue
      }

      if (
        typeof declaration.inverseOf !== "string" ||
        declaration.inverseOf.length === 0
      ) {
        throw new InvalidArgumentError(
          `La relación inversa "${name}" necesita un campo \`inverseOf\` no vacío.`
        )
      }

      if (
        declaration.many !== undefined &&
        typeof declaration.many !== "boolean"
      ) {
        throw new InvalidArgumentError(
          `La relación inversa "${name}" declara \`many\` con un valor no booleano.`
        )
      }
    }
  }

  private declaredNames(): string {
    return (
      Object.keys(this.declared)
        .map((name) => `"${name}"`)
        .join(", ") || "(ninguna)"
    )
  }
}
