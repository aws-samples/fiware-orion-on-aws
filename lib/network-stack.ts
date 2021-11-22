import * as cdk from "@aws-cdk/core";
import * as ec2 from "@aws-cdk/aws-ec2";
import * as logs from "@aws-cdk/aws-logs";

export class NetworkStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly ddbSg: ec2.SecurityGroup;
  public readonly auroraSg: ec2.SecurityGroup;

  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    const cwLogs = new logs.LogGroup(this, "orion-vpc-logs", {
      logGroupName: "/aws/vpc/flowlogs",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const vpc = new ec2.Vpc(this, "VPC for Orion and Cygnus", {
      cidr: "10.0.0.0/16",
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "orion-public-subnet",
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: "orion-private-subnet",
          subnetType: ec2.SubnetType.PRIVATE_WITH_NAT,
        },
      ],
      maxAzs: 4,
      flowLogs: {
        s3: {
          destination: ec2.FlowLogDestination.toCloudWatchLogs(cwLogs),
          trafficType: ec2.FlowLogTrafficType.ALL,
        },
      },
    });

    // Cygnus security group
    const cygnusSG = new ec2.SecurityGroup(this, "SG for Cygnus", {
      vpc,
      description: "Fiware-Cygnus internal services",
    });

    // Orion security group
    const orionSG = new ec2.SecurityGroup(this, "SG for Orion", {
      vpc,
      description: "Fiware-Orion internal services",
    });

    // Documentdb security group
    const ddbSG = new ec2.SecurityGroup(this, "SG for DDB", {
      vpc,
      description: "Fiware-Orion allow connection to DDB",
    });

    // Aurora security group
    const auroraSG = new ec2.SecurityGroup(this, "SG for Aurora", {
      vpc,
      description: "Fiware-Cygnus allow connection to Aurora psql",
    });

    // ALB Orion security group
    const albForOrionSG = new ec2.SecurityGroup(this, "SG for Orion-ALB", {
      vpc,
      description: "Fiware-Orion allow internet access to API",
    });

    // ALB Cygnus security group
    const albForCygnusSG = new ec2.SecurityGroup(this, "SG for Cygnus-ALB", {
      vpc,
      description: "Fiware-Cygnus allow internet access to managment API",
    });

    const publicSubnetsIds = new Array();
    vpc.publicSubnets.forEach((subnet) => {
      publicSubnetsIds.push(subnet.subnetId);
    });

    const privateSubnetsIds = new Array();
    vpc.privateSubnets.forEach((subnet) => {
      privateSubnetsIds.push(subnet.subnetId);
    });

    // Orion rules: Allow Cygnus http service, ALB
    orionSG.addIngressRule(albForOrionSG, ec2.Port.tcp(1026));

    // Documentdb rules: Allow Orion
    ddbSG.addIngressRule(orionSG, ec2.Port.tcp(27017));

    // Aurora rules: Allow cygnus
    auroraSG.addIngressRule(cygnusSG, ec2.Port.tcp(5432));

    // Cygnus rules: Allow orion to cygnus synk, ALB and egress to reach Orion API
    cygnusSG.addIngressRule(orionSG, ec2.Port.tcp(5055));
    cygnusSG.addIngressRule(albForCygnusSG, ec2.Port.tcp(5055));
    cygnusSG.addIngressRule(albForCygnusSG, ec2.Port.tcp(5080));

    // ALB Orion and Cynus
    albForOrionSG.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(1026));
    albForCygnusSG.addIngressRule(orionSG, ec2.Port.tcp(5055));

    // Expose security groups and vpc
    this.vpc = vpc;
    this.ddbSg = ddbSG;
    this.auroraSg = auroraSG;

    // Outputs
    new cdk.CfnOutput(this, "OrionVPCId", {
      value: `${vpc.vpcId}`,
    });

    new cdk.CfnOutput(this, `OrionPublicSubnetsIds`, {
      value: publicSubnetsIds.join(),
    });

    new cdk.CfnOutput(this, `OrionPrivateSubnetsIds`, {
      value: privateSubnetsIds.join(),
    });

    new cdk.CfnOutput(this, "SG-Orion-ALB", {
      value: `${albForOrionSG.securityGroupId}`,
    });

    new cdk.CfnOutput(this, "SG-Cygnus", {
      value: `${cygnusSG.securityGroupId}`,
    });

    new cdk.CfnOutput(this, "SG-Orion", {
      value: `${orionSG.securityGroupId}`,
    });

    new cdk.CfnOutput(this, "SG-Cynus-ALB", {
      value: `${albForCygnusSG.securityGroupId}`,
    });
  }
}
