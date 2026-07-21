export abstract class AggregateRoot {
  private aggregateId?: string

  getId(): string | undefined {
    return this.aggregateId
  }

  assignId(mongoId: string): void {
    if (this.aggregateId !== undefined) {
      throw new Error("AGGREGATE_ID_ALREADY_ASSIGNED")
    }

    this.aggregateId = mongoId
  }

  abstract toPrimitives(): any
}

export type AggregateRootClass<T extends AggregateRoot> = {
  fromPrimitives(data: Record<string, unknown>): T
}
