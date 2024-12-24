// deploy/cdk/lib/certificate-stack.ts
import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';
import { NestedStack, NestedStackProps } from 'aws-cdk-lib';


interface CertificateStackProps extends NestedStackProps {
    stage: string;
    domainName: string;
    hostedZoneId: string;
    hostedZoneName: string;
    certificateArn: string;
}

export class CertificateStack extends NestedStack {
    public readonly certificate: acm.ICertificate;

    constructor(scope: Construct, id: string, props: CertificateStackProps) {
        super(scope, id, props);

        const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'CertHostedZone', {
            hostedZoneId: props.hostedZoneId,
            zoneName: props.hostedZoneName
        });

        this.certificate = acm.Certificate.fromCertificateArn(this, 'SiteCertificate', props.certificateArn);
    }
}