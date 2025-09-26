import { MongoClient } from "mongodb";

export class MongoClientFactory {
  private static client: MongoClient | null = null;

  /**
   * Obtiene o crea una instancia de MongoClient.
   * Reutiliza la conexión si ya existe.
   */
  static async createClient(): Promise<MongoClient> {
    if (!MongoClientFactory.client) {
      MongoClientFactory.client =
        await MongoClientFactory.createAndConnectClient();
    }

    return MongoClientFactory.client;
  }

  /**
   * Cierra la conexión a MongoDB.
   */
  static async closeClient(): Promise<void> {
    if (MongoClientFactory.client) {
      await MongoClientFactory.client.close();
      MongoClientFactory.client = null; // Limpia la instancia
    }
  }

  /**
   * Crea y conecta una nueva instancia de MongoClient.
   */
  private static async createAndConnectClient(): Promise<MongoClient> {
    const MONGO_PASS = process.env.MONGO_PASS;
    const MONGO_USER = process.env.MONGO_USER;
    const MONGO_DB = process.env.MONGO_DB;
    const MONGO_SERVER = process.env.MONGO_SERVER;

    if (!MONGO_PASS || !MONGO_USER || !MONGO_DB || !MONGO_SERVER) {
      throw new Error("Missing MongoDB environment variables.");
    }

    const uri = `mongodb+srv://${MONGO_USER}:${MONGO_PASS}@${MONGO_SERVER}/${MONGO_DB}?retryWrites=true&w=majority`;

    const client = new MongoClient(uri, { ignoreUndefined: true });

    try {
      await client.connect();
      return client;
    } catch (error) {
      throw error;
    }
  }
}
