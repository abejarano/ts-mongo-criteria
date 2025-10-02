import { FilterField } from "./FilterField"
import { FilterOperator } from "./FilterOperator"
import { FilterValue, OrCondition } from "./FilterValue"
import { InvalidArgumentError } from "../exceptions/InvalidArgumentError.exception"

export class Filter {
  readonly field: FilterField
  readonly operator: FilterOperator
  readonly value: FilterValue

  constructor(
    field: FilterField,
    operator: FilterOperator,
    value: FilterValue
  ) {
    this.field = field
    this.operator = operator
    this.value = value
  }

  static fromValues(
    values: Map<string, string | string[] | OrCondition[]>
  ): Filter {
    const field = values.get("field")
    const operator = values.get("operator")
    const value = values.get("value")

    if (!field || !operator || value === undefined) {
      throw new InvalidArgumentError(`The filter is invalid`)
    }

    return new Filter(
      new FilterField(field as string),
      FilterOperator.fromValue(operator as string),
      new FilterValue(value)
    )
  }
}
