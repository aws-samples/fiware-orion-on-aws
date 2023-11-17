import { Construct } from "constructs";
import { Stack, StackProps, aws_ec2, RemovalPolicy } from "aws-cdk-lib";
import { DocumentdbStack } from "./documentdb-stack";
import { AuroraStack } from "./aurora-stack";
import { OrionService } from "./constructs/Orion";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { Cluster, AwsLogDriver } from "aws-cdk-lib/aws-ecs";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { CygnusService } from "./constructs/Cygnus";
import { Waf } from "./constructs/Waf";
import { Settings } from "../types";

interface FiwareStackProps extends StackProps {
  vpc: aws_ec2.Vpc;
  docdb: DocumentdbStack;
  cygnus: {
    aurora?: AuroraStack;
  };
  settings: Settings;
}

export class FiwareStack extends Stack {
  constructor(scope: Construct, id: string, props: FiwareStackProps) {
    super(scope, id, props);

    const cluster = new Cluster(this, "fiware-cluster-service", { vpc: props.vpc });
    cluster.addDefaultCloudMapNamespace({
      name: "fiware",
    });

    let dockerHubSecret = undefined;
    if (props.settings.dockerHub?.username && props.settings.dockerHub?.password) {
      dockerHubSecret = new Secret(this, "fiware-dockerhub-secret", {
        secretName: "fiware-dockerhub-secret",
        generateSecretString: {
          secretStringTemplate: JSON.stringify({
            username: props.settings.dockerHub?.username,
            password: props.settings.dockerHub?.password,
          }),
          generateStringKey: "secret",
        },
      });
    }

    const logGroup = new LogGroup(this, "fiware-log-group", {
      logGroupName: "Fiware",
      removalPolicy: RemovalPolicy.DESTROY,
      retention: RetentionDays.ONE_YEAR,
    });

    const orionLogging = new AwsLogDriver({
      streamPrefix: "orion",
      logGroup,
    });

    const cygnusLogging = new AwsLogDriver({
      streamPrefix: "cygnus",
      logGroup,
    });

    const orion = new OrionService(this, "orion-service", {
      vpc: props.vpc,
      docdb: props.docdb,
      dockerHubSecret,
      cluster,
      logging: orionLogging,
      publicLoadBalancer: true,
      desiredCount: props.settings.fiware.orion.desiredCount,
      cpu: props.settings.fiware.orion.cpu,
      memoryLimitMiB: props.settings.fiware.orion.memoryLimitMiB,
      orionLD: props.settings.fiware.orion.orionLD,
    });

    if (props.settings.fiware.cygnus && props.cygnus?.aurora) {
      const cygnus = new CygnusService(this, "cygnus", {
        aurora: props.cygnus?.aurora,
        cluster,
        dockerHubSecret,
        logging: cygnusLogging,
        vpc: props.vpc,
        publicLoadBalancer: false,
        desiredCount: props.settings.fiware.cygnus.desiredCount,
        cpu: props.settings.fiware.cygnus.cpu,
        memoryLimitMiB: props.settings.fiware.cygnus.memoryLimitMiB,
      });

      cygnus.cygnusSG.addIngressRule(orion.orionSG, aws_ec2.Port.tcp(5055));
      cygnus.cygnusSG.addIngressRule(orion.orionSG, aws_ec2.Port.tcp(5080));
    }

    const waf = new Waf(this, "orion-waf", {
      useCloudFront: false,
      allowedIps: props.settings.allowedIps || [],
      webACLResourceArn: orion.fargateService.loadBalancer.loadBalancerArn,
    });
  }
}
