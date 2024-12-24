#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CdkStack } from '../lib/cdk-stack';

const app = new cdk.App();
console.log("\n\n\n\n process.env.STAGE", process.env.STAGE);
const stage = process.env.STAGE || 'dev';

new CdkStack(app, `CdkStack-${stage}`, {
  env: {
    account: process.env.CDK_ACCOUNT_ID,
    region: process.env.CDK_REGION
  },
  stage: stage,
  environmentCredentials: {
    accessKeyId: process.env.CDK_ACCESS_KEY_ID,
    secretAccessKey: process.env.CDK_SECRET_ACCESS_KEY,
  },
});