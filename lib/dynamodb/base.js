'use strict';

/**
 * DynamoDB Libraries Base class
 *
 * @module lib/dynamodb/base
 *
 */

//Load external files
require('http').globalAgent.keepAlive = true;

const AWS = require('aws-sdk');
AWS.config.httpOptions.keepAlive = true;
AWS.config.httpOptions.disableProgressEvents = false;

const rootPrefix = '../..',
  logger = require(rootPrefix + '/lib/logger/customConsoleLogger'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  OSTBase = require('@ostdotcom/base'),
  coreConstant = require(rootPrefix + '/config/coreConstant');

const InstanceComposer = OSTBase.InstanceComposer;

require(rootPrefix + '/config/dynamoFactory');

/**
 * Constructor for base class
 *
 * @params {Object} params - DynamoDB configurations params
 *
 * @constructor
 */
const LibDynamoDBBase = function() {};

LibDynamoDBBase.prototype = {
  /**
   * Query on DynamoDB .
   *
   * @param methodName
   * @param preferredEndPoint - If the function is Dax supported or raw supported
   * @param params
   * @returns {Promise<*|Promise<result>>}
   */

  queryDdb: async function(methodName, preferredEndPoint, ...params) {
    const oThis = this,
      dynamoFactory = oThis.ic().getInstanceFor(coreConstant.icNameSpace, 'dynamoConfigFactory');
    // Last parameter is the serviceType passed from every method.
    //let serviceType = params.splice(-1, 1); // Removes the last element from the params and modifies params.
    const dbInstance = await dynamoFactory.getProvider(preferredEndPoint);
    return oThis.callGeneric(dbInstance, methodName, params);
  },

  /**
   * Call dynamoDB methods
   *
   * @params {String} method - method name
   * @params {object} params - Parameters
   *
   * @return {Promise<result>}
   *
   */

  callGeneric: function(dbInstance, method, methodArgs) {
    const oThis = this,
      methodRef = dbInstance[method];
    // return promise
    return new Promise(function(onResolve, onReject) {
      let preQuery = Date.now();
      try {
        // validate if the DB instance is available
        if (!dbInstance)
          return onResolve(
            responseHelper.error({
              internal_error_identifier: 'l_dy_b_call_1',
              api_error_identifier: 'invalid_db_instance',
              debug_options: {},
              error_config: coreConstant.ERROR_CONFIG
            })
          );

        // validate if the method is available
        if (!methodRef)
          return onResolve(
            responseHelper.error({
              internal_error_identifier: 'l_dy_b_call_2',
              api_error_identifier: 'invalid_method_ref',
              debug_options: {},
              error_config: coreConstant.ERROR_CONFIG
            })
          );

        methodArgs.push(function(err, data) {
          if (err) {
            return onResolve(
              responseHelper.error({
                internal_error_identifier: `l_dy_b_call_3:${err.code}`,
                api_error_identifier: 'ddb_method_call_error',
                debug_options: { method: method, methodArgs: methodArgs, error: err },
                error_config: coreConstant.ERROR_CONFIG
              })
            );
          } else {
            logger.debug('(' + (Date.now() - preQuery) + ' ms) DDB Call Completed: Method: ', method, methodArgs);
            return onResolve(responseHelper.successWithData(data));
          }
        });

        methodRef.apply(dbInstance, methodArgs);
      } catch (err) {
        logger.error('lib/dynamodb/base.js:call inside catch ', err);
        return onResolve(
          responseHelper.error({
            internal_error_identifier: 'l_dy_b_call_4',
            api_error_identifier: 'exception',
            debug_options: { method: method, methodArgs: methodArgs, error: err.stack },
            error_config: coreConstant.ERROR_CONFIG
          })
        );
      }
    });
  }
};

InstanceComposer.registerAsObject(LibDynamoDBBase, coreConstant.icNameSpace, 'libDynamoDBBase', true);

module.exports = {};
