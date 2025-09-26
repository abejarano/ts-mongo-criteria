import { ValueObject } from "../valueObject/ValueObject";

export class OrderBy extends ValueObject<string> {
  constructor(readonly value: string) {
    super(value);
  }

  static create(value: string): OrderBy {
    return new OrderBy(value);
  }

  getValue(): string {
    return this.value;
  }
}
