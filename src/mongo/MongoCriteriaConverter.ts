import { Criteria, Filter, Filters, Operator, Order } from "../criteria";

type MongoFilterOperator =
  | "$eq"
  | "$ne"
  | "$gt"
  | "$lt"
  | "$regex"
  | "$lte"
  | "$gte";

type MongoFilterBetween = {
  [p: string]: { $gte: Date; $lte: Date };
};
type MongoFilterValue = boolean | string | number;
type MongoFilterOperation = {
  [operator in MongoFilterOperator]?: MongoFilterValue;
};
type MongoFilter =
  | { [field: string]: MongoFilterOperation }
  | { [field: string]: { $not: MongoFilterOperation } };
type MongoDirection = 1 | -1;
type MongoSort = { [field: string]: MongoDirection };

export interface MongoQuery {
  filter: MongoFilter;
  sort: MongoSort;
  skip: number;
  limit: number;
}

interface TransformerFunction<T, K> {
  (value: T): K;
}

export class MongoCriteriaConverter {
  private filterTransformers: Map<
    Operator,
    TransformerFunction<Filter, MongoFilter | MongoFilterBetween>
  >;

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
    ]);
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
    };
  }

  protected generateFilter(filters: Filters): MongoFilter {
    const filter = filters.filters.map((filter) => {
      const transformer = this.filterTransformers.get(filter.operator.value);

      if (!transformer) {
        throw Error(`Unexpected operator value ${filter.operator.value}`);
      }

      return transformer(filter);
    });

    return Object.assign({}, ...filter);
  }

  protected generateSort(order: Order): MongoSort {
    return <MongoSort>{
      [order.orderBy.value === "id" ? "_id" : order.orderBy.value]:
        order.orderType.isAsc() ? 1 : -1,
    };
  }

  private equalFilter(filter: Filter): MongoFilter {
    return { [filter.field.value]: { $eq: filter.value.value } };
  }

  private notEqualFilter(filter: Filter): MongoFilter {
    return { [filter.field.value]: { $ne: filter.value.value } };
  }

  private greaterThanFilter(filter: Filter): MongoFilter {
    return { [filter.field.value]: { $gt: filter.value.value } };
  }

  private greaterThanOrEqualFilter(filter: Filter): MongoFilter {
    return { [filter.field.value]: { $gte: filter.value.value } };
  }

  private lowerThanOrEqualFilter(filter: Filter): MongoFilter {
    return { [filter.field.value]: { $lte: filter.value.value } };
  }

  private lowerThanFilter(filter: Filter): MongoFilter {
    return { [filter.field.value]: { $lt: filter.value.value } };
  }

  private containsFilter(filter: Filter): MongoFilter {
    return { [filter.field.value]: { $regex: filter.value.value } };
  }

  private notContainsFilter(filter: Filter): MongoFilter {
    return {
      [filter.field.value]: { $not: { $regex: filter.value.value } },
    };
  }

  private dateRangeFilter(filter: Filter): MongoFilterBetween {
    if (!filter.value.value.startDate || !filter.value.value.endDate) {
      throw new Error(
        "Start and end date are required for date range filtering.",
      );
    }

    return {
      [filter.field.toString()]: {
        $gte: new Date(filter.value.value.startDate),
        $lte: new Date(filter.value.value.endDate),
      },
    };
  }
}
