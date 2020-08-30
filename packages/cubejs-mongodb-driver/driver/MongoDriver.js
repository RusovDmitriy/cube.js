/* eslint-disable no-restricted-syntax */
const BaseDriver = require('@cubejs-backend/query-orchestrator/driver/BaseDriver');
const poolFactory = require('./poolFactory');
const SqlTransformer = require('./SqlTransformer.js');

const GenericTypeToMySql = {
  string: 'varchar(255)',
  text: 'varchar(255)'
};

const STUB_QUERIES = {
  INFO: 'INFO',
  UNIX_TIMESTAMP: 'FLOOR(UNIX_TIMESTAMP() / 1)'
};

class MongoDriver extends BaseDriver {
  constructor(config) {
    super();
    
    this.sqlTransformer = new SqlTransformer();

    this.config = {
      host: process.env.CUBEJS_DB_HOST || 'localhost',
      database: process.env.CUBEJS_DB_NAME || 'test',
      port: process.env.CUBEJS_DB_PORT || '27017',
      user: process.env.CUBEJS_DB_USER || '',
      password: process.env.CUBEJS_DB_PASS || '',
      ...(config || {})
    };

    this.pool = poolFactory(this.url);
  }

  informationSchemaQuery() {
    return `SELECT ${STUB_QUERIES.INFO}`;
  }

  get url() {
    const { user, password, host, port, database } = this.config;
    return `mongodb://${user}:${password}@${host}:${port}/${database}`;
  }

  createSchemaIfNotExists() {
    // Todo how implement mongodb schema?
    throw new Error('MongoDB not supported `schema`');
  }

  fromGenericType(columnType) {
    return GenericTypeToMySql[columnType] || super.fromGenericType(columnType);
  }

  async dropTable(tableName) {
    const client = await this.pool.acquire();
    const db = client.db(this.config.database);
    if (!db[tableName]) throw new Error(`Collection ${tableName} not exists`);

    await db[tableName].drop();
    await this.pool.release(client);
  }

  async stubsQueries(db, q) {
    let result;
    // Todo should find source and reason this query
    if (q === `SELECT ${STUB_QUERIES.UNIX_TIMESTAMP}`) {
      result = [{ [STUB_QUERIES.UNIX_TIMESTAMP]: Math.floor(new Date().getTime() / 1000) }];
    } else if (q === this.informationSchemaQuery()) {
      result = [];
      const listCollections = await db.listCollections().toArray();
      for (const coll of listCollections) {
        const doc = await db.collection(coll.name).findOne();

        result = [
          ...result,
          ...Object.keys(doc).map(f => ({
            column_name: f,
            table_name: coll.name,
            data_type: typeof doc[f] === 'number' ? 'int' : 'varchar',
            table_schema: this.config.database
          }))
        ];
      }
    }

    return result;
  }

  async query(query, values) {
    const client = await this.pool.acquire();
    const db = client.db(this.config.database);

    const result = await this.stubsQueries(db, query) || await this.execute(db, query, values);

    await this.pool.release(client);
    return result;
  }

  async execute(db, query, values) {
    const { table, method, options } = this.sqlTransformer.sqlToMongoNative(query, values);
    const collection = db.collection(table);
    let res = [];
    
    if (method) res = await collection[method](options).toArray();
  
    return res;
  }

  async testConnection() {
    // eslint-disable-next-line no-underscore-dangle
    const conn = await this.pool._factory.create();
    try {
      return await conn.isConnected();
    } finally {
      // eslint-disable-next-line no-underscore-dangle
      await this.pool._factory.destroy(conn);
    }
  }

  async release() {
    await this.pool.drain();
    await this.pool.clear();
  }
}

module.exports = MongoDriver;
