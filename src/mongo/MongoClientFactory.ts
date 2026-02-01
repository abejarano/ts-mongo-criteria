import { MongoClient } from "mongodb"

export class MongoClientFactory {
  private static client: MongoClient | null = null

  /**
   * Obtiene o crea una instancia de MongoClient.
   * Reutiliza la conexión si ya existe.
   */
  static async createClient(): Promise<MongoClient> {
    if (!MongoClientFactory.client) {
      MongoClientFactory.client =
        await MongoClientFactory.createAndConnectClient()
    }

    return MongoClientFactory.client
  }

  /**
   * Cierra la conexión a MongoDB.
   */
  static async closeClient(): Promise<void> {
    if (MongoClientFactory.client) {
      await MongoClientFactory.client.close()
      MongoClientFactory.client = null // Limpia la instancia
    }
  }

  /**
   * Crea y conecta una nueva instancia de MongoClient.
   */
  private static async createAndConnectClient(): Promise<MongoClient> {

    const uri = process.env.MONGO_URI

    if (!uri) {
      throw new Error(
        "MONGO_URI environment variables are missing to connect to the MongoDB server"
      )
    }

    const client = new MongoClient(process.env.MONGO_URI!, {
      ignoreUndefined: true,
    })

    try {
      await client.connect()
      return client
    } catch (error) {
      throw error
    }
  }
}
