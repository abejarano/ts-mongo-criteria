export abstract class AggregateRoot {
  abstract getId(): string | undefined
  abstract toPrimitives(): any

  static fromPrimitives(_data: any): AggregateRoot {
    throw new Error("fromPrimitives must be implemented in subclasses")
  }
}

export type AggregateRootClass<T extends AggregateRoot> = {
  fromPrimitives(data: any): T
}
