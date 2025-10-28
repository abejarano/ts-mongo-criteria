import { Criteria, Filter, Filters, Operator, Order } from "../criteria"
import { OrCondition } from "../criteria/FilterValue"

type MongoFilterOperator =
  | "$eq"
  | "$ne"
  | "$gt"
  | "$lt"
  | "$regex"
  | "$lte"
  | "$gte"
  | "$or"

type MongoFilterBetween = {
  [p: string]: { $gte: MongoFilterValue; $lte: MongoFilterValue }
}
type MongoFilterValue = boolean | string | number | Date
type MongoFilterOperation = {
  [operator in MongoFilterOperator]?: MongoFilterValue
}
type MongoFilter =
  | { [field: string]: MongoFilterOperation }
  | { [field: string]: { $not: MongoFilterOperation } }
  | { $or: any[] }
type MongoDirection = 1 | -1
type MongoSort = { [field: string]: MongoDirection }

export interface MongoQuery {
  filter: MongoFilter
  sort: MongoSort
  skip: number
  limit: number
}

interface TransformerFunction<T, K> {
  (value: T): K
}

export class MongoCriteriaConverter {
  private filterTransformers: Map<
    Operator,
    TransformerFunction<Filter, MongoFilter | MongoFilterBetween>
  >

  constructor() {
    this.filterTransformers = new Map<
      Operator,
      TransformerFunction<Filter, MongoFilter | MongoFilterBetween>
    >([
      [Operator.EQUAL, this.equalFilter],
      [Operator.NOT_EQUAL, this.notEqualFilter],
      [Operator.GT, this.greaterThanFilter],
      [Operator.LT, this.lowerThanFilter],
      [Operator.CONTAINS, this.containsFilter],
      [Operator.NOT_CONTAINS, this.notContainsFilter],
      [Operator.GTE, this.greaterThanOrEqualFilter],
      [Operator.LTE, this.lowerThanOrEqualFilter],
      [Operator.BETWEEN, this.betweenFilter],
      [Operator.OR, this.orFilter],
    ])
  }

  public convert(criteria: Criteria): MongoQuery {
    return {
      filter: criteria.hasFilters()
        ? this.generateFilter(criteria.filters)
        : {},
      sort: criteria.order.hasOrder()
        ? this.generateSort(criteria.order)
        : { _id: -1 },
      skip: criteria.offset || 0,
      limit: criteria.limit || 0,
    }
  }

  protected generateFilter(filters: Filters): MongoFilter {
    const filter = filters.filters.map((filter) => {
      const transformer = this.filterTransformers.get(filter.operator.value)

      if (!transformer) {
        throw Error(`Unexpected operator value ${filter.operator.value}`)
      }

      return transformer(filter)
    })

    return Object.assign({}, ...filter)
  }

  protected generateSort(order: Order): MongoSort {
    return <MongoSort>{
      [order.orderBy.value === "id" ? "_id" : order.orderBy.value]:
        order.orderType.isAsc() ? 1 : -1,
    }
  }

  private equalFilter(filter: Filter): MongoFilter {
    return { [filter.field.value]: { $eq: filter.value.value } }
  }

  private notEqualFilter(filter: Filter): MongoFilter {
    return { [filter.field.value]: { $ne: filter.value.value } }
  }

  private greaterThanFilter(filter: Filter): MongoFilter {
    return { [filter.field.value]: { $gt: filter.value.value } }
  }

  private greaterThanOrEqualFilter(filter: Filter): MongoFilter {
    return { [filter.field.value]: { $gte: filter.value.value } }
  }

  private lowerThanOrEqualFilter(filter: Filter): MongoFilter {
    return { [filter.field.value]: { $lte: filter.value.value } }
  }

  private lowerThanFilter(filter: Filter): MongoFilter {
    return { [filter.field.value]: { $lt: filter.value.value } }
  }

  private containsFilter(filter: Filter): MongoFilter {
    return { [filter.field.value]: { $regex: filter.value.value } }
  }

  private notContainsFilter(filter: Filter): MongoFilter {
    return {
      [filter.field.value]: { $not: { $regex: filter.value.value } },
    }
  }

  private orFilter(filter: Filter): MongoFilter {
    if (!filter.value.isOrConditions) {
      throw new Error("OR operator requires an array of OrCondition objects")
    }

    const conditions = filter.value.asOrConditions
    const orConditions = conditions.map((condition) => {
      switch (condition.operator) {
        case Operator.CONTAINS:
          return { [condition.field]: { $regex: condition.value } }
        case Operator.EQUAL:
          return { [condition.field]: { $eq: condition.value } }
        case Operator.NOT_EQUAL:
          return { [condition.field]: { $ne: condition.value } }
        case Operator.GT:
          return { [condition.field]: { $gt: condition.value } }
        case Operator.LT:
          return { [condition.field]: { $lt: condition.value } }
        case Operator.GTE:
          return { [condition.field]: { $gte: condition.value } }
        case Operator.LTE:
          return { [condition.field]: { $lte: condition.value } }
        case Operator.NOT_CONTAINS:
          return { [condition.field]: { $not: { $regex: condition.value } } }
        default:
          throw new Error(
            `Unsupported operator in OR condition: ${condition.operator}`
          )
      }
    })

    return { $or: orConditions }
  }

  private betweenFilter(filter: Filter): MongoFilterBetween {
    if (!filter.value.isBetween) {
      throw new Error(
        "BETWEEN operator requires an object with start and end values."
      )
    }

    const { start, end } = filter.value.asBetween

    return {
      [filter.field.value]: {
        $gte: start,
        $lte: end,
      },
    }
  }
}
