/* eslint-disable import/no-dynamic-require */
const CubejsServerCore = require('@cubejs-backend/server-core');

const express = require('express');
const bodyParser = require('body-parser');

process.env.CUBEJS_DB_HOST = '0.0.0.0';
process.env.CUBEJS_DB_NAME = 'test';
process.env.CUBEJS_DB_PORT = '27017';
process.env.CUBEJS_DB_USER = 'test-user';
process.env.CUBEJS_DB_PASS = 'test-password';


const expressApp = express();
expressApp.use(bodyParser.json({ limit: '50mb' }));

async function main() {
  const options = {
    dbType: 'mysql',
    devServer: true,
    apiSecret: 'api-secret',
    logger: (msg, params) => {
      // console.log(`${msg}: ${JSON.stringify(params)}`);
    },
    schemaPath: './schema'
  };
  
  const core = CubejsServerCore.create(options);
  core.initApp(expressApp);


  expressApp.listen(4000);
}

main();
