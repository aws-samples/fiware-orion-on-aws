import {
  CfnOutput,
  SecretValue,
  Stack,
  StackProps,
  aws_ec2,
  aws_rds,
} from "aws-cdk-lib";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";

export interface AuroraStackProps extends StackProps {
  auroraVpc: aws_ec2.Vpc;
  auroraSg: aws_ec2.SecurityGroup;
}
export class AuroraStack extends Stack {
  constructor(scope: Construct, id: string, props: AuroraStackProps) {
    super(scope, id, props);

    const auroraPassSecret = new Secret(this, "Aurora Password", {
      secretName: "auroraPassword",
      generateSecretString: {
        excludePunctuation: true,
        excludeCharacters: "/¥'%:;{}",
      },
    });

    const cluster = new aws_rds.ServerlessCluster(this, "Aurora for Cygnus", {
      engine: aws_rds.DatabaseClusterEngine.AURORA_POSTGRESQL,
      credentials: {
        username: "postgres",
        password: SecretValue.secretsManager(auroraPassSecret.secretArn),
      },
      vpc: props.auroraVpc,
      vpcSubnets: props.auroraVpc.selectSubnets({
        subnetGroupName: "orion-private-subnet",
      }),
      securityGroups: [props.auroraSg],
      enableDataApi: true,
      parameterGroup: aws_rds.ParameterGroup.fromParameterGroupName(
        this,
        "CygnusdbParameterGroup",
        "default.aurora-postgresql13"
      ),
    });

    new CfnOutput(this, "Aurora-Endpoint", {
      value: `${cluster.clusterEndpoint.hostname}`,
    });

    new CfnOutput(this, "Aurora-SecretArn", {
      value: `${auroraPassSecret.secretArn}`,
    });
  }
}
