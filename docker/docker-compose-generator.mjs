import YAML from "yaml";
import fs from "fs";
import cdk from "../cdk-outputs.json";

function parseYML(path) {
  const file = fs.readFileSync(path, "utf8");
  return YAML.parse(file);
}

function outputYml(path, composeObject) {
  const ymlOutput = YAML.stringify(composeObject);
  fs.writeFileSync(path, ymlOutput, "utf8");
  console.log("Generated docker-compose file. ".concat(path));
}

function parseWaf(path) {
  try {
    console.log("Using WAF rules from ".concat(path));
    return JSON.parse(fs.readFileSync(path, "utf8"));
  } catch (e) {
    console.log("[WARN] waf.json doesn't exist or is not in json format");
  }
}

function hasWafAllowItems(waf) {
  if (waf && waf.ipRatebased && Array.isArray(waf.ipRatebased.allowList) && waf.ipRatebased.allowList.length > 0) {
    return true;
  }
  console.warn("[WARN] WAF Allow list is empty, this makes the service to be public");
  return false;
}

function hasWafDenyItems(waf) {
  if (waf && waf.ipRestriction && Array.isArray(waf.ipRestriction.denyList) && waf.ipRestriction.denyList.length > 0) {
    return true;
  }
  console.log("[NOTICE] WAF Deny list is empty.");
  return false;
}

function configureAllowWaf(map, waf) {
  const resources = map["x-aws-cloudformation"].Resources;
  if (hasWafAllowItems(waf)) {
    if (Array.isArray(resources.WebACL.DependsOn)) {
      resources.WebACL.DependsOn.push("IPAllowList");
    } else {
      resources.WebACL.DependsOn = ["IPAllowList"];
    }
    resources.IPAllowList.Properties.Addresses = waf.ipRatebased.allowList;
  } else {
    delete resources.IPAllowList;
    resources.WebACL.Properties.Rules.forEach((r, i) => {
      if (r.Name === "Custom-Ratebased") {
        resources.WebACL.Properties.Rules.splice(i, 1);
      }
    });
  }
}

function configureDenyWaf(map, waf) {
  const resources = map["x-aws-cloudformation"].Resources;
  if (hasWafDenyItems(waf)) {
    if (Array.isArray(resources.WebACL.DependsOn)) {
      resources.WebACL.DependsOn.push("IPDenyList");
    } else {
      resources.WebACL.DependsOn = ["IPDenyList"];
    }
    resources.IPDenyList.Properties.Addresses = waf.ipRestriction.denyList;
  } else {
    delete resources.IPDenyList;
    resources.WebACL.Properties.Rules.forEach((r, i) => {
      if (r.Name === "Custom-IPaddress-DenyList") {
        resources.WebACL.Properties.Rules.splice(i, 1);
      }
    });
  }
}

try {
  const cygnusSample = "./docker/cygnus/docker-compose.yml.sample";
  const orionSample = "./docker/orion/docker-compose.yml.sample";

  const waf = parseWaf("waf.json");
  const orion = parseYML(orionSample);
  const cygnus = parseYML(cygnusSample);

  configureDenyWaf(orion, waf);
  configureDenyWaf(cygnus, waf);
  configureAllowWaf(orion, waf);
  configureAllowWaf(cygnus, waf);

  // Map vars for orion
  orion["x-aws-vpc"] = cdk.Network.OrionVPCId;
  orion["x-aws-cloudformation"].Resources.OrionTCP1026TargetGroup.Properties.VpcId = cdk.Network.OrionVPCId;
  orion["x-aws-cloudformation"].Resources.LoadBalancer.Properties.SecurityGroups = [cdk.Network.SGOrionALB];
  orion["x-aws-cloudformation"].Resources.LoadBalancer.Properties.Subnets = cdk.Network.OrionPublicSubnetsIds.split(",");
  orion.networks["orion-sg"].name = cdk.Network.SGOrion;
  orion.services.orion.environment = {};
  orion.services.orion.environment.DOCDB_ENDPOINT = cdk.DocumentdbStack.Docdbendpoint;
  orion.services.orion.environment.DOCDB_USER = "awsdemo";
  orion.services.orion.environment.DOCDB_LOGS_LEVEL = "DEBUG";
  orion.secrets.docdb_password.name = cdk.DocumentdbStack.DocdbsecretArn;

  outputYml("./docker/orion/docker-compose.yml", orion);

  // Map vars for cygnus
  cygnus["x-aws-vpc"] = cdk.Network.OrionVPCId;
  cygnus.secrets.postgres_password.name = cdk.AuroraStack.AuroraSecretArn;

  cygnus.services.cygnus.environment[0] = `CYGNUS_POSTGRESQL_HOST=${cdk.AuroraStack.AuroraEndpoint}`;

  cygnus["x-aws-cloudformation"].Resources.CygnusTCP5080TargetGroup.Properties.VpcId = cdk.Network.OrionVPCId;
  cygnus["x-aws-cloudformation"].Resources.LoadBalancer.Properties.SecurityGroups = [cdk.Network.SGCynusALB];
  cygnus["x-aws-cloudformation"].Resources.LoadBalancer.Properties.Subnets = cdk.Network.OrionPublicSubnetsIds.split(",");
  cygnus.networks["cygnus-sg"].name = cdk.Network.SGCygnus;

  outputYml("./docker/cygnus/docker-compose.yml", cygnus);
} catch (e) {
  console.log(e);
}
