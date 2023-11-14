import { Construct } from "constructs";
import { Duration } from "aws-cdk-lib";
import { SecurityGroup, IVpc, ISecurityGroup, Port, SubnetType } from "aws-cdk-lib/aws-ec2";
import { ApplicationLoadBalancedFargateService } from "aws-cdk-lib/aws-ecs-patterns";
import { Protocol } from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { Cluster, ContainerImage, Secret, AwsLogDriver } from "aws-cdk-lib/aws-ecs";
import { AuroraStack } from "../aurora-stack";

import * as sm from "aws-cdk-lib/aws-secretsmanager";

interface EcsProps {
  vpc: IVpc;
  cluster: Cluster;
  dockerHubSecret: sm.ISecret | undefined;
  logging: AwsLogDriver;
  aurora: AuroraStack;
  publicLoadBalancer?: boolean;
  desiredCount?: number;
  memoryLimitMiB?: number;
  cpu?: number;
}

export class CygnusService extends Construct {
  public readonly cygnusSG: ISecurityGroup;
  constructor(scope: Construct, id: string, props: EcsProps) {
    super(scope, id);

    // Aurora RDS
    const aurora = props.aurora.cluster;

    // Orion security group
    this.cygnusSG = new SecurityGroup(this, "fiware-cygnus-sg", {
      vpc: props.vpc,
      description: "Cygnus internal ecs service",
    });

    const sg = aurora.connections.securityGroups;
    const auroraSG = SecurityGroup.fromSecurityGroupId(this, "aurora-security-id", sg[0].securityGroupId, {
      mutable: true,
    });
    auroraSG.addIngressRule(this.cygnusSG, Port.tcp(5432));

    let registryProps = {};
    if (props.dockerHubSecret) {
      registryProps = { credentials: props.dockerHubSecret };
    }

    // Create Fargate Service
    const fargateService = new ApplicationLoadBalancedFargateService(this, "fiware-cygnus-service", {
      cluster: props.cluster,
      publicLoadBalancer: false,
      memoryLimitMiB: props.memoryLimitMiB || 2048,
      desiredCount: props.desiredCount,
      listenerPort: 5080,
      cpu: props.cpu || 1024,
      cloudMapOptions: {
        name: "cygnus",
      },
      circuitBreaker: {
        rollback: true,
      },
      securityGroups: [this.cygnusSG],
      taskSubnets: props.vpc.selectSubnets({ subnetType: SubnetType.PRIVATE_WITH_EGRESS }),
      taskImageOptions: {
        image: ContainerImage.fromRegistry("fiware/cygnus-ngsi", registryProps),
        containerPort: 5080,
        logDriver: props.logging,
        containerName: "fiware-cygnus",
        secrets: {
          CYGNUS_POSTGRESQL_PASS: Secret.fromSecretsManager(props.aurora.auroraSecret),
        },
        environment: {
          CYGNUS_POSTGRESQL_HOST: aurora.clusterEndpoint.hostname,
          CYGNUS_POSTGRESQL_PORT: "5432",
          CYGNUS_POSTGRESQL_USER: props.aurora.username,
          CYGNUS_POSTGRESQL_ENABLE_CACHE: "true",
          CYGNUS_SERVICE_PORT: "5055",
        },
      },
    });

    fargateService.taskDefinition.defaultContainer?.addPortMappings({ containerPort: 5055 });

    // Configure ALB health check
    fargateService.targetGroup.configureHealthCheck({
      enabled: true,
      path: "/v1/version",
      port: "5080",
      protocol: Protocol.HTTP,
    });

    // Setup AutoScaling policy
    const scaling = fargateService.service.autoScaleTaskCount({ maxCapacity: 10 });
    scaling.scaleOnCpuUtilization("CpuScaling", {
      targetUtilizationPercent: 80,
      scaleInCooldown: Duration.seconds(60),
      scaleOutCooldown: Duration.seconds(60),
    });
  }
}
