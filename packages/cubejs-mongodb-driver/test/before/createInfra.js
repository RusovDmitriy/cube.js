const { MongoClient } = require('mongodb');
const { GenericContainer, Wait } = require('testcontainers');

const path = require('path');

// Todo should find way waiting mongoDB
async function mongoIsReady(port) {
  try {
    const url = `mongodb://test-user:test-password@0.0.0.0:${port}/test`;
    const conn = MongoClient(url);
    await conn.connect();
  } catch (error) {
    await new Promise(resolve => {
      setTimeout(resolve(mongoIsReady(port)), 200);
    });
  }
}

module.exports = async () => {
  const container = await (new GenericContainer('mongo', '4.2.9')
    .withEnv('MONGO_INITDB_ROOT_USERNAME', 'root')
    .withEnv('MONGO_INITDB_ROOT_PASSWORD', 'password')
    .withEnv('MONGO_INITDB_DATABASE', 'test')
    .withBindMount(path.join(__dirname, './mongo'), '/docker-entrypoint-initdb.d')
    .withExposedPorts(27017)
    .withWaitStrategy(Wait.forLogMessage('waiting for connections on port 27017'))
    .start());

  await mongoIsReady(container.getMappedPort(27017));
  
  return container;
};
