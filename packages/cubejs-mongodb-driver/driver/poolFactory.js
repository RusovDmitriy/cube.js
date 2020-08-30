const genericPool = require('generic-pool');
const { MongoClient } = require('mongodb');

module.exports = (url) => genericPool.createPool({
  create: async () => {
    // TODO add username and password
    const conn = MongoClient(url);
    const client = await conn.connect();

    return client;
  },
  destroy: (client) => {
    client.close();
  },
}, {
  // Todo: add support ENV variables and values from config object
  min: 0,
  max: 8,
  evictionRunIntervalMillis: 10000,
  softIdleTimeoutMillis: 30000,
  idleTimeoutMillis: 30000,
  acquireTimeoutMillis: 20000
});
