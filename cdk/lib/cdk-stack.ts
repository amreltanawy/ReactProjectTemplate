import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import { Construct } from 'constructs';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as aws from '@aws-sdk/client-sts';
import { CertificateStack } from './certificate-stack';
interface CdkStackProps extends cdk.StackProps {
  stage: string;
  environmentCredentials?: {
    accessKeyId?: string;
    secretAccessKey?: string;
  };
}

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CdkStackProps) {

    const stackProps = {
      ...props,
      env: {
        ...props.env,
        credentials: props.environmentCredentials ? {
          accessKeyId: props.environmentCredentials.accessKeyId,
          secretAccessKey: props.environmentCredentials.secretAccessKey,
        } : undefined,
      },
    };
    super(scope, id, stackProps);

    const sts = new aws.STS({
      credentials: stackProps.environmentCredentials ? {
        accessKeyId: stackProps.environmentCredentials.accessKeyId!,
        secretAccessKey: stackProps.environmentCredentials.secretAccessKey!
      } : undefined
    });

    sts.getCallerIdentity({}, (err, data) => {
      if (err) console.log("Error", err);
      else if (data) console.log("Account ID:", data.Account);
    });


    const config = {
      domainName: process.env.CDK_DOMAIN_NAME || '',
      hostedZoneId: process.env.CDK_HOSTED_ZONE_ID || '',
      hostedZoneName: process.env.CDK_HOSTED_ZONE_NAME || '',
      bucketName: process.env.CDK_BUCKET_NAME || '',
      region: process.env.CDK_REGION || '',
    };

    const stage = props.stage;

    const certStack = new CertificateStack(this, 'CertificateStack', {
      stage: props.stage,
      domainName: process.env.CDK_DOMAIN_NAME || '',
      hostedZoneId: process.env.CDK_HOSTED_ZONE_ID || '',
      hostedZoneName: process.env.CDK_HOSTED_ZONE_NAME || '',
      certificateArn: process.env.CDK_CERTIFICATE_ARN || ''
    });

    // Add stage suffix to bucket name for different environments
    const bucketName = `${config.bucketName}-${stage}`;

    console.log("\n\n\n\n bucketName", bucketName);
    const bucket = new s3.Bucket(this, 'WebsiteBucket', {
      bucketName: bucketName,
      websiteIndexDocument: 'index.html',
      publicReadAccess: true,
      removalPolicy: stage === 'prod'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
    });

    new s3deploy.BucketDeployment(this, 'DeployWebsite', {
      sources: [s3deploy.Source.asset('../../dist')],
      destinationBucket: bucket,
      // Add cache settings based on environment
      cacheControl: stage === 'prod'
        ? [s3deploy.CacheControl.setPublic(), s3deploy.CacheControl.maxAge(cdk.Duration.days(30))]
        : [s3deploy.CacheControl.noCache()],
    });

    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'CertHostedZone', {
      hostedZoneId: config.hostedZoneId,
      zoneName: config.hostedZoneName
    });
    // Create certificate
    const certificate = certStack.certificate;

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(bucket),
        cachePolicy: stage === 'prod'
          ? cloudfront.CachePolicy.CACHING_OPTIMIZED
          : cloudfront.CachePolicy.CACHING_DISABLED,
      },
      domainNames: [stage === 'prod'
        ? config.domainName
        : `${config.domainName}`],
      certificate,
      defaultRootObject: 'index.html',
    });

    // Add environment-specific tags
    cdk.Tags.of(this).add('Environment', stage);

    // Create A record
    new route53.ARecord(this, 'SiteAliasRecord', {
      zone: hostedZone,
      target: route53.RecordTarget.fromAlias(
        new targets.CloudFrontTarget(distribution)
      ),
      recordName: stage === 'prod'
        ? config.domainName
        : `${stage}.${config.domainName}`
    });

    new cdk.CfnOutput(this, 'WebsiteURL', {
      value: distribution.distributionDomainName,
      description: `Website URL (${stage})`,
    });
  }
}