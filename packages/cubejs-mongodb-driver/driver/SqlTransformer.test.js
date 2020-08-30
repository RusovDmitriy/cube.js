/* globals describe, test, expect */

const SqlTransformer = require('./SqlTransformer.js');

describe('SqlTransformer', () => {
  const instance = new SqlTransformer();
  
  const SORT_ORDER = {
    ASC: 1,
    DESC: -1
  };

  test('Should transform, simple SQL', () => {
    const query = `
      SELECT some, count(*) 
      FROM somet 
      GROUP BY some 
      ORDER BY count(*) ASC, some DESC
    `;

    const result = instance.sqlToMongoNative(query, []);
    
    expect(result).toStrictEqual({
      method: 'aggregate',
      table: 'somet',
      options: [
        { $group: { _id: { some: '$some' }, some: { $first: '$some' }, 'count(*)': { $sum: 1 } } },
        { $project: { _id: 0 } },
        { $sort: { 'count(*)': 1, some: -1 } }
      ]
    });
  });

  test('Should transform, group by, order, where...', () => {
    const query = `
      SELECT some as somef, count(*) as cnt 
      FROM somet 
      WHERE hope IN ("test") AND some IN ("test") 
      GROUP BY 1 
      ORDER BY 2 ASC
    `;

    const result = instance.sqlToMongoNative(query, []);
    

    expect(result).toStrictEqual({
      method: 'aggregate',
      table: 'somet',
      options: [
        { $match: { $and: [{ hope: { $in: ['test'] } }, { some: { $in: ['test'] } }] } },
        { $group: { _id: { somef: '$some' }, somef: { $first: '$some' }, cnt: { $sum: 1 } } },
        { $project: { _id: 0 } },
        { $sort: { cnt: SORT_ORDER.ASC } }
      ]
    });
  });

  test('Should transform, group by, order, where...', () => {
    const query = `
      SELECT \`donors\`."Donor State" \`donors__donor_state\`, count(*) \`donors__count\` 
      FROM test.donors AS \`donors\`
      GROUP BY 1 
      ORDER BY 2 DESC
    `;

    const result = instance.sqlToMongoNative(query, []);
    expect(result).toStrictEqual({
      table: 'donors',
      method: 'aggregate',
      options: [
        { $group: { _id: { donors__donor_state: '$Donor State' }, donors__donor_state: { $first: '$Donor State' }, donors__count: { $sum: 1 } } },
        { $project: { _id: 0 } },
        { $sort: { donors__count: -1 } }
      ]
    });
  });

  test('Should transform, without group by', () => {
    const query = `
      SELECT count(*) \`donors__count\`
      FROM test.donors AS \`donors\` 
      WHERE (\`donors\`."Donor City" = "San Francisco")
    `;

    const result = instance.sqlToMongoNative(query, []);

    expect(result).toStrictEqual({
      table: 'donors',
      method: 'aggregate',
      options: [
        { $match: { 'Donor City': { $eq: 'San Francisco' } } },
        { $group: { _id: 1, donors__count: { $sum: 1 } } },
        { $project: { _id: 0 } }
      ]
    });
  });

  test('Should transform, without group by, with having', () => {
    const query = `
      SELECT count(*) \`donors__count\`
      FROM test.donors AS \`donors\` 
      WHERE (\`donors\`."Donor City" = "San Francisco")
      HAVING (count(*) > 100)
    `;

    const result = instance.sqlToMongoNative(query, []);

    expect(result).toStrictEqual({
      table: 'donors',
      method: 'aggregate',
      options: [
        { $match: { 'Donor City': { $eq: 'San Francisco' } } },
        { $group: { _id: 1, donors__count: { $sum: 1 } } },
        { $project: { _id: 0 } },
        { $match: { donors__count: { $gt: 100 } } }
      ]
    });
  });

  test('Should transform, with sum function', () => {
    const query = `
      SELECT count(*) \`donors__count\`, sum(\`donors\`."Donor Zip") \`donors__zip\`
      FROM test.donors AS \`donors\` 
      WHERE (\`donors\`."Donor City" = "San Francisco")
    `;

    const result = instance.sqlToMongoNative(query, []);

    expect(result).toStrictEqual({
      table: 'donors',
      method: 'aggregate',
      options: [
        { $match: { 'Donor City': { $eq: 'San Francisco' } } },
        { $group: { _id: 1, donors__count: { $sum: 1 }, donors__zip: { $sum: '$Donor Zip' } } },
        { $project: { _id: 0 } }
      ]
    });
  });

  test('Should transform, with avg function', () => {
    const query = `
      SELECT count(*) \`donors__count\`, avg(\`donors\`."Donor Zip") \`donors__zip\`
      FROM test.donors AS \`donors\` 
      WHERE (\`donors\`."Donor City" = "San Francisco")
    `;

    const result = instance.sqlToMongoNative(query, []);

    expect(result).toStrictEqual({
      table: 'donors',
      method: 'aggregate',
      options: [
        { $match: { 'Donor City': { $eq: 'San Francisco' } } },
        { $group: { _id: 1, donors__count: { $sum: 1 }, donors__zip: { $avg: '$Donor Zip' } } },
        { $project: { _id: 0 } }
      ]
    });
  });

  test('Should transform, with diff operators, limit, offset', () => {
    const query = `
      SELECT count(*) \`donors__count\`, avg(\`donors\`."Donor Zip") \`donors__zip\`
      FROM test.donors AS \`donors\` 
      WHERE (\`donors\`."Donor City" = "San Francisco") && (\`donors\`."Donor Zip" <> 123)
      HAVING (count(*) > 100)
      LIMIT 100
      OFFSET 2
    `;

    const result = instance.sqlToMongoNative(query, []);


    expect(result).toStrictEqual({
      table: 'donors',
      method: 'aggregate',
      options: [
        { $match: { $and: [{ 'Donor City': { $eq: 'San Francisco' } }, { 'Donor Zip': { $ne: 123 } }] } },
        { $group: { _id: 1, donors__count: { $sum: 1 }, donors__zip: { $avg: '$Donor Zip' } } },
        { $project: { _id: 0 } },
        { $match: { donors__count: { $gt: 100 } } },
        { $skip: 2 },
        { $limit: 100 }
      ]
    });
  });
});
