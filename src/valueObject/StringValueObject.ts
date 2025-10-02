import { ValueObject } from "./ValueObject"
import { InvalidArgumentError } from "../exceptions/InvalidArgumentError.exception"

export class StringValueObject extends ValueObject<string> {
  constructor(readonly value: any) {
    super(value)
    this.ensureStringIsNotEmpty()
  }

  static create(value: string): StringValueObject {
    return new StringValueObject(value)
  }

  getValue(): string {
    return String(this.value)
  }

  private ensureStringIsNotEmpty(): void {
    if (typeof this.value !== "object" && this.value.length < 1) {
      throw new InvalidArgumentError("String should have a length")
    }
  }
}
