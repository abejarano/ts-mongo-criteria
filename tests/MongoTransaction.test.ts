import { MongoClientFactory } from "../src/mongo/MongoClientFactory"
import { MongoTransaction } from "../src/mongo/MongoTransaction"

jest.mock("../src/mongo/MongoClientFactory", () => ({
  MongoClientFactory: {
    createClient: jest.fn(),
  },
}))

describe("MongoTransaction", () => {
  it("runs the callback through the driver transaction and closes the session", async () => {
    const session = {
      withTransaction: jest.fn(async (callback) => callback()),
      endSession: jest.fn(),
    }
    ;(MongoClientFactory.createClient as jest.Mock).mockResolvedValue({
      startSession: jest.fn().mockReturnValue(session),
    })

    const result = await MongoTransaction.run(async () => "committed")

    expect(result).toBe("committed")
    expect(session.withTransaction).toHaveBeenCalledTimes(1)
    expect(session.endSession).toHaveBeenCalledTimes(1)
  })

  it("closes the session when the transaction fails", async () => {
    const error = new Error("write failed")
    const session = {
      withTransaction: jest.fn(async (callback) => callback()),
      endSession: jest.fn(),
    }
    ;(MongoClientFactory.createClient as jest.Mock).mockResolvedValue({
      startSession: jest.fn().mockReturnValue(session),
    })

    await expect(
      MongoTransaction.run(async () => {
        throw error
      })
    ).rejects.toThrow(error)

    expect(session.endSession).toHaveBeenCalledTimes(1)
  })
})
