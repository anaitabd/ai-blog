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

// ../lambda/topic-seeder/index.ts
var topic_seeder_exports = {};
__export(topic_seeder_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(topic_seeder_exports);
var import_client_dynamodb = require("@aws-sdk/client-dynamodb");
var import_crypto = require("crypto");
var dynamo = new import_client_dynamodb.DynamoDBClient({ region: process.env.AWS_REGION });
var TOPICS = [
  // High CPC — debt & credit (advertisers pay top dollar here)
  { keyword: "how to pay off credit card debt fast", category: "Debt", priority: 10 },
  { keyword: "best balance transfer credit cards 2025", category: "Credit Cards", priority: 10 },
  { keyword: "how to improve credit score 100 points", category: "Credit", priority: 10 },
  { keyword: "debt snowball vs debt avalanche method", category: "Debt", priority: 9 },
  { keyword: "how to get out of debt on low income", category: "Debt", priority: 9 },
  // High CPC — investing (huge advertiser competition)
  { keyword: "how to start investing with little money", category: "Investing", priority: 10 },
  { keyword: "index funds vs ETFs for beginners", category: "Investing", priority: 9 },
  { keyword: "best brokerage accounts for beginners 2025", category: "Investing", priority: 9 },
  { keyword: "how to open a Roth IRA step by step", category: "Investing", priority: 9 },
  { keyword: "compound interest explained with examples", category: "Investing", priority: 8 },
  { keyword: "how to invest 1000 dollars for beginners", category: "Investing", priority: 8 },
  { keyword: "what is dollar cost averaging strategy", category: "Investing", priority: 8 },
  // High CPC — budgeting & saving
  { keyword: "how to budget money on low income", category: "Budgeting", priority: 10 },
  { keyword: "zero based budgeting method explained", category: "Budgeting", priority: 9 },
  { keyword: "50 30 20 budget rule explained", category: "Budgeting", priority: 9 },
  { keyword: "best budgeting apps that actually work", category: "Budgeting", priority: 8 },
  { keyword: "how to save money fast on a tight budget", category: "Saving", priority: 8 },
  { keyword: "sinking funds explained how to use them", category: "Saving", priority: 7 },
  { keyword: "how to build an emergency fund from scratch", category: "Saving", priority: 8 },
  // High CPC — income & side hustles (advertiser goldmine)
  { keyword: "best passive income ideas that actually work", category: "Income", priority: 10 },
  { keyword: "how to make money online legitimate ways", category: "Income", priority: 9 },
  { keyword: "side hustles you can start with no money", category: "Income", priority: 9 },
  { keyword: "how to negotiate a higher salary guide", category: "Career", priority: 8 },
  { keyword: "freelancing for beginners how to start", category: "Income", priority: 7 },
  // Evergreen financial literacy
  { keyword: "what is net worth and how to calculate it", category: "Financial Literacy", priority: 7 },
  { keyword: "how does compound interest work explained", category: "Financial Literacy", priority: 7 },
  { keyword: "difference between gross income and net income", category: "Financial Literacy", priority: 6 },
  { keyword: "what is an emergency fund and how much", category: "Financial Literacy", priority: 7 },
  { keyword: "how to read a pay stub explained simply", category: "Financial Literacy", priority: 6 },
  // Productivity — high CPC from SaaS advertisers
  { keyword: "best project management tools for small teams", category: "Productivity", priority: 8 },
  { keyword: "notion vs obsidian which is better", category: "Productivity", priority: 7 },
  { keyword: "how to use notion for personal finance", category: "Productivity", priority: 7 },
  { keyword: "best free productivity apps for remote work", category: "Productivity", priority: 7 },
  { keyword: "time blocking method how to actually do it", category: "Productivity", priority: 6 }
];
var handler = async () => {
  let seeded = 0;
  let skipped = 0;
  for (const topic of TOPICS) {
    try {
      await dynamo.send(
        new import_client_dynamodb.PutItemCommand({
          TableName: process.env.TOPICS_TABLE,
          Item: {
            id: { S: (0, import_crypto.randomUUID)() },
            keyword: { S: topic.keyword },
            category: { S: topic.category },
            priority: { N: String(topic.priority) },
            status: { S: "PENDING" },
            createdAt: { S: (/* @__PURE__ */ new Date()).toISOString() }
          }
        })
      );
      seeded++;
    } catch {
      skipped++;
    }
  }
  console.log(`Seeded ${seeded} topics, skipped ${skipped}`);
  return { seeded, skipped, total: TOPICS.length };
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
