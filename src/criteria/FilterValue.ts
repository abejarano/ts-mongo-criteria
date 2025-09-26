import { StringValueObject } from "../valueObject/StringValueObject";

export class FilterValue extends StringValueObject {
  constructor(value: string) {
    super(value);
  }
}
