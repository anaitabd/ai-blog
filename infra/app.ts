#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib'
import { AiBlogStack } from './stack'

const app = new cdk.App()

new AiBlogStack(app, 'AiBlogStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
  },
  description: 'AI-powered blog infrastructure with AWS Bedrock',
})
