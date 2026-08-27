import { AggregateRoot, AggregateRelations } from "../src/AggregateRoot"
import { MongoRelationResolver } from "../src/mongo/MongoRelationResolver"
import { ObjectId } from "mongodb"

const CUSTOMER_ID = "507f1f77bcf86cd799439011"
const SELLER_ID = "507f191e810c19729de860ea"

class CustomerAggregateRoot extends AggregateRoot {
  constructor(private readonly name: string = "") {
    super()
  }

  toPrimitives(): any {
    return { id: this.getId(), name: this.name }
  }

  static collectionName(): string {
    return "customers"
  }

  static relations(): AggregateRelations {
    return {}
  }

  static fromPrimitives(data: Record<string, any>): CustomerAggregateRoot {
    return new CustomerAggregateRoot(data.name)
  }
}

class SellerAggregateRoot extends AggregateRoot {
  toPrimitives(): any {
    return { id: this.getId() }
  }

  static collectionName(): string {
    return "sellers"
  }

  static relations(): AggregateRelations {
    return {}
  }

  static fromPrimitives(): SellerAggregateRoot {
    return new SellerAggregateRoot()
  }
}

class OrderAggregateRoot extends AggregateRoot {
  toPrimitives(): any {
    return {}
  }

  static collectionName(): string {
    return "orders"
  }

  static relations(): AggregateRelations {
    return { customer: CustomerAggregateRoot, seller: SellerAggregateRoot }
  }

  static fromPrimitives(): OrderAggregateRoot {
    return new OrderAggregateRoot()
  }
}

class BrandBrainAggregateRoot extends AggregateRoot {
  constructor(private readonly level: string = "basic") {
    super()
  }

  toPrimitives(): any {
    return { id: this.getId(), level: this.level }
  }

  static collectionName(): string {
    return "brand_brains"
  }

  static relations(): AggregateRelations {
    return {}
  }

  static fromPrimitives(data: Record<string, any>): BrandBrainAggregateRoot {
    return new BrandBrainAggregateRoot(data.level)
  }
}

class ConnectionAggregateRoot extends AggregateRoot {
  toPrimitives(): any {
    return {}
  }

  static collectionName(): string {
    return "account_connections"
  }

  static relations(): AggregateRelations {
    return {
      brandBrain: {
        entity: BrandBrainAggregateRoot,
        inverseOf: "accountConnectionId",
      },
      brandBrains: {
        entity: BrandBrainAggregateRoot,
        inverseOf: "accountConnectionId",
        many: true,
      },
    }
  }

  static fromPrimitives(): ConnectionAggregateRoot {
    return new ConnectionAggregateRoot()
  }
}

describe("MongoRelationResolver", () => {
  let resolver: MongoRelationResolver

  beforeEach(() => {
    resolver = new MongoRelationResolver(OrderAggregateRoot.relations())
  })

  describe("resolve", () => {
    it("returns no relations when nothing is selected", () => {
      expect(resolver.resolve()).toEqual([])
      expect(resolver.resolve([])).toEqual([])
    })

    it("maps the selected class to its declared name and collection", () => {
      const resolved = resolver.resolve([{ entity: CustomerAggregateRoot }])

      expect(resolved).toEqual([
        {
          name: "customer",
          localField: "customerId",
          foreignField: "_id",
          many: false,
          target: CustomerAggregateRoot,
          collection: "customers",
          fields: undefined,
        },
      ])
    })

    it("keeps the requested fields", () => {
      const resolved = resolver.resolve([
        { entity: CustomerAggregateRoot, fields: ["name"] },
      ])

      expect(resolved[0].fields).toEqual(["name"])
    })

    it("throws when the class is not declared", () => {
      class OtherAggregateRoot extends AggregateRoot {
        toPrimitives(): any {
          return {}
        }
        static collectionName(): string {
          return "others"
        }
        static relations(): AggregateRelations {
          return {}
        }
        static fromPrimitives(): OtherAggregateRoot {
          return new OtherAggregateRoot()
        }
      }

      expect(() => resolver.resolve([{ entity: OtherAggregateRoot }])).toThrow(
        /no es una relación declarada/
      )
    })

    it("throws when the same class is selected twice", () => {
      expect(() =>
        resolver.resolve([
          { entity: CustomerAggregateRoot },
          { entity: CustomerAggregateRoot },
        ])
      ).toThrow(/se pide dos veces/)
    })

    it("allows selecting two different declared relations", () => {
      const resolved = resolver.resolve([
        { entity: CustomerAggregateRoot },
        { entity: SellerAggregateRoot },
      ])

      expect(resolved.map((relation) => relation.name)).toEqual([
        "customer",
        "seller",
      ])
    })
  })

  describe("buildStages", () => {
    it("uses the plain equality $lookup when no fields are requested", () => {
      const stages = resolver.buildStages(
        resolver.resolve([{ entity: CustomerAggregateRoot }])
      )

      expect(stages).toEqual([
        {
          $lookup: {
            from: "customers",
            localField: "customerId",
            foreignField: "_id",
            as: "customer",
          },
        },
        {
          $set: {
            customer: { $ifNull: [{ $arrayElemAt: ["$customer", 0] }, null] },
          },
        },
      ])
      expect(stages[0].$lookup.pipeline).toBeUndefined()
    })

    it("adds a $project pipeline when fields are requested", () => {
      const stages = resolver.buildStages(
        resolver.resolve([
          { entity: CustomerAggregateRoot, fields: ["name", "cnpj"] },
        ])
      )

      expect(stages[0].$lookup.pipeline).toEqual([
        { $project: { _id: 1, name: 1, cnpj: 1 } },
      ])
    })

    it("projects only _id when fields is empty", () => {
      const stages = resolver.buildStages(
        resolver.resolve([{ entity: CustomerAggregateRoot, fields: [] }])
      )

      expect(stages[0].$lookup.pipeline).toEqual([{ $project: { _id: 1 } }])
    })

    it("emits a lookup/set pair per relation", () => {
      const stages = resolver.buildStages(
        resolver.resolve([
          { entity: CustomerAggregateRoot },
          { entity: SellerAggregateRoot },
        ])
      )

      expect(stages).toHaveLength(4)
      expect(stages[2].$lookup.from).toBe("sellers")
      expect(stages[3].$set).toHaveProperty("seller")
    })
  })

  describe("hydrateRelated", () => {
    it("instantiates the related aggregate and assigns its _id", () => {
      const selected = resolver.resolve([{ entity: CustomerAggregateRoot }])
      const hydrated = resolver.hydrateRelated(
        {
          _id: new ObjectId(CUSTOMER_ID),
          customerId: new ObjectId(CUSTOMER_ID),
          customer: { _id: new ObjectId(CUSTOMER_ID), name: "ACME" },
        },
        selected
      )

      const customer = hydrated.customer as CustomerAggregateRoot

      expect(customer).toBeInstanceOf(CustomerAggregateRoot)
      expect(customer.getId()).toBe(CUSTOMER_ID)
    })

    it("keeps _id out of the primitives passed to fromPrimitives", () => {
      const selected = resolver.resolve([{ entity: CustomerAggregateRoot }])
      const hydrated = resolver.hydrateRelated(
        {
          _id: new ObjectId(CUSTOMER_ID),
          customer: { _id: new ObjectId(CUSTOMER_ID), name: "ACME" },
        },
        selected
      )

      expect(hydrated.customer.toPrimitives()).toEqual({
        id: CUSTOMER_ID,
        name: "ACME",
      })
    })

    it("maps a missing match to null", () => {
      const selected = resolver.resolve([{ entity: CustomerAggregateRoot }])

      expect(
        resolver.hydrateRelated(
          { _id: new ObjectId(CUSTOMER_ID), customer: null },
          selected
        ).customer
      ).toBeNull()
    })

    it("maps an absent field to null", () => {
      const selected = resolver.resolve([{ entity: CustomerAggregateRoot }])

      expect(
        resolver.hydrateRelated({ _id: new ObjectId(CUSTOMER_ID) }, selected)
          .customer
      ).toBeNull()
    })

    it("does not touch unrelated fields", () => {
      const selected = resolver.resolve([{ entity: CustomerAggregateRoot }])
      const hydrated = resolver.hydrateRelated(
        { _id: new ObjectId(CUSTOMER_ID), number: "ORD-001", customer: null },
        selected
      )

      expect(hydrated.number).toBe("ORD-001")
    })
  })

  describe("inverse relations", () => {
    let inverseResolver: MongoRelationResolver

    beforeEach(() => {
      inverseResolver = new MongoRelationResolver(
        ConnectionAggregateRoot.relations()
      )
    })

    it("matches the root _id against the declared foreign field", () => {
      const resolved = inverseResolver.resolve([
        { entity: BrandBrainAggregateRoot, name: "brandBrain" },
      ])

      expect(resolved).toEqual([
        {
          name: "brandBrain",
          localField: "_id",
          foreignField: "accountConnectionId",
          many: false,
          target: BrandBrainAggregateRoot,
          collection: "brand_brains",
          fields: undefined,
        },
      ])
    })

    it("marks many: true for ONE_TO_MANY", () => {
      const resolved = inverseResolver.resolve([
        { entity: BrandBrainAggregateRoot, name: "brandBrains" },
      ])

      expect(resolved[0].many).toBe(true)
      expect(resolved[0].foreignField).toBe("accountConnectionId")
    })

    it("throws when the class is declared twice and no name is given", () => {
      expect(() =>
        inverseResolver.resolve([{ entity: BrandBrainAggregateRoot }])
      ).toThrow(/declarada más de una vez/)
    })

    it("throws when the name does not point to the given class", () => {
      expect(() =>
        inverseResolver.resolve([
          { entity: CustomerAggregateRoot, name: "brandBrain" },
        ])
      ).toThrow(/apunta a BrandBrainAggregateRoot/)
    })

    it("collapses the array for an inverse ONE_TO_ONE", () => {
      const stages = inverseResolver.buildStages(
        inverseResolver.resolve([
          { entity: BrandBrainAggregateRoot, name: "brandBrain" },
        ])
      )

      expect(stages[0]).toEqual({
        $lookup: {
          from: "brand_brains",
          localField: "_id",
          foreignField: "accountConnectionId",
          as: "brandBrain",
        },
      })
      expect(stages[1].$set).toEqual({
        brandBrain: {
          $ifNull: [{ $arrayElemAt: ["$brandBrain", 0] }, null],
        },
      })
    })

    it("keeps the array for an inverse ONE_TO_MANY", () => {
      const stages = inverseResolver.buildStages(
        inverseResolver.resolve([
          { entity: BrandBrainAggregateRoot, name: "brandBrains" },
        ])
      )

      expect(stages).toHaveLength(1)
      expect(stages[0].$lookup.as).toBe("brandBrains")
    })

    it("projects fields inside an inverse $lookup", () => {
      const stages = inverseResolver.buildStages(
        inverseResolver.resolve([
          {
            entity: BrandBrainAggregateRoot,
            name: "brandBrains",
            fields: ["level"],
          },
        ])
      )

      expect(stages[0].$lookup.pipeline).toEqual([
        { $project: { _id: 1, level: 1 } },
      ])
    })

    it("hydrates every element of a ONE_TO_MANY result", () => {
      const selected = inverseResolver.resolve([
        { entity: BrandBrainAggregateRoot, name: "brandBrains" },
      ])
      const hydrated = inverseResolver.hydrateRelated(
        {
          _id: new ObjectId(CUSTOMER_ID),
          brandBrains: [
            { _id: new ObjectId(CUSTOMER_ID), level: "basic" },
            { _id: new ObjectId(SELLER_ID), level: "advanced" },
          ],
        },
        selected
      )

      const brains = hydrated.brandBrains as BrandBrainAggregateRoot[]

      expect(brains).toHaveLength(2)
      expect(brains[0]).toBeInstanceOf(BrandBrainAggregateRoot)
      expect(brains[0].getId()).toBe(CUSTOMER_ID)
      expect(brains[1].getId()).toBe(SELLER_ID)
    })

    it("hydrates a single instance for an inverse ONE_TO_ONE", () => {
      const selected = inverseResolver.resolve([
        { entity: BrandBrainAggregateRoot, name: "brandBrain" },
      ])
      const hydrated = inverseResolver.hydrateRelated(
        {
          _id: new ObjectId(CUSTOMER_ID),
          brandBrain: { _id: new ObjectId(SELLER_ID), level: "basic" },
        },
        selected
      )

      expect(hydrated.brandBrain).toBeInstanceOf(BrandBrainAggregateRoot)
      expect((hydrated.brandBrain as BrandBrainAggregateRoot).getId()).toBe(
        SELLER_ID
      )
    })

    it("returns an empty array when a ONE_TO_MANY has no matches", () => {
      const selected = inverseResolver.resolve([
        { entity: BrandBrainAggregateRoot, name: "brandBrains" },
      ])
      const hydrated = inverseResolver.hydrateRelated(
        { _id: new ObjectId(CUSTOMER_ID), brandBrains: [] },
        selected
      )

      expect(hydrated.brandBrains).toEqual([])
    })
  })

  describe("declaration validation", () => {
    it("rejects an inverse relation without inverseOf", () => {
      expect(
        () =>
          new MongoRelationResolver({
            broken: { entity: CustomerAggregateRoot, inverseOf: "" },
          })
      ).toThrow(/inverseOf/)
    })

    it("accepts a plain class declaration", () => {
      expect(
        () => new MongoRelationResolver({ customer: CustomerAggregateRoot })
      ).not.toThrow()
    })
  })
})
