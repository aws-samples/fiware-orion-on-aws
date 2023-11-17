import { Construct } from "constructs";
import { Duration } from "aws-cdk-lib";
import { SecurityGroup, IVpc, ISecurityGroup, Port, SubnetType } from "aws-cdk-lib/aws-ec2";
import { ApplicationLoadBalancedFargateService } from "aws-cdk-lib/aws-ecs-patterns";
import { Protocol } from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { Cluster, ContainerImage, Secret, AwsLogDriver } from "aws-cdk-lib/aws-ecs";
import { DocumentdbStack } from "../documentdb-stack";

import * as sm from "aws-cdk-lib/aws-secretsmanager";

interface EcsProps {
  vpc: IVpc;
  cluster: Cluster;
  dockerHubSecret: sm.ISecret | undefined;
  logging: AwsLogDriver;
  docdb: DocumentdbStack;
  publicLoadBalancer?: boolean;
  desiredCount?: number;
  memoryLimitMiB?: number;
  cpu?: number;
  orionLD?: boolean;
}

export class OrionService extends Construct {
  public readonly orionSG: ISecurityGroup;
  public readonly fargateService;

  constructor(scope: Construct, id: string, props: EcsProps) {
    super(scope, id);

    // Orion security group
    this.orionSG = new SecurityGroup(this, "fiware-orion-sg", {
      vpc: props.vpc,
      description: "Orion internal ecs service",
    });

    // Import docdb security group to add access to orion
    const docdbSG = SecurityGroup.fromSecurityGroupId(this, "docdb-security-id", props.docdb.ddbCluster.securityGroupId, {
      mutable: true,
    });
    docdbSG.addIngressRule(this.orionSG, Port.tcp(27017));

    let registryProps = {};
    if (props.dockerHubSecret) {
      registryProps = { credentials: props.dockerHubSecret };
    }

    // Custom task definition to allow custom command exec
    const docdbHostName = props.docdb.ddbCluster.clusterEndpoint.hostname;
    const docdbHostPort = props.docdb.ddbCluster.clusterEndpoint.port;

    let image;
    let secrets;
    let environment;
    let entryPoint = undefined;
    let command = undefined;

    if (props.orionLD) {
      image = "fiware/orion-ld";
      secrets = {
        ORIONLD_MONGO_PASSWORD: Secret.fromSecretsManager(props.docdb.ddbPassSecret),
      };
      environment = {
        ORIONLD_MONGO_USER: props.docdb.ddbUser,
        ORIONLD_MONGOCONLY: "TRUE",
        ORIONLD_MONGO_URI: `mongodb://${props.docdb.ddbUser}:\${PWD}@${docdbHostName}:${docdbHostPort}/?replicaSet=rs0&readPreference=secondaryPreferred&retryWrites=false`,
        ORIONLD_SUBCACHE_IVAL: "3",
        ORIONLD_MONGO_DB: "orionld",
      };
    } else {
      image = "fiware/orion";
      entryPoint = ["/bin/sh", "-c"];
      command = ["/usr/bin/contextBroker -fg -multiservice -ngsiv1Autocast -disableFileLog -rplSet rs0 -dbDisableRetryWrites"];
      secrets = {
        ORION_MONGO_PASSWORD: Secret.fromSecretsManager(props.docdb.ddbPassSecret),
      };
      environment = {
        ORION_MONGO_USER: props.docdb.ddbUser,
        ORION_SUBCACHE_IVAL: "3",
        ORION_MONGO_HOST: `${docdbHostName}:${docdbHostPort}`,
      };
    }

    // Create Fargate Service
    this.fargateService = new ApplicationLoadBalancedFargateService(this, "fiware-orion-service", {
      cluster: props.cluster,
      publicLoadBalancer: props.publicLoadBalancer || true,
      memoryLimitMiB: props.memoryLimitMiB || 2048,
      cpu: props.cpu || 1024,
      listenerPort: 1026,
      circuitBreaker: {
        rollback: true,
      },
      desiredCount: props.desiredCount || 2,
      taskSubnets: props.vpc.selectSubnets({ subnetType: SubnetType.PRIVATE_WITH_EGRESS }),
      securityGroups: [this.orionSG],
      cloudMapOptions: {
        name: "orion",
      },
      taskImageOptions: {
        image: ContainerImage.fromRegistry(image, registryProps),
        secrets,
        environment,
        containerName: "fiware-orion",
        logDriver: props.logging,
        containerPort: 1026,
        entryPoint,
        command,
      },
    });

    // Configure ALB health check
    this.fargateService.targetGroup.configureHealthCheck({
      enabled: true,
      path: props.orionLD ? "/ngsi-ld/ex/v1/version" : "/version",
      port: "1026",
      protocol: Protocol.HTTP,
    });

    // Setup AutoScaling policy
    const scaling = this.fargateService.service.autoScaleTaskCount({ maxCapacity: 10 });
    scaling.scaleOnCpuUtilization("CpuScaling", {
      targetUtilizationPercent: 80,
      scaleInCooldown: Duration.seconds(60),
      scaleOutCooldown: Duration.seconds(60),
    });
  }
}
