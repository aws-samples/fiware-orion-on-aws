import { RemovalPolicy, Stack, StackProps, aws_ec2 } from "aws-cdk-lib";
import { IpAddresses, FlowLogDestination, FlowLogTrafficType } from "aws-cdk-lib/aws-ec2";
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
  public readonly cygnusSg: aws_ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: NetworkProps) {
    super(scope, id, props);

    const cwLogs = new LogGroup(this, "orion-vpc-logs", {
      logGroupName: "/orion/vpc",
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
        {
          cidrMask: props.cidrMask,
          name: "orion-isolated-subnet",
          subnetType: aws_ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
      maxAzs: props.maxAzs,
      flowLogs: {
        FlowLogGroup: {
          trafficType: FlowLogTrafficType.REJECT,
          destination: FlowLogDestination.toCloudWatchLogs(cwLogs),
        },
      },
    });

    // Documentdb security group
    this.ddbSg = new aws_ec2.SecurityGroup(this, "SG for DDB", {
      vpc,
      description: "Fiware-Orion allow connection to DDB",
    });

    // Aurora security group
    this.auroraSg = new aws_ec2.SecurityGroup(this, "SG for Aurora", {
      vpc,
      description: "Fiware-Cygnus allow connection to Aurora psql",
    });

    // Expose security groups and vpc
    this.vpc = vpc;
  }
}
