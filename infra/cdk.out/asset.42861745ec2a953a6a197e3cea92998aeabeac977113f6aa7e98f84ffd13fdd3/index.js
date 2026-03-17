"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// ../lambda/topic-picker/index.ts
var topic_picker_exports = {};
__export(topic_picker_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(topic_picker_exports);
var import_client_dynamodb = require("@aws-sdk/client-dynamodb");
var import_client_sfn = require("@aws-sdk/client-sfn");
var dynamo = new import_client_dynamodb.DynamoDBClient({ region: process.env.AWS_REGION });
var sfn = new import_client_sfn.SFNClient({ region: process.env.AWS_REGION });
var handler = async () => {
  const result = await dynamo.send(
    new import_client_dynamodb.QueryCommand({
      TableName: process.env.TOPICS_TABLE,
      IndexName: "status-priority-index",
      KeyConditionExpression: "#s = :status",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: { ":status": { S: "PENDING" } },
      ScanIndexForward: false,
      Limit: 1
    })
  );
  if (!result.Items || result.Items.length === 0) {
    console.log("No pending topics in queue");
    return { status: "empty" };
  }
  const topic = result.Items[0];
  const topicId = topic.id.S;
  const keyword = topic.keyword.S;
  const category = topic.category.S;
  await dynamo.send(
    new import_client_dynamodb.UpdateItemCommand({
      TableName: process.env.TOPICS_TABLE,
      Key: { id: { S: topicId } },
      UpdateExpression: "SET #s = :processing, processingAt = :now",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: {
        ":processing": { S: "PROCESSING" },
        ":now": { S: (/* @__PURE__ */ new Date()).toISOString() }
      }
    })
  );
  await sfn.send(
    new import_client_sfn.StartExecutionCommand({
      stateMachineArn: process.env.STATE_MACHINE_ARN,
      name: `article-${topicId}-${Date.now()}`,
      input: JSON.stringify({ topicId, keyword, category })
    })
  );
  console.log(`Started pipeline for: "${keyword}"`);
  return { status: "started", topicId, keyword };
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
