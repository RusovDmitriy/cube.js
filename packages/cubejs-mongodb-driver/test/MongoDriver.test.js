/* globals describe, afterAll, beforeAll, test, expect, jest */
const Driver = require('../driver/MongoDriver');
const createInfra = require('./before/createInfra');
const setTestData = require('./before/setTestData');

process.env.CUBEJS_DB_MAX_POOL = 2;
describe('MongoDriver', () => {
  let container;
  let driver;

  jest.setTimeout(50000);

  beforeAll(async () => {
    container = await createInfra();

    // Create mongo driver
    driver = new Driver({
      host: '0.0.0.0',
      user: 'test-user',
      password: 'test-password',
      port: container && container.getMappedPort(27017),
      database: 'test'
    });

    await setTestData(driver.url);
  });

  afterAll(async () => {
    await driver.release();
    if (container) await container.stop();
  });

  describe('.query', () => {
    describe('select', () => {
      test('Should select data by SQL, count with group', async () => {
        const sql = `
          SELECT
            \`donors\`."Donor State" \`donors__donor_state\`, count(*) \`donors__count\` 
          FROM test.donors AS \`donors\` 
          GROUP BY 1
          ORDER BY 2 DESC, 1 DESC
          LIMIT 10000
        `;

        const res = await driver.query(sql);
        expect(res).toStrictEqual([
          { donors__donor_state: 'other', donors__count: 2 },
          { donors__donor_state: 'New Jersey', donors__count: 1 },
          { donors__donor_state: 'Indiana', donors__count: 1 },
          { donors__donor_state: 'Illinois', donors__count: 1 },
          { donors__donor_state: 'California', donors__count: 1 }
        ]);
      });

      test('Should select data by SQL, count without group', async () => {
        const sql = `
          SELECT count(*) \`donors__count\`
          FROM test.donors AS \`donors\` 
          WHERE (\`donors\`."Donor City" = "Indianapolis")
          LIMIT 10000
        `;

        const res = await driver.query(sql);

        expect(res).toStrictEqual([{ donors__count: 1 }]);
      });

      test('Should select data by SQL, select without aliases', async () => {
        const sql = `
          SELECT count(*), \`donors\`."Donor City"
          FROM test.donors 
          GROUP BY \`donors\`."Donor City", \`donors\`."Donor State"
          ORDER BY count(*) ASC, \`donors\`."Donor City" DESC
          LIMIT 3
        `;

        const res = await driver.query(sql);

        expect(res).toStrictEqual([
          { 'Donor City': 'Winton', 'Donor State': 'California', 'count(*)': 1 },
          { 'Donor City': 'Paterson', 'Donor State': 'New Jersey', 'count(*)': 1 },
          { 'Donor City': 'Indianapolis', 'Donor State': 'Indiana', 'count(*)': 1 }
        ]);
      });
    });

    // Todo implement insert
    // describe('insert', () => {
    //   test('Should insert data to mongo', () => {
    //     //
    //   });
    // });

    // Todo implement delete
    // describe('delete', () => {
    //   test('Should throw error, mongodb create table automaticaly', () => {
    //     //
    //   });
    // });
  });
});
