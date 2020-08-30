cube('Donors', {
  sql: 'SELECT * FROM test.donors',
  
  joins: {
    
  },
  
  measures: {
    count: {
      type: 'count',
      drillMembers: [donorId, donorCity]
    },
    sumZip: {
      type: 'sum',
      sql: `${CUBE}."Donor Zip"`
    },
    avgZip: {
      type: 'avg',
      sql: `${CUBE}."Donor Zip"`
    }
  },
  
  dimensions: {
    donorId: {
      sql: `${CUBE}."Donor ID"`,
      type: 'string'
    },
    
    donorCity: {
      sql: `${CUBE}."Donor City"`,
      type: 'string'
    },
    
    donorState: {
      sql: `${CUBE}."Donor State"`,
      type: 'string'
    },
    
    donorIsTeacher: {
      sql: `${CUBE}."Donor Is Teacher"`,
      type: 'string'
    }
  }
});
