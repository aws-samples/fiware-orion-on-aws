import {
  CfnOutput,
  RemovalPolicy,
  SecretValue,
  Stack,
  StackProps,
  aws_docdb,
  aws_ec2,
} from "aws-cdk-lib";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";

export interface DocumentdbStackProps extends StackProps {
  ddbVpc: aws_ec2.Vpc;
  ddbSg: aws_ec2.SecurityGroup;
}

export class DocumentdbStack extends Stack {
  constructor(scope: Construct, id: string, props: DocumentdbStackProps) {
    super(scope, id, props);
    const ddbPassSecret = new Secret(this, "DocumentDB Password", {
      secretName: "ddbPassword",
      generateSecretString: {
        excludePunctuation: true,
        excludeCharacters: "/¥'%:;{}",
      },
    });

    const parameterGroup = new aws_docdb.ClusterParameterGroup(
      this,
      "DDB_Parameter",
      {
        dbClusterParameterGroupName: "disabled-tls-parameter2",
        parameters: {
          tls: "disabled",
        },
        family: "docdb4.0",
      }
    );

    const ddbCluster = new aws_docdb.DatabaseCluster(this, "DDB", {
      masterUser: {
        username: "awsdemo",
        password: SecretValue.secretsManager(ddbPassSecret.secretArn),
      },
      vpc: props.ddbVpc,
      vpcSubnets: props.ddbVpc.selectSubnets({
        subnetGroupName: "orion-private-subnet",
      }),
      instanceType: aws_ec2.InstanceType.of(
        aws_ec2.InstanceClass.R5,
        aws_ec2.InstanceSize.XLARGE2
      ),
      instances: 2,
      engineVersion: "4.0",
      parameterGroup: parameterGroup,
      securityGroup: props.ddbSg,
    });

    ddbCluster.applyRemovalPolicy(RemovalPolicy.DESTROY);

    new CfnOutput(this, "Docdb-secretArn", {
      value: `${ddbPassSecret.secretArn}`,
    });

    new CfnOutput(this, "Docdb-endpoint", {
      value: `${ddbCluster.clusterEndpoint.hostname}`,
    });
  }
}
