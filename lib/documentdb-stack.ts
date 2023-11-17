import { RemovalPolicy, SecretValue, Stack, StackProps, aws_docdb, aws_ec2 } from "aws-cdk-lib";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";

export interface DocumentdbStackProps extends StackProps {
  ddbVpc: aws_ec2.Vpc;
  ddbSg: aws_ec2.SecurityGroup;
  username?: string;
  instances?: number;
}

export class DocumentdbStack extends Stack {
  public readonly ddbCluster;
  public readonly securityGroup: aws_ec2.SecurityGroup;
  public readonly ddbPassSecret: Secret;
  public readonly ddbUser: string;

  constructor(scope: Construct, id: string, props: DocumentdbStackProps) {
    super(scope, id, props);

    this.ddbPassSecret = new Secret(this, "DocumentDB Password", {
      secretName: "ddbPassword",
      removalPolicy: RemovalPolicy.DESTROY,
      generateSecretString: {
        excludePunctuation: true,
        excludeCharacters: "/¥'%:;{}",
      },
    });

    const parameterGroup = new aws_docdb.ClusterParameterGroup(this, "DDB_Parameter", {
      dbClusterParameterGroupName: "disabled-tls-parameter2",
      parameters: {
        tls: "disabled",
      },
      family: "docdb4.0",
    });

    this.ddbUser = props.username || "awsdemo";
    this.ddbCluster = new aws_docdb.DatabaseCluster(this, "DDB", {
      masterUser: {
        username: this.ddbUser,
        password: SecretValue.secretsManager(this.ddbPassSecret.secretArn),
      },
      vpc: props.ddbVpc,
      vpcSubnets: props.ddbVpc.selectSubnets({
        subnets: props.ddbVpc.privateSubnets,
      }),
      instanceType: aws_ec2.InstanceType.of(aws_ec2.InstanceClass.R5, aws_ec2.InstanceSize.XLARGE2),
      instances: props.instances,
      engineVersion: "4.0",
      parameterGroup: parameterGroup,
      securityGroup: props.ddbSg,
      removalPolicy: RemovalPolicy.DESTROY,
    });
  }
}
