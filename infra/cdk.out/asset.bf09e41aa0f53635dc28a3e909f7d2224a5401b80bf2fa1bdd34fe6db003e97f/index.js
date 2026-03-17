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

// ../lambda/publisher/index.ts
var publisher_exports = {};
__export(publisher_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(publisher_exports);
var import_client_bedrock_runtime = require("@aws-sdk/client-bedrock-runtime");
var import_client_s3 = require("@aws-sdk/client-s3");
var import_client_dynamodb = require("@aws-sdk/client-dynamodb");
var bedrock = new import_client_bedrock_runtime.BedrockRuntimeClient({ region: process.env.AWS_REGION });
var s3 = new import_client_s3.S3Client({ region: process.env.AWS_REGION });
var dynamo = new import_client_dynamodb.DynamoDBClient({ region: process.env.AWS_REGION });
var handler = async (event) => {
  const { topicId, category, wordCount, readingTime, article } = event;
  let featuredImage;
  try {
    featuredImage = await generateAndUploadImage(article.imagePrompt, article.slug);
    console.log(`Image uploaded: ${featuredImage}`);
  } catch (err) {
    console.warn("Image generation failed, continuing without image:", err);
  }
  const res = await fetch(`${process.env.NEXTJS_SITE_URL}/api/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret: process.env.WEBHOOK_SECRET,
      title: article.title,
      slug: article.slug,
      excerpt: article.excerpt,
      content: article.content,
      metaTitle: article.metaTitle,
      metaDesc: article.metaDesc,
      categoryName: category,
      tags: article.tags,
      schemaJson: article.schemaJson,
      featuredImage,
      wordCount,
      readingTime
    })
  });
  if (!res.ok) {
    const err = await res.text();
    await updateTopic(topicId, "FAILED", err);
    throw new Error(`Webhook failed: ${res.status} \u2014 ${err}`);
  }
  const result = await res.json();
  await updateTopic(topicId, "DONE");
  console.log(`Published postId: ${result.postId}`);
  return { success: true, postId: result.postId, slug: article.slug };
};
async function generateAndUploadImage(prompt, slug) {
  const command = new import_client_bedrock_runtime.InvokeModelCommand({
    modelId: "amazon.titan-image-generator-v1",
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      taskType: "TEXT_IMAGE",
      textToImageParams: {
        text: prompt,
        negativeText: "blurry, low quality, watermark, text overlay, faces, nsfw"
      },
      imageGenerationConfig: {
        numberOfImages: 1,
        height: 1024,
        width: 1792,
        cfgScale: 8
      }
    })
  });
  const response = await bedrock.send(command);
  const body = JSON.parse(new TextDecoder().decode(response.body));
  const imageBase64 = body.images[0];
  const key = `blog-images/${slug}-${Date.now()}.jpg`;
  await s3.send(new import_client_s3.PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: Buffer.from(imageBase64, "base64"),
    ContentType: "image/jpeg",
    CacheControl: "public, max-age=31536000"
  }));
  return `https://${process.env.CLOUDFRONT_DOMAIN}/${key}`;
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
