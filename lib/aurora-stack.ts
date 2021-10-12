import * as cdk from "@aws-cdk/core";
import * as ec2 from "@aws-cdk/aws-ec2";
import * as rds from "@aws-cdk/aws-rds";
import { Secret } from "@aws-cdk/aws-secretsmanager";
import { SecretValue } from "@aws-cdk/core";

export interface AuroraStackProps extends cdk.StackProps {
  auroraVpc: ec2.Vpc;
  auroraSg: ec2.SecurityGroup;
}
export class AuroraStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: AuroraStackProps) {
    super(scope, id, props);

    const auroraPassSecret = new Secret(this, "AuroraPassword Password", {
      secretName: "auroraPassword",
      generateSecretString: {
        excludePunctuation: true,
        excludeCharacters: "/¥'%:;{}",
      },
    });

    const cluster = new rds.ServerlessCluster(this, "Aurora for Cygnus", {
      engine: rds.DatabaseClusterEngine.AURORA_POSTGRESQL,
      credentials: {
        username: "postgres",
        password: SecretValue.secretsManager(auroraPassSecret.secretArn),
      },
      vpc: props.auroraVpc,
      vpcSubnets: props.auroraVpc.selectSubnets({
        subnetGroupName: "db-subnet",
      }),
      securityGroups: [props.auroraSg],
      parameterGroup: rds.ParameterGroup.fromParameterGroupName(
        this,
        "CygnusdbParameterGroup",
        "default.aurora-postgresql10"
      ),
    });

    new cdk.CfnOutput(this, "Aurora-Endpoint", {
      value: `${cluster.clusterEndpoint.hostname}`,
    });

    new cdk.CfnOutput(this, "Aurora-SecretArn", {
      value: `${auroraPassSecret.secretArn}`,
    });
  }
}
