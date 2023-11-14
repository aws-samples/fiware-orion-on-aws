#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";

import { DocumentdbStack } from "../lib/documentdb-stack";
import { NetworkStack } from "../lib/network-stack";
import { AuroraStack } from "../lib/aurora-stack";
import { FiwareStack } from "../lib/fiware-stack";

import { settings } from "../settings";

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: settings.region || process.env.AWS_REGION || process.env.CDK_DEFAULT_REGION,
};

const nw = new NetworkStack(app, "Network", {
  cidr: "10.0.0.0/16",
  cidrMask: 24,
  maxAzs: 4,
  env,
});

const documentDB = new DocumentdbStack(app, "DocumentdbStack", {
  ddbVpc: nw.vpc,
  ddbSg: nw.ddbSg,
  username: settings.fiware.orion.ddbuser,
  env,
});

let aurora;

if (settings.fiware.cygnus) {
  aurora = new AuroraStack(app, "AuroraStack", {
    auroraVpc: nw.vpc,
    auroraSg: nw.auroraSg,
    username: settings.fiware.cygnus.aurora.dbusername,
    env,
  });
}

const orion = new FiwareStack(app, "FiwareStack", {
  vpc: nw.vpc,
  docdb: documentDB,
  settings,
  cygnus: {
    aurora,
  },
  env,
});
