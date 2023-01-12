const AWS = require('aws-sdk');
const REGION = process.env.AWS_REGION || 'local-env';
const ENDPOINT = 'http://localhost:8000';
const TABLE_NAME = process.env.TABLE_NAME || 'parksreso-tests';

// generate a unique table name for each test suite so there is no accidental cross-contamination
function generateMockTableName() {
  return TABLE_NAME + Math.random().toString();
}

function createDB() {
  return new AWS.DynamoDB({
    region: REGION,
    endpoint: ENDPOINT
  });
}

module.exports = {
  generateMockTableName,
  createDB,
  REGION,
  ENDPOINT,
  TABLE_NAME
};
