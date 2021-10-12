import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import { Port, SecurityGroup, SubnetType } from '@aws-cdk/aws-ec2';

export class NetworkStack extends cdk.Stack {
  public readonly dbVpc: ec2.Vpc;
  public readonly ddbSg: ec2.SecurityGroup;
  public readonly auroraSg: ec2.SecurityGroup;

  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    const vpc = new ec2.Vpc(this, 'VPC for Orion and Cygnus', {
      cidr: '10.0.0.0/16',
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'public-subnet',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        { cidrMask: 24,
          name: 'db-subnet',
          subnetType: ec2.SubnetType.PRIVATE
        },
      ],
      maxAzs: 4,
    });

    new cdk.CfnOutput(this, "OrionVPCId", {
      value: `${vpc.vpcId}`,
    });

    const subnetsIds = new Array;
    vpc.publicSubnets.forEach((subnet, idx) => {
      subnetsIds.push(subnet.subnetId);  
    });
    new cdk.CfnOutput(this, `OrionPublicSubnetsIds`, {
      value: subnetsIds.join(),
    });
    
    this.dbVpc = vpc;

    // Create orion-alb security group
    const albForOrionSG = new SecurityGroup(this, 'SG for Orion-ALB', {
      vpc: vpc,
      securityGroupName: 'SG for Orion-ALB',
    });
    albForOrionSG.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcpRange(1026, 1030)
    );

    new cdk.CfnOutput(this, "SG-Orion-ALB", {
      value: `${albForOrionSG.securityGroupId}`,
    });

    // Create cygnus-alb security group
    const albForCygnusSG = new SecurityGroup(this, 'SG for Cygnus-ALB', {
      vpc: vpc,
      securityGroupName: 'SG for Cygnus-ALB',
    });
    albForCygnusSG.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(5080));

    new cdk.CfnOutput(this, "SG-Cynus-ALB", {
      value: `${albForCygnusSG.securityGroupId}`,
    });

    // Create orion security group
    const orionSG = new SecurityGroup(this, 'SG for Orion', {
      vpc: vpc,
      securityGroupName: 'SG for Orion',
    });
    orionSG.addIngressRule(albForOrionSG, ec2.Port.tcpRange(1026, 1030));

    new cdk.CfnOutput(this, "SG-Orion", {
      value: `${orionSG.securityGroupId}`,
    });

    // Create cygnus security group
    const cygnusSG = new SecurityGroup(this, 'SG for Cygnus', {
      vpc: vpc,
      securityGroupName: 'SG for Cygnus',
    });
    cygnusSG.addIngressRule(albForCygnusSG, ec2.Port.tcp(5080));
    cygnusSG.addIngressRule(orionSG, ec2.Port.tcp(5055));

    new cdk.CfnOutput(this, "SG-Cygnus", {
      value: `${cygnusSG.securityGroupId}`,
    });

    // Create ddb security group
    const ddbSG = new SecurityGroup(this, 'SG for DDB', {
      vpc: vpc,
      securityGroupName: 'SG for DDB',
    });
    ddbSG.addIngressRule(orionSG, ec2.Port.tcp(27017));
    this.ddbSg = ddbSG;

    // Create aurora security group
    const auroraSG = new SecurityGroup(this, 'SG for Aurora', {
      vpc: vpc,
      securityGroupName: 'SG for Aurora',
    });
    auroraSG.addIngressRule(cygnusSG, ec2.Port.tcp(5432));
    this.auroraSg = auroraSG;
  }
}
