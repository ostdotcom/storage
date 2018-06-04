const rootPrefix = '../..'
  , BaseModel = require(rootPrefix + '/lib/models/base')
  , util = require(rootPrefix + '/lib/utils')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , coreConstants = require(rootPrefix + '/config/core_constants')
  , transactionLogConst = require(rootPrefix + '/lib/global_constant/transaction_log')
;

const longToShortNamesMap = {
      transaction_hash: 'txh',
      transaction_uuid: 'txu',
      transaction_type: 'tt',
      block_number: 'bn',
      client_id: 'ci',
      client_token_id: 'cti',
      gas_used: 'gu',
      gas_price: 'gp',
      status: 's',
      created_at: 'ca',
      from_uuid: 'fu',
      to_uuid: 'tu',
      action_id: 'ai',
      token_symbol: 'ts',
      post_receipt_process_params: 'prpp',
      commission_percent: 'cp',
      commission_amount_in_wei: 'caiw',
      amount: 'a',
      amount_in_wei: 'aiw',
      to_address: 'ta',
      from_address: 'fa',
      bt_transfer_in_wei: 'btiw',
      transfer_events: 'te',
      error_code: 'ec'
    }
    , shortToLongNamesMap = util.invert(longToShortNamesMap)
    , statuses = {
      '1': transactionLogConst.processingStatus,
      '2': transactionLogConst.completeStatus,
      '3': transactionLogConst.failedStatus,
      '4': transactionLogConst.waitingForMiningStatus
    }
    , chainTypes = {
      '1': transactionLogConst.valueChainType,
      '2': transactionLogConst.utilityChainType
    }
    , transactionTypes = {
      '1': transactionLogConst.tokenTransferTransactionType,
      '2': transactionLogConst.stpTransferTransactionType,
      '3': transactionLogConst.extenralTokenTransferTransactionType
    }
    , invertedStatuses = util.invert(statuses)
    , invertedChainTypes = util.invert(chainTypes)
    , invertedTransactionTypes = util.invert(transactionTypes)
;

/**
 * Transaction Log Model
 *
 * @constructor
 */
const TransactionLogModel = function (params) {
  const oThis = this
  ;

  oThis.clientId = params.client_id;
  oThis.transactionUuid = (params.transaction_uuid || '').toLowerCase();
  oThis.transactionHash = (params.transaction_hash || '').toLowerCase();

  oThis.shardName = null;
  oThis.entityType = 'transactionLog';

  BaseModel.call(oThis, params);

};

TransactionLogModel.prototype = Object.create(BaseModel.prototype);

const transactionLogModelSpecificPrototype = {

  shortToLongNamesMap: shortToLongNamesMap,

  longToShortNamesMap: longToShortNamesMap,

  /**
   * bulk create / update items in DDB
   *
   * @params {array} rawData
   *
   * @return {promise<result>}
   */
  batchPutItem: async function(rawData) {

    const oThis = this
        , batchPutLimit = 25
    ;

    await oThis._getShard();

    let responseDbData = {}
        , batchNo = 1
        , promises = []
    ;

    while(true) {

      const offset = (batchNo - 1) * batchPutLimit
          , batchedrawData = rawData.slice(offset, batchPutLimit + offset)
          , batchedFormattedData = []
      ;

      if (batchedrawData.length === 0) break;

      for(let i=0; i<batchedrawData.length; i++) {
        let rowData = batchedrawData[i];
        batchedFormattedData.push(oThis._formatDataForPutItem(rowData));
      }

      let batchPutParams = {RequestItems: {}};
      batchPutParams.RequestItems[oThis.shardName] = batchedFormattedData;

      promises.push(oThis.ddbServiceObj.batchWriteItem(batchPutParams));

      batchNo = batchNo + 1;

    }

    //TODO: we might have to check for UnprocessedItems in response and retry
    let promiseResponses = await Promise.all(promises);

    let formattedPromiseResponses = [];
    for (let i=0; i<promiseResponses.length; i++) {
      formattedPromiseResponses[i] = promiseResponses[i].toHash();
    }

    return Promise.resolve(responseHelper.successWithData(formattedPromiseResponses));

  },

  /**
   * Handles logic of shorting input param keys
   *
   * @private
   * @param long_name - long name of key
   *
   * @return {String}
   */
  shortNameFor: function (long_name) {
    const oThis = this;
    return oThis.longToShortNamesMap[long_name];
  },

  /**
   * Handles logic of shorting input param keys
   *
   * @private
   * @param short_name - short name of key
   *
   * @return {String}
   */
  longNameFor: function (short_name) {
    const oThis = this;
    return oThis.shortToLongNamesMap[short_name];
  },

  /**
   * Shard Identifier
   *
   * @return {string}
   */
  _shardIdentifier: function () {
    const oThis = this
    ;

    return oThis.clientId;
  },

  /**
   * Create table params
   *
   * @return {object}
   */
  _createTableParams: function (shardName) {
    const oThis = this
    ;

    return {
      TableName : shardName,
      KeySchema: [
        {
          AttributeName: oThis.shortNameFor('transaction_uuid'),
          KeyType: "HASH"
        }
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'thash_global_secondary_index',
          KeySchema: [
            {
              AttributeName: oThis.shortNameFor('transaction_hash'),
              KeyType: "HASH"
            }
          ],
          Projection: {
            ProjectionType: "KEYS_ONLY"
          },
          ProvisionedThroughput: {
            ReadCapacityUnits: 1,
            WriteCapacityUnits: 1
          }
        },
      ],
      AttributeDefinitions: [
        { AttributeName: oThis.shortNameFor('transaction_uuid'), AttributeType: "S" },
        { AttributeName: oThis.shortNameFor('transaction_hash'), AttributeType: "S" }
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 1,
        WriteCapacityUnits: 1
      },
      SSESpecification: {
        Enabled: false
      },
    };
  },

  /**
   * Primary key of the table.
   *
   * @return {object}
   */
  _keyObj: function (params) {

    const oThis = this
        , keyObj = {}
    ;

    keyObj[oThis.shortNameFor('transaction_uuid')] = { S: params['transaction_uuid'].toLowerCase() };

    return keyObj;

  },

  /**
   * NOTE: Only send keys which are to be inserted in DB. DO NOT send keys with null values
   * Format data for putItem
   *
   * @return {object}
   */
  _formatDataForPutItem: function (rowData) {

    const oThis = this;

    let formattedRowData = oThis._keyObj(rowData);

    // TODO: Handle these column here
    // post_receipt_process_params: 'prpp',

    if (rowData.hasOwnProperty('transaction_hash')) {
      formattedRowData[oThis.shortNameFor('transaction_hash')] = { S: rowData['transaction_hash'].toLowerCase() };
    }

    if (rowData.hasOwnProperty('block_number')) {
      formattedRowData[oThis.shortNameFor('block_number')] = { N: rowData['block_number'].toString() };
    }

    if (rowData.hasOwnProperty('transaction_type')) {
      formattedRowData[oThis.shortNameFor('transaction_type')] = { N: rowData['transaction_type'].toString() };
    }

    if (rowData.hasOwnProperty('client_id')) {
      formattedRowData[oThis.shortNameFor('client_id')] = { N: rowData['client_id'].toString() };
    }

    if (rowData.hasOwnProperty('client_token_id')) {
      formattedRowData[oThis.shortNameFor('client_token_id')] = { N: rowData['client_token_id'].toString() };
    }

    if (rowData.hasOwnProperty('gas_used')) {
      formattedRowData[oThis.shortNameFor('gas_used')] = { N: rowData['gas_used'].toString() };
    }

    if (rowData.hasOwnProperty('gas_price')) {
      formattedRowData[oThis.shortNameFor('gas_price')] = { N: rowData['gas_price'].toString() };
    }

    if (rowData.hasOwnProperty('status')) {
      formattedRowData[oThis.shortNameFor('status')] = { N: rowData['status'].toString() };
    }

    if (rowData.hasOwnProperty('created_at')) {
      formattedRowData[oThis.shortNameFor('created_at')] = { N: rowData['created_at'].toString() };
    }

    if (rowData.hasOwnProperty('from_uuid')) {
      formattedRowData[oThis.shortNameFor('from_uuid')] = { S: rowData['from_uuid'] };
    }

    if (rowData.hasOwnProperty('to_uuid')) {
      formattedRowData[oThis.shortNameFor('to_uuid')] = { S: rowData['to_uuid'] };
    }

    if (rowData.hasOwnProperty('action_id')) {
      formattedRowData[oThis.shortNameFor('action_id')] = { N: rowData['action_id'].toString() };
    }

    if (rowData.hasOwnProperty('commission_percent')) {
      formattedRowData[oThis.shortNameFor('commission_percent')] = { N: rowData['commission_percent'].toString() };
    }

    if (rowData.hasOwnProperty('amount')) {
      formattedRowData[oThis.shortNameFor('amount')] = { N: rowData['amount'].toString() };
    }

    if (rowData.hasOwnProperty('amount_in_wei')) {
      formattedRowData[oThis.shortNameFor('amount_in_wei')] = { N: rowData['amount_in_wei'].toString() };
    }

    if (rowData.hasOwnProperty('bt_transfer_in_wei')) {
      formattedRowData[oThis.shortNameFor('bt_transfer_in_wei')] = { N: rowData['bt_transfer_in_wei'].toString() };
    }

    if (rowData.hasOwnProperty('token_symbol')) {
      formattedRowData[oThis.shortNameFor('token_symbol')] = { S: rowData['token_symbol'] };
    }

    if (rowData.hasOwnProperty('to_address')) {
      formattedRowData[oThis.shortNameFor('to_address')] = { S: rowData['to_address'] };
    }

    if (rowData.hasOwnProperty('from_address')) {
      formattedRowData[oThis.shortNameFor('from_address')] = { S: rowData['from_address'] };
    }

    if (rowData.hasOwnProperty('error_code')) {
      formattedRowData[oThis.shortNameFor('error_code')] = { S: rowData['error_code'] };
    }

    if (rowData.hasOwnProperty('transfer_events')) {
      let formattedEventsData = [];
      for(var j=0; j<rowData['transfer_events'].length; j++) {
        let event_data = rowData['transfer_events'][j]
            , formattedEventData = {}
        ;
        if (event_data.hasOwnProperty('from_uuid')) {
          formattedEventData[oThis.shortNameFor('from_uuid')] = { S: event_data['from_uuid'] };
        }
        if (event_data.hasOwnProperty('to_uuid')) {
          formattedEventData[oThis.shortNameFor('to_uuid')] = { S: event_data['to_uuid'] };
        }
        formattedEventData[oThis.shortNameFor('from_address')] = { S: event_data['from_address'] };
        formattedEventData[oThis.shortNameFor('to_address')] = { S: event_data['to_address'] };
        formattedEventData[oThis.shortNameFor('amount')] = { N: event_data['value'].toString() };
        formattedEventsData.push({ M: formattedEventData });
      }
      formattedRowData[oThis.shortNameFor('transfer_events')] = { L: formattedEventsData };
    }

    return {
      PutRequest: {
        Item: formattedRowData
      }
    };

  }

};

Object.assign(TransactionLogModel.prototype, transactionLogModelSpecificPrototype);

module.exports = TransactionLogModel;