const {
  MONGO_URI,
  MONGO_USER,
  MONGO_PASS,
  MONGO_SERVER,
  MONGO_DB,
} = process.env

const buildMongoUri = () => {
  if (MONGO_URI) return MONGO_URI

  if (!MONGO_USER || !MONGO_PASS || !MONGO_SERVER || !MONGO_DB) {
    throw new Error(
      "Missing MongoDB env vars. Provide MONGO_URI or MONGO_USER/MONGO_PASS/MONGO_SERVER/MONGO_DB."
    )
  }

  return `mongodb+srv://${MONGO_USER}:${MONGO_PASS}@${MONGO_SERVER}/${MONGO_DB}?retryWrites=true&w=majority`
}

if (!MONGO_DB) {
  throw new Error("Missing MONGO_DB environment variable.")
}

module.exports = {
  mongodb: {
    url: buildMongoUri(),
    databaseName: MONGO_DB,
    options: {
      ignoreUndefined: true,
    },
  },
  migrationsDir: "migrations",
  changelogCollectionName: "migrations",
  migrationFileExtension: ".js",
  useFileHash: false,
  moduleSystem: "commonjs",
}
