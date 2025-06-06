export const config = {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    vectorDb: {
      url: process.env.VECTOR_DB_URL,
      apiKey: process.env.VECTOR_DB_API_KEY,
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
    }
  }