import { StringValueObject } from "../valueObject"
import { Operator } from "./FilterOperator"

export interface OrCondition {
  field: string
  operator: Operator
  value: string
}

export class FilterValue extends StringValueObject {
  constructor(value: string | string[] | OrCondition[]) {
    if (
      Array.isArray(value) &&
      value.length > 0 &&
      typeof value[0] === "object"
    ) {
      // Handle OrCondition[]
      super(JSON.stringify(value))
    } else if (Array.isArray(value)) {
      // Handle string[]
      super(value.join(","))
    } else {
      // Handle string
      super(value as string)
    }
    this._originalValue = value
  }

  private _originalValue: string | string[] | OrCondition[]

  get isOrConditions(): boolean {
    return (
      Array.isArray(this._originalValue) &&
      this._originalValue.length > 0 &&
      typeof this._originalValue[0] === "object"
    )
  }

  get asOrConditions(): OrCondition[] {
    if (this.isOrConditions) {
      return this._originalValue as OrCondition[]
    }
    throw new Error("Value is not an OrCondition array")
  }
}
