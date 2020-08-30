const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const csv = require('csv-parser');

async function main() {
  const url = 'mongodb://test-user:test-password@0.0.0.0:27017/test';
  const db = await MongoClient.connect(url);
  const dbo = db.db('test');

  const rows = await new Promise(resolve => {
    const results = [];
    fs.createReadStream(path.join(__dirname, './data.csv'))
      .pipe(csv())
      .on('data', (data) => {
        data['Donor Zip'] = +data['Donor Zip'];
        results.push(data);
      })
      .on('end', () => {
        resolve(results);
      });
  });

  await dbo.collection('donors').insertMany(rows);
  await db.close();

  console.log('Insert data completed', rows.length);
}

main();
