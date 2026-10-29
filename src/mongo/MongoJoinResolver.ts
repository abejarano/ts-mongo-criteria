import { Document } from "mongodb"
import { InvalidArgumentError } from "../AggregateRoot"
import { MongoJoin } from "./IRepository"
import { ResolvedRelation } from "./MongoRelationResolver"

export function buildJoinStages(
  joins: MongoJoin[] | undefined,
  relations: ResolvedRelation[]
): Document[] {
  if (joins === undefined) return []
  if (!Array.isArray(joins))
    throw new InvalidArgumentError("joins must be an array")

  const names = new Set(relations.map((relation) => relation.name))
  const nonEmpty = (value: unknown): value is string =>
    typeof value === "string" && value.trim().length > 0

  return joins.flatMap((join): Document[] => {
    if (!join || !nonEmpty(join.from) || !nonEmpty(join.as)) {
      throw new InvalidArgumentError(
        "A join requires non-empty from and as fields"
      )
    }
    if (join.as === "_id" || join.as.includes(".") || join.as.startsWith("$")) {
      throw new InvalidArgumentError("Invalid join alias")
    }
    if (names.has(join.as))
      throw new InvalidArgumentError(`Duplicate join alias: ${join.as}`)
    names.add(join.as)
    if (
      !Array.isArray(join.on) ||
      join.on.length === 0 ||
      join.on.some(
        (pair) =>
          !pair || !nonEmpty(pair.localField) || !nonEmpty(pair.foreignField)
      )
    ) {
      throw new InvalidArgumentError(
        "A join requires at least one non-empty field pair"
      )
    }
    if (join.many !== undefined && typeof join.many !== "boolean") {
      throw new InvalidArgumentError("Join many must be a boolean")
    }
    if (
      join.fields !== undefined &&
      (!Array.isArray(join.fields) ||
        join.fields.some((field) => !nonEmpty(field)))
    ) {
      throw new InvalidArgumentError(
        "Join fields must be an array of non-empty field names"
      )
    }

    const variables: Document = {}
    const comparisons = join.on.map((pair, index) => {
      const variable = `joinField${index}`
      variables[variable] = `$${pair.localField}`
      return { $eq: [`$${pair.foreignField}`, `$$${variable}`] }
    })
    const pipeline: Document[] = [{ $match: { $expr: { $and: comparisons } } }]
    if (join.fields !== undefined) {
      if (join.fields.length === 0) {
        pipeline.push({ $replaceWith: { $literal: {} } })
      } else {
        const projection: Document = {
          _id: join.fields.includes("_id") ? 1 : 0,
        }
        for (const field of join.fields) projection[field] = 1
        pipeline.push({ $project: projection })
      }
    }
    const lookup = {
      $lookup: { from: join.from, let: variables, pipeline, as: join.as },
    }
    return join.many
      ? [lookup]
      : [
          lookup,
          {
            $set: {
              [join.as]: {
                $ifNull: [{ $arrayElemAt: [`$${join.as}`, 0] }, null],
              },
            },
          },
        ]
  })
}
