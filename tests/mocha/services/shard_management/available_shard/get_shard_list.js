"use strict";

// Load external packages
const Chai    = require('chai')
  , assert    = Chai.assert
;

const rootPrefix = "../../../../.."
  , DynamoDbObject = require(rootPrefix + "/index").Dynamodb
  , testConstants = require(rootPrefix + '/tests/mocha/services/constants')
  , logger = require(rootPrefix + "/lib/logger/custom_console_logger")
  , availableShardConst = require(rootPrefix + "/lib/global_constant/available_shard")
  , helper = require(rootPrefix + "/tests/mocha/services/shard_management/helper")
;


const dynamoDbObject = new DynamoDbObject(testConstants.DYNAMODB_CONFIGURATIONS_REMOTE)
  , shardManagementObject = dynamoDbObject.shardManagement()
;



const createTestCasesForOptions = function (optionsDesc, options, toAssert) {
  optionsDesc = optionsDesc || "";
  options = options || {
    invalidShardType: false,
    inValidEntityType: false
  };
  let entity_type = testConstants.shardEntityType;

  it(optionsDesc, async function(){
    let shardType = availableShardConst.disabled;
    if (options.invalidShardType) {
      shardType = "test"
    }
    if (options.inValidEntityType) {
      entity_type = "invalidType"
    }

    const response = await shardManagementObject.getShardsByType({entity_type: entity_type, shard_type: shardType});

    logger.info("LOG", response.data);

    if (toAssert) {
      assert.isTrue(response.isSuccess(), "Success");
      assert.exists(response.data.response);
      assert.equal(response.data.response.length, 1);
      logger.info("LOG ShardName", response.data.response[0].shardName);
      logger.info("LOG EntityType", response.data.response[0].entityType);
      logger.info("LOG Allocation Type ", response.data.response[0].allocationType);
      logger.info("LOG created At", response.data.response[0].createdAt);
      logger.info("LOG Updated At", response.data.response[0].updatedAt);
    } else {
      assert.isTrue(response.isFailure(), "Failure");
    }
  });

};

describe('services/shard_management/available_shard/get_shards', function () {

  before(async function () {
    await helper.cleanShardMigrationTables(dynamoDbObject);
    await shardManagementObject.runShardMigration(dynamoDbObject);

    let entity_type = testConstants.shardEntityType;
    let shardName = testConstants.shardTableName;

    await shardManagementObject.addShard({shard_name: shardName, entity_type: entity_type});
  });

  createTestCasesForOptions("Get shard list adding happy case", {}, true);

  createTestCasesForOptions("Get shard list having invalid shard type", {
    invalidShardType: true
  }, false);

  createTestCasesForOptions("Get shard list having invalid entity type", {
    inValidEntityType: true
  }, false);

  after(async function () {
    await helper.cleanShardMigrationTables(dynamoDbObject);
  });
});