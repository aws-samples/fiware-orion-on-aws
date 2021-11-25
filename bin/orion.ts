#!/usr/bin/env node
import * as cdk from "@aws-cdk/core";
import { DocumentdbStack } from "../lib/documentdb-stack";
import { NetworkStack } from "../lib/network-stack";
import { AuroraStack } from "../lib/aurora-stack";

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const nw = new NetworkStack(app, "Network", { env });

new DocumentdbStack(app, "DocumentdbStack", {
  ddbVpc: nw.vpc,
  ddbSg: nw.ddbSg,
  env,
});

new AuroraStack(app, "AuroraStack", {
  auroraVpc: nw.vpc,
  auroraSg: nw.auroraSg,
  env,
});
