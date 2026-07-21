export type MongoFilterOperator =
  | "$eq"
  | "$ne"
  | "$gt"
  | "$lt"
  | "$regex"
  | "$lte"
  | "$gte"
  | "$or"
  | "$in"
  | "$nin"

export type MongoFilterBetween = {
  [p: string]: { $gte: MongoFilterValue; $lte: MongoFilterValue }
}
export type MongoFilterValue = boolean | string | number | Date
export type MongoFilterArrayValue = MongoFilterValue[]
export type MongoFilterOperation = {
  [operator in MongoFilterOperator]?: MongoFilterValue | MongoFilterArrayValue
}
export type MongoFilter =
  | { [field: string]: MongoFilterOperation }
  | { [field: string]: { $not: MongoFilterOperation } }
  | { $or: any[] }
export type MongoDirection = 1 | -1
export type MongoSort = { [field: string]: MongoDirection }
