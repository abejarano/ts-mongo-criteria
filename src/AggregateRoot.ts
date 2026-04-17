export abstract class AggregateRoot {
  static fromPrimitives(_data: any): AggregateRoot {
    throw new Error("fromPrimitives must be implemented in subclasses")
  }

  abstract getId(): string | undefined

  abstract toPrimitives(): any
}

export type AggregateRootClass<T extends AggregateRoot> = {
  fromPrimitives(data: any): T
}
