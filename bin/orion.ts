#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { DocumentdbStack } from '../lib/documentdb-stack';
import { NetworkStack } from '../lib/network-stack';
import {AuroraStack} from '../lib/aurora-stack'
const app = new cdk.App();

const nw = new NetworkStack(app, 'Network', {
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION,
    }
  }
);

const ddb = new DocumentdbStack(app, 'DocumentdbStack',{
  ddbVpc:nw.dbVpc,
  ddbSg: nw.ddbSg,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  }
});

ddb.addDependency(nw)

const aurora = new AuroraStack(app, 'AuroraStack', {
  auroraVpc:nw.dbVpc,
  auroraSg:nw.auroraSg,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  }
})

aurora.addDependency(nw)