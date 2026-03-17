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

// ../lambda/content-generator/index.ts
var content_generator_exports = {};
__export(content_generator_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(content_generator_exports);
var import_client_bedrock_runtime = require("@aws-sdk/client-bedrock-runtime");
var import_client_dynamodb = require("@aws-sdk/client-dynamodb");
var bedrock = new import_client_bedrock_runtime.BedrockRuntimeClient({ region: process.env.AWS_REGION });
var dynamo = new import_client_dynamodb.DynamoDBClient({ region: process.env.AWS_REGION });
var handler = async (event) => {
  const { topicId, keyword, category, retryCount = 0 } = event;
  console.log(`Generating article for: "${keyword}" (attempt ${retryCount + 1})`);
  try {
    const article = await callBedrock(keyword, category, retryCount > 0);
    const quality = checkQuality(article.content);
    if (!quality.passed) {
      console.warn("Quality gate failed:", quality.issues);
      if (retryCount < 2) {
        return { ...event, retryCount: retryCount + 1, shouldRetry: true };
      }
      await updateTopic(topicId, "FAILED", quality.issues.join("; "));
      throw new Error(`Quality gate failed after ${retryCount + 1} attempts`);
    }
    return { topicId, keyword, category, article, wordCount: quality.wordCount, readingTime: Math.ceil(quality.wordCount / 200), shouldRetry: false };
  } catch (err) {
    await updateTopic(topicId, "FAILED", String(err));
    throw err;
  }
};
async function callBedrock(keyword, category, isRetry) {
  const retryNote = isRetry ? "\n\nIMPORTANT: Previous attempt failed quality checks. Write AT LEAST 2000 words with minimum 5 H2 sections.\n" : "";
  const prompt = `You are a professional SEO content writer for a monetized blog.
${retryNote}
Write a comprehensive, 100% original article:
- Target keyword: "${keyword}"
- Category: "${category}"
- Minimum words: 1800

Requirements:
1. Compelling H1 title with keyword
2. Hook introduction grabbing attention in first 2 sentences
3. Minimum 5 H2 sections
4. H3 subsections where helpful
5. Practical tips, examples, real data
6. Strong conclusion with call to action
7. No prohibited content (adult, gambling, drugs, hate speech)
8. Natural keyword usage, no stuffing

SEO: keyword in title, first paragraph, 2+ H2s, and conclusion.

Respond ONLY with this JSON:
\`\`\`json
{
  "title": "Full article title",
  "slug": "url-friendly-slug",
  "excerpt": "150-160 char excerpt",
  "content": "# Title\\n\\nFull markdown...",
  "metaTitle": "SEO meta title under 60 chars",
  "metaDesc": "Meta description 150-160 chars",
  "tags": ["tag1","tag2","tag3","tag4","tag5"],
  "schemaJson": "{\\"@context\\":\\"https://schema.org\\",\\"@type\\":\\"Article\\",\\"headline\\":\\"...\\",...}",
  "imagePrompt": "Professional blog featured image about..."
}
\`\`\``;
  const command = new import_client_bedrock_runtime.InvokeModelCommand({
    modelId: process.env.BEDROCK_MODEL_ID ?? "anthropic.claude-sonnet-4-5-20250929-v1:0",
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 8e3,
      temperature: 0.7,
      messages: [{ role: "user", content: prompt }]
    })
  });
  const response = await bedrock.send(command);
  const body = JSON.parse(new TextDecoder().decode(response.body));
  const text = body.content[0].text;
  const match = text.match(/```json\n([\s\S]*?)\n```/);
  if (!match) throw new Error("Invalid JSON response from Bedrock");
  return JSON.parse(match[1]);
}
function checkQuality(content) {
  const issues = [];
  const wordCount = content.trim().split(/\s+/).length;
  if (wordCount < 1500) issues.push(`Word count too low: ${wordCount}`);
  const h2Count = (content.match(/^## /gm) || []).length;
  if (h2Count < 3) issues.push(`Not enough H2s: ${h2Count}`);
  const prohibited = [/\b(casino|gambling)\b/i, /\b(porn|xxx)\b/i, /\b(cocaine|heroin)\b/i];
  for (const p of prohibited) if (p.test(content)) issues.push(`Prohibited: ${p.source}`);
  return { passed: issues.length === 0, wordCount, issues };
}
async function updateTopic(topicId, status, reason) {
  await dynamo.send(new import_client_dynamodb.UpdateItemCommand({
    TableName: process.env.TOPICS_TABLE,
    Key: { id: { S: topicId } },
    UpdateExpression: "SET #s = :s, processedAt = :now" + (reason ? ", failReason = :r" : ""),
    ExpressionAttributeNames: { "#s": "status" },
    ExpressionAttributeValues: {
      ":s": { S: status },
      ":now": { S: (/* @__PURE__ */ new Date()).toISOString() },
      ...reason ? { ":r": { S: reason } } : {}
    }
  }));
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
