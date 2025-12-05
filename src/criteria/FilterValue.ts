import { StringValueObject } from "../valueObject"
import { Operator } from "./FilterOperator"

export interface OrCondition {
  field: string
  operator: Operator
  value: string
}

export type FilterPrimitive = string | number | boolean | Date

export type BetweenValue =
  | { start: FilterPrimitive; end: FilterPrimitive }
  | { startDate: FilterPrimitive; endDate: FilterPrimitive }
  | { from: FilterPrimitive; to: FilterPrimitive }

export type FilterInputValue =
  | FilterPrimitive
  | FilterPrimitive[]
  | OrCondition[]
  | BetweenValue

const isOrConditionArray = (value: unknown): value is OrCondition[] => {
  if (!Array.isArray(value) || value.length === 0) {
    return false
  }

  const candidate = value[0] as Record<string, unknown>

  return (
    typeof candidate === "object" &&
    candidate !== null &&
    "field" in candidate &&
    "operator" in candidate &&
    "value" in candidate
  )
}

const isBetweenObject = (value: unknown): value is BetweenValue => {
  if (value === null || typeof value !== "object") {
    return false
  }

  const candidate = value as Record<string, unknown>

  const hasStartEnd = "start" in candidate && "end" in candidate
  const hasStartDateEndDate = "startDate" in candidate && "endDate" in candidate
  const hasFromTo = "from" in candidate && "to" in candidate

  return hasStartEnd || hasStartDateEndDate || hasFromTo
}

const normalizeBetweenValue = (
  value: BetweenValue
): { start: FilterPrimitive; end: FilterPrimitive } => {
  if ("start" in value && "end" in value) {
    return { start: value.start, end: value.end }
  }

  if ("startDate" in value && "endDate" in value) {
    return { start: value.startDate, end: value.endDate }
  }

  return { start: value.from, end: value.to }
}

export class FilterValue extends StringValueObject {
  private readonly _originalValue: FilterInputValue

  constructor(value: FilterInputValue) {
    if (Array.isArray(value) && isOrConditionArray(value)) {
      // Handle OrCondition[]
      super(JSON.stringify(value))
    } else if (Array.isArray(value)) {
      // Handle primitive arrays (kept for backward compatibility)
      super(value.join(","))
    } else if (isBetweenObject(value)) {
      // Store serialized version but keep original reference
      super(JSON.stringify(value))
    } else {
      // Handle primitive values (string, number, boolean, Date)
      super(value as string)
    }

    this._originalValue = value
  }

  get isOrConditions(): boolean {
    return isOrConditionArray(this._originalValue)
  }

  get asOrConditions(): OrCondition[] {
    if (this.isOrConditions) {
      return this._originalValue as OrCondition[]
    }

    throw new Error("Value is not an OrCondition array")
  }

  get isBetween(): boolean {
    return isBetweenObject(this._originalValue)
  }

  get asBetween(): { start: FilterPrimitive; end: FilterPrimitive } {
    if (this.isBetween) {
      return normalizeBetweenValue(this._originalValue as BetweenValue)
    }

    throw new Error("Value is not a BETWEEN structure")
  }

  get isPrimitiveArray(): boolean {
    return Array.isArray(this._originalValue) && !this.isOrConditions
  }

  get asPrimitiveArray(): FilterPrimitive[] {
    if (this.isPrimitiveArray) {
      return this._originalValue as FilterPrimitive[]
    }

    throw new Error("Value is not an array of primitive values")
  }
}
