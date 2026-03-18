#!/usr/bin/env node
import { config } from 'dotenv'
import { resolve } from 'path'
import * as cdk from 'aws-cdk-lib'
import { AiBlogStack } from './stack'

// Load .env from parent directory
config({ path: resolve(__dirname, '..', '.env') })

const app = new cdk.App()

new AiBlogStack(app, 'AiBlogStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
  },
  description: 'AI-powered blog infrastructure with AWS Bedrock',
})
