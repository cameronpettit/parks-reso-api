const { DocumentClient } = require('aws-sdk/clients/dynamodb');
const { REGION, ENDPOINT, createDB } = require('./settings');

const dynamoDb = createDB();

async function setupDB(tableName) {
  await createTable(tableName);
  const client = await createDocClient();
  return {
    client: client,
    tableName: tableName
  }
}

async function createDocClient() {
  return new DocumentClient({
    region: REGION,
    endpoint: ENDPOINT,
    convertEmptyValues: true
  });
}

async function createTable(tableName) {
  try {
    let res = await dynamoDb
      .createTable({
        TableName: tableName,
        KeySchema: [
          {
            AttributeName: 'pk',
            KeyType: 'HASH'
          },
          {
            AttributeName: 'sk',
            KeyType: 'RANGE'
          }
        ],
        AttributeDefinitions: [
          {
            AttributeName: 'pk',
            AttributeType: 'S'
          },
          {
            AttributeName: 'sk',
            AttributeType: 'S'
          },
          {
            AttributeName: 'shortPassDate',
            AttributeType: 'S'
          },
          {
            AttributeName: 'facilityName',
            AttributeType: 'S'
          },
          {
            AttributeName: 'passStatus',
            AttributeType: 'S'
          }
        ],
        ProvisionedThroughput: {
          ReadCapacityUnits: 1,
          WriteCapacityUnits: 1
        },
        GlobalSecondaryIndexes: [
          {
            IndexName: 'passStatus-index',
            KeySchema: [
              {
                AttributeName: 'passStatus',
                KeyType: 'HASH'
              }
            ],
            Projection: {
              ProjectionType: 'INCLUDE',
              NonKeyAttributes: [
                'type',
                'date',
                'facilityName',
                'pk',
                'sk'
              ]
            },
            ProvisionedThroughput: {
              ReadCapacityUnits: 1,
              WriteCapacityUnits: 1
            }
          },
          {
            IndexName: 'shortPassDate-index',
            KeySchema: [
              {
                AttributeName: 'shortPassDate',
                KeyType: 'HASH'
              },
              {
                AttributeName: 'facilityName',
                KeyType: 'RANGE'
              }
            ],
            Projection: {
              ProjectionType: 'INCLUDE',
              NonKeyAttributes: [
                'firstName',
                'searchFirstName',
                'lastName',
                'searchLastName',
                'facilityName',
                'email',
                'date',
                'shortPassDate',
                'type',
                'registrationNumber',
                'numberOfGuests',
                'passStatus',
                'phoneNumber',
                'facilityType',
                'creationDate',
                'isOverbooked'
              ]
            },
            ProvisionedThroughput: {
              ReadCapacityUnits: 1,
              WriteCapacityUnits: 1
            }
          }
        ]
      })
      .promise();
    return res;
  } catch (err) {
    console.log(err);
  }
}

async function teardownDB(mockDB) {
  try {
    await dynamoDb.deleteTable({
      TableName: mockDB.tableName
    }).promise();
  } catch (err) {
    console.log(err);
  }
}

exports.dbTools = {
  teardownDB,
  setupDB,
}