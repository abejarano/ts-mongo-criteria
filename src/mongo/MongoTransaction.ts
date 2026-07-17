import { ClientSession } from "mongodb"
import { MongoClientFactory } from "./MongoClientFactory"

const sessions = new WeakMap<MongoTransaction, ClientSession>()

/**
 * Context passed to repository writes that belong to the same MongoDB transaction.
 */
export class MongoTransaction {
  private constructor(session: ClientSession) {
    sessions.set(this, session)
  }

  /**
   * Runs the callback in a MongoDB transaction and releases its session afterwards.
   */
  public static async run<T>(
    callback: (transaction: MongoTransaction) => Promise<T>
  ): Promise<T> {
    const client = await MongoClientFactory.createClient()
    const session = client.startSession()
    const transaction = new MongoTransaction(session)

    try {
      return await session.withTransaction(() => callback(transaction))
    } finally {
      await session.endSession()
    }
  }

  /** @internal Retrieves the driver session used by repository implementations. */
  public static sessionFor(
    transaction?: MongoTransaction
  ): ClientSession | undefined {
    return transaction ? sessions.get(transaction) : undefined
  }
}
