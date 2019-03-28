'use strict';

// Load external packages
const Chai = require('chai'),
  assert = Chai.assert;

// Load dependencies package
const rootPrefix = '../../../..',
  OSTStorage = require(rootPrefix + '/index'),
  testConstants = require(rootPrefix + '/tests/mocha/services/constants'),
  coreConstant = require(rootPrefix + '/config/coreConstant'),
  helper = require(rootPrefix + '/tests/mocha/services/auto_scale/helper'),
  logger = require(rootPrefix + '/lib/logger/customConsoleLogger');

const ostStorage = OSTStorage.getInstance(testConstants.CONFIG_STRATEGIES),
  autoScaleObj = ostStorage.ic.getInstanceFor(coreConstant.icNameSpace, 'autoScaleApiService'),
  dynamodbApiObject = ostStorage.dynamoDBService;

let resourceId = 'table/' + testConstants.dummyTestTableName,
  roleARN = null;

const createTestCasesForOptions = function(optionsDesc, options, toAssert) {
  optionsDesc = optionsDesc || '';

  options = options || { invalidResId: false };

  it(optionsDesc, async function() {
    this.timeout(100000);

    let resId = 'table/' + testConstants.dummyTestTableName;
    if (options.invalidResId) {
      resId = 'invalidResId';
    }

    const scalableTargetParams = {
      ResourceId: resourceId /* required */,
      ScalableDimension: 'dynamodb:table:WriteCapacityUnits',
      ServiceNamespace: 'dynamodb' /* required */,
      MaxCapacity: 15,
      MinCapacity: 1,
      RoleARN: roleARN
    };
    const registerScalableTargetResponse = await autoScaleObj.registerScalableTarget(scalableTargetParams);
    assert.equal(registerScalableTargetResponse.isSuccess(), true, 'registerScalableTarget failed');

    let scalingPolicy = null;
    if (options.stepScaling) {
      scalingPolicy = {
        PolicyName: testConstants.dummyTestTableName + '-scaling-policy',
        PolicyType: 'StepScaling',
        ResourceId: resId,
        ScalableDimension: 'dynamodb:table:WriteCapacityUnits',
        ServiceNamespace: 'dynamodb',
        StepScalingPolicyConfiguration: {
          AdjustmentType: 'PercentChangeInCapacity',
          Cooldown: 60,
          StepAdjustments: [
            {
              MetricIntervalLowerBound: 0,
              ScalingAdjustment: 80
            }
          ]
        }
      };
    } else {
      scalingPolicy = {
        ServiceNamespace: 'dynamodb',
        ResourceId: resId,
        ScalableDimension: 'dynamodb:table:WriteCapacityUnits',
        PolicyName: testConstants.dummyTestTableName + '-scaling-policy',
        PolicyType: 'TargetTrackingScaling',
        TargetTrackingScalingPolicyConfiguration: {
          PredefinedMetricSpecification: {
            PredefinedMetricType: 'DynamoDBWriteCapacityUtilization'
          },
          ScaleOutCooldown: 60,
          ScaleInCooldown: 60,
          TargetValue: 70.0
        }
      };
    }
    const response = await autoScaleObj.putScalingPolicy(scalingPolicy);

    logger.log(response);
    assert.equal(response.isSuccess(), toAssert, 'put Scaling policy failed');
  });
};

describe('services/autoScale/api#putScalingPolicy', function() {
  before(async function() {
    this.timeout(1000000);

    const returnObject = await helper.createTestCaseEnvironment(dynamodbApiObject, autoScaleObj);
    roleARN = returnObject.role_arn;
  });

  createTestCasesForOptions('Put scaling policy happy case', null, true);

  createTestCasesForOptions('Put scaling policy invalid resource Id case', { invalidResId: true }, false);

  // TODO test case for step scaling
  //createTestCasesForOptions("Put scaling policy having step scaling ", {stepScaling : true}, true);

  after(async function() {
    this.timeout(1000000);
    await helper.cleanTestCaseEnvironment(dynamodbApiObject, autoScaleObj);
  });
});
