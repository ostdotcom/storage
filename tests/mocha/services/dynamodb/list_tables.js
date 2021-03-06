const chai = require('chai'),
  assert = chai.assert;

const rootPrefix = '../../../..',
  testConstants = require(rootPrefix + '/tests/mocha/services/constants'),
  logger = require(rootPrefix + '/lib/logger/customConsoleLogger'),
  helper = require(rootPrefix + '/tests/mocha/services/dynamodb/helper');

describe('List Tables', function() {
  let ostStorage = null;

  before(async function() {
    // get ostStorage
    ostStorage = helper.validateOstStorageObject(testConstants.CONFIG_STRATEGIES);
    ddb_service = ostStorage.dynamoDBService;
  });

  it('should create table successfully', async function() {
    // build create table params
    const createTableParams = {
      TableName: testConstants.dummyTestTableName,
      KeySchema: [
        {
          AttributeName: 'tuid',
          KeyType: 'HASH'
        }, //Partition key
        {
          AttributeName: 'cid',
          KeyType: 'RANGE'
        } //Sort key
      ],
      AttributeDefinitions: [
        { AttributeName: 'tuid', AttributeType: 'S' },
        { AttributeName: 'cid', AttributeType: 'N' },
        { AttributeName: 'thash', AttributeType: 'S' }
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5
      },
      GlobalSecondaryIndexes: [
        {
          IndexName: 'thash_global_secondary_index',
          KeySchema: [
            {
              AttributeName: 'thash',
              KeyType: 'HASH'
            }
          ],
          Projection: {
            ProjectionType: 'KEYS_ONLY'
          },
          ProvisionedThroughput: {
            ReadCapacityUnits: 1,
            WriteCapacityUnits: 1
          }
        }
      ],
      SSESpecification: {
        Enabled: false
      }
    };
    await helper.createTable(ddb_service, createTableParams, true);
  });

  it('should list table successfully', async function() {
    // build create table params
    const listTablesParams = {};
    await helper.listTables(ddb_service, listTablesParams, true);
  });

  it('should fail when table name is passed in parameter', async function() {
    // build create table params
    const listTablesParams = {
      TableName: testConstants.dummyTestTableName
    };
    await helper.listTables(ddb_service, listTablesParams, false);
  });

  after(async function() {
    const deleteTableParams = {
      TableName: testConstants.dummyTestTableName
    };

    await helper.deleteTable(ddb_service, deleteTableParams, true);
    logger.debug('List Tables Mocha Tests Complete');
  });
});
