export abstract class AggregateRoot {
  abstract getId(): string
  abstract toPrimitives(): any
}
