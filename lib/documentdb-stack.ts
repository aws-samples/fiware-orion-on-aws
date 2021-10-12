import * as cdk from '@aws-cdk/core';
import * as ddb from '@aws-cdk/aws-docdb'
import * as ec2 from '@aws-cdk/aws-ec2'
import { Secret } from '@aws-cdk/aws-secretsmanager';
import { SecretValue } from '@aws-cdk/core';

export interface DocumentdbStackProps extends cdk.StackProps{
  ddbVpc:ec2.Vpc,
  ddbSg: ec2.SecurityGroup
}

export class DocumentdbStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: DocumentdbStackProps) {
    super(scope, id, props);
    const ddbPassSecret = new Secret(this,'DocumentDB Password',{
        secretName:'ddbPassword',
        generateSecretString:{
          excludePunctuation:true,
          excludeCharacters:"/¥'%:;{}"
        }
    })
    
    const parameterGroup = new ddb.ClusterParameterGroup(this,"DDB_Parameter",{
      dbClusterParameterGroupName:'disabled-tls-parameter2',
      parameters:{
        tls:'disabled'
      },
      family:'docdb4.0'
    })
    
    const ddbCluster = new ddb.DatabaseCluster(this,"DDB",{
      masterUser:{
        username:'awsdemo',
        password: SecretValue.secretsManager(ddbPassSecret.secretArn)
        },
      vpc: props.ddbVpc,
      vpcSubnets:props.ddbVpc.selectSubnets({subnetGroupName:'db-subnet'}),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.R5, ec2.InstanceSize.XLARGE2),
      instances:2,
      engineVersion: '4.0',
      parameterGroup:parameterGroup,
    })
    
    ddbCluster.addSecurityGroups(props.ddbSg)
    ddbCluster.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY)
    
    new cdk.CfnOutput(this, "Docdb-secretArn", {
      value: `${ddbPassSecret.secretArn}`,
    });

    new cdk.CfnOutput(this, "Docdb-endpoint", {
      value: `${ddbCluster.clusterEndpoint.hostname}`,
    });

  }
}
