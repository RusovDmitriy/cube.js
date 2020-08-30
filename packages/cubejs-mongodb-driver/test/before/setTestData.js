const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const csv = require('csv-parser');

module.exports = async (url) => {
  const db = await MongoClient.connect(url);
  const dbo = db.db('test');

  const rows = await new Promise(resolve => {
    const results = [];
    fs.createReadStream(path.join(__dirname, './data.csv'))
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => {
        resolve(results);
      });
  });

  await dbo.collection('donors').insertMany(rows);
  await db.close();
};
