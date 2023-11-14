import { RemovalPolicy, SecretValue, Stack, StackProps, aws_ec2, aws_rds } from "aws-cdk-lib";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";

export interface AuroraStackProps extends StackProps {
  auroraVpc: aws_ec2.Vpc;
  auroraSg: aws_ec2.SecurityGroup;
  username?: string;
  dataApi?: boolean;
}
export class AuroraStack extends Stack {
  public readonly auroraSecret: Secret;
  public readonly username: string;
  public readonly cluster;
  constructor(scope: Construct, id: string, props: AuroraStackProps) {
    super(scope, id, props);

    this.auroraSecret = new Secret(this, "Aurora Password", {
      secretName: "auroraPassword",
      removalPolicy: RemovalPolicy.DESTROY,
      generateSecretString: {
        excludePunctuation: true,
        excludeCharacters: "/¥'%:;{}",
      },
    });

    this.username = props.username || "postgres";

    this.cluster = new aws_rds.ServerlessCluster(this, "Aurora for Cygnus", {
      engine: aws_rds.DatabaseClusterEngine.auroraPostgres({ version: aws_rds.AuroraPostgresEngineVersion.VER_13_9 }),
      credentials: {
        username: this.username,
        password: SecretValue.secretsManager(this.auroraSecret.secretArn),
      },
      vpc: props.auroraVpc,
      vpcSubnets: props.auroraVpc.selectSubnets({
        subnets: props.auroraVpc.privateSubnets,
      }),
      securityGroups: [props.auroraSg],
      enableDataApi: props.dataApi || true,
    });
  }
}
