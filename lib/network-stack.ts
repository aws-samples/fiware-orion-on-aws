import {
  CfnOutput,
  RemovalPolicy,
  Stack,
  StackProps,
  aws_ec2,
} from "aws-cdk-lib";
import { IpAddresses } from "aws-cdk-lib/aws-ec2";
import { LogGroup } from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";

interface NetworkProps extends StackProps {
  cidr: string;
  maxAzs: number;
  cidrMask: number;
}

export class NetworkStack extends Stack {
  public readonly vpc: aws_ec2.Vpc;
  public readonly ddbSg: aws_ec2.SecurityGroup;
  public readonly auroraSg: aws_ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: NetworkProps) {
    super(scope, id, props);
    const cwLogs = new LogGroup(this, "orion-vpc-logs", {
      logGroupName: "/aws/vpc/flowlogs",
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const vpc = new aws_ec2.Vpc(this, "VPC for Orion and Cygnus", {
      ipAddresses: IpAddresses.cidr(props.cidr),
      subnetConfiguration: [
        {
          cidrMask: props.cidrMask,
          name: "orion-public-subnet",
          subnetType: aws_ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: props.cidrMask,
          name: "orion-private-subnet",
          subnetType: aws_ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
      maxAzs: props.maxAzs,
      flowLogs: {
        s3: {
          destination: aws_ec2.FlowLogDestination.toCloudWatchLogs(cwLogs),
          trafficType: aws_ec2.FlowLogTrafficType.ALL,
        },
      },
    });

    // Cygnus security group
    const cygnusSG = new aws_ec2.SecurityGroup(this, "SG for Cygnus", {
      vpc,
      description: "Fiware-Cygnus internal services",
    });

    // Orion security group
    const orionSG = new aws_ec2.SecurityGroup(this, "SG for Orion", {
      vpc,
      description: "Fiware-Orion internal services",
    });

    // Documentdb security group
    const ddbSG = new aws_ec2.SecurityGroup(this, "SG for DDB", {
      vpc,
      description: "Fiware-Orion allow connection to DDB",
    });

    // Aurora security group
    const auroraSG = new aws_ec2.SecurityGroup(this, "SG for Aurora", {
      vpc,
      description: "Fiware-Cygnus allow connection to Aurora psql",
    });

    // ALB Orion security group
    const albForOrionSG = new aws_ec2.SecurityGroup(this, "SG for Orion-ALB", {
      vpc,
      description: "Fiware-Orion allow internet access to API",
    });

    // ALB Cygnus security group
    const albForCygnusSG = new aws_ec2.SecurityGroup(
      this,
      "SG for Cygnus-ALB",
      {
        vpc,
        description: "Fiware-Cygnus allow internet access to managment API",
      }
    );

    const publicSubnetsIds = new Array();
    vpc.publicSubnets.forEach((subnet) => {
      publicSubnetsIds.push(subnet.subnetId);
    });

    const privateSubnetsIds = new Array();
    vpc.privateSubnets.forEach((subnet) => {
      privateSubnetsIds.push(subnet.subnetId);
    });

    // Orion rules: Allow Cygnus http service, ALB
    orionSG.addIngressRule(albForOrionSG, aws_ec2.Port.tcp(1026));

    // Documentdb rules: Allow Orion
    ddbSG.addIngressRule(orionSG, aws_ec2.Port.tcp(27017));

    // Aurora rules: Allow cygnus
    auroraSG.addIngressRule(cygnusSG, aws_ec2.Port.tcp(5432));

    // Cygnus rules: Allow orion to cygnus synk, ALB and egress to reach Orion API
    cygnusSG.addIngressRule(orionSG, aws_ec2.Port.tcp(5055));
    cygnusSG.addIngressRule(albForCygnusSG, aws_ec2.Port.tcp(5055));
    cygnusSG.addIngressRule(albForCygnusSG, aws_ec2.Port.tcp(5080));

    // ALB Orion and Cynus
    albForOrionSG.addIngressRule(
      aws_ec2.Peer.anyIpv4(),
      aws_ec2.Port.tcp(1026)
    );
    albForCygnusSG.addIngressRule(orionSG, aws_ec2.Port.tcp(5055));

    // Expose security groups and vpc
    this.vpc = vpc;
    this.ddbSg = ddbSG;
    this.auroraSg = auroraSG;

    // Outputs
    new CfnOutput(this, "OrionVPCId", {
      value: `${vpc.vpcId}`,
    });

    new CfnOutput(this, `OrionPublicSubnetsIds`, {
      value: publicSubnetsIds.join(),
    });

    new CfnOutput(this, `OrionPrivateSubnetsIds`, {
      value: privateSubnetsIds.join(),
    });

    new CfnOutput(this, "SG-Orion-ALB", {
      value: `${albForOrionSG.securityGroupId}`,
    });

    new CfnOutput(this, "SG-Cygnus", {
      value: `${cygnusSG.securityGroupId}`,
    });

    new CfnOutput(this, "SG-Orion", {
      value: `${orionSG.securityGroupId}`,
    });

    new CfnOutput(this, "SG-Cynus-ALB", {
      value: `${albForCygnusSG.securityGroupId}`,
    });
  }
}
