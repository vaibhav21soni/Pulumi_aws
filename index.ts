import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as aws_native from "@pulumi/aws-native";

// Get configuration values
const config = new pulumi.Config();
const myIp = config.get("myIp") || "0.0.0.0/0"; // Set via: pulumi config set myIp <your-ip>

// Get available AZs for the region
const availableAzs = aws.getAvailabilityZones({
    state: "available",
});

// 1. Create a VPC
const vpc = new aws.ec2.Vpc("customVpc", {
    cidrBlock: "10.0.0.0/16",
    enableDnsHostnames: true,
    enableDnsSupport: true,
    tags: {
        Name: "customVpc",
        Environment: "dev",
    },
});

// 2. Create public and private subnets across multiple AZs
const publicSubnet1 = new aws.ec2.Subnet("publicSubnet1", {
    vpcId: vpc.id,
    cidrBlock: "10.0.1.0/24",
    availabilityZone: availableAzs.then(azs => azs.names[0]),
    mapPublicIpOnLaunch: true,
    tags: {
        Name: "public-subnet-1",
        Type: "public",
    },
});

const publicSubnet2 = new aws.ec2.Subnet("publicSubnet2", {
    vpcId: vpc.id,
    cidrBlock: "10.0.2.0/24",
    availabilityZone: availableAzs.then(azs => azs.names[1]),
    mapPublicIpOnLaunch: true,
    tags: {
        Name: "public-subnet-2",
        Type: "public",
    },
});

const privateSubnet1 = new aws.ec2.Subnet("privateSubnet1", {
    vpcId: vpc.id,
    cidrBlock: "10.0.3.0/24",
    availabilityZone: availableAzs.then(azs => azs.names[0]),
    tags: {
        Name: "private-subnet-1",
        Type: "private",
    },
});

const privateSubnet2 = new aws.ec2.Subnet("privateSubnet2", {
    vpcId: vpc.id,
    cidrBlock: "10.0.4.0/24",
    availabilityZone: availableAzs.then(azs => azs.names[1]),
    tags: {
        Name: "private-subnet-2",
        Type: "private",
    },
});

// 3. Internet Gateway (IGW) and attach to VPC
const igw = new aws.ec2.InternetGateway("vpcInternetGateway", {
    vpcId: vpc.id,
    tags: {
        Name: "vpc-igw",
        Environment: "dev",
    },
});

// 4. Elastic IPs for NAT Gateways
const natEip1 = new aws.ec2.Eip("natEip1", {
    domain: "vpc",
    tags: {
        Name: "nat-eip-1",
    },
}, { dependsOn: [igw] });

const natEip2 = new aws.ec2.Eip("natEip2", {
    domain: "vpc",
    tags: {
        Name: "nat-eip-2",
    },
}, { dependsOn: [igw] });

// 5. NAT Gateways for private subnet internet access
const natGateway1 = new aws.ec2.NatGateway("natGateway1", {
    allocationId: natEip1.id,
    subnetId: publicSubnet1.id,
    tags: {
        Name: "nat-gateway-1",
    },
}, { dependsOn: [igw] });

const natGateway2 = new aws.ec2.NatGateway("natGateway2", {
    allocationId: natEip2.id,
    subnetId: publicSubnet2.id,
    tags: {
        Name: "nat-gateway-2",
    },
}, { dependsOn: [igw] });

// 6. Public Route Table and Route
const publicRouteTable = new aws.ec2.RouteTable("publicRouteTable", {
    vpcId: vpc.id,
    routes: [
        { 
            cidrBlock: "0.0.0.0/0", 
            gatewayId: igw.id 
        }
    ],
    tags: {
        Name: "public-route-table",
        Environment: "dev",
    },
});

// Associate route table to public subnets
new aws.ec2.RouteTableAssociation("publicRouteTableAssoc1", {
    subnetId: publicSubnet1.id,
    routeTableId: publicRouteTable.id
});

new aws.ec2.RouteTableAssociation("publicRouteTableAssoc2", {
    subnetId: publicSubnet2.id,
    routeTableId: publicRouteTable.id
});

// 7. Private Route Tables with NAT Gateway routes
const privateRouteTable1 = new aws.ec2.RouteTable("privateRouteTable1", {
    vpcId: vpc.id,
    routes: [
        {
            cidrBlock: "0.0.0.0/0",
            natGatewayId: natGateway1.id
        }
    ],
    tags: {
        Name: "private-route-table-1",
        Environment: "dev",
    }
});

const privateRouteTable2 = new aws.ec2.RouteTable("privateRouteTable2", {
    vpcId: vpc.id,
    routes: [
        {
            cidrBlock: "0.0.0.0/0",
            natGatewayId: natGateway2.id
        }
    ],
    tags: {
        Name: "private-route-table-2",
        Environment: "dev",
    }
});

new aws.ec2.RouteTableAssociation("privateRouteTableAssoc1", {
    subnetId: privateSubnet1.id,
    routeTableId: privateRouteTable1.id
});

new aws.ec2.RouteTableAssociation("privateRouteTableAssoc2", {
    subnetId: privateSubnet2.id,
    routeTableId: privateRouteTable2.id
});

// 8. Security Groups with proper security rules

// Web Security Group - for web servers (HTTP/HTTPS)
const webSg = new aws.ec2.SecurityGroup("webSg", {
    vpcId: vpc.id,
    description: "Security group for web servers",
    ingress: [
        {
            description: "HTTP",
            protocol: "tcp",
            fromPort: 80,
            toPort: 80,
            cidrBlocks: ["0.0.0.0/0"],
        },
        {
            description: "HTTPS",
            protocol: "tcp",
            fromPort: 443,
            toPort: 443,
            cidrBlocks: ["0.0.0.0/0"],
        },
        {
            description: "SSH from my IP",
            protocol: "tcp",
            fromPort: 22,
            toPort: 22,
            cidrBlocks: [myIp],
        }
    ],
    egress: [{
        description: "All outbound traffic",
        protocol: "-1",
        fromPort: 0,
        toPort: 0,
        cidrBlocks: ["0.0.0.0/0"],
    }],
    tags: {
        Name: "web-security-group",
        Environment: "dev",
    },
});

// Database Security Group - for database servers
const dbSg = new aws.ec2.SecurityGroup("dbSg", {
    vpcId: vpc.id,
    description: "Security group for database servers",
    ingress: [
        {
            description: "MySQL/Aurora",
            protocol: "tcp",
            fromPort: 3306,
            toPort: 3306,
            securityGroups: [webSg.id], // Only allow access from web servers
        },
        {
            description: "PostgreSQL",
            protocol: "tcp",
            fromPort: 5432,
            toPort: 5432,
            securityGroups: [webSg.id], // Only allow access from web servers
        }
    ],
    egress: [{
        description: "All outbound traffic",
        protocol: "-1",
        fromPort: 0,
        toPort: 0,
        cidrBlocks: ["0.0.0.0/0"],
    }],
    tags: {
        Name: "database-security-group",
        Environment: "dev",
    },
});

// Admin Security Group - for administrative access from your IP only
const adminSg = new aws.ec2.SecurityGroup("adminSg", {
    vpcId: vpc.id,
    description: "Security group for admin access from specific IP",
    ingress: [
        {
            description: "SSH from my IP",
            protocol: "tcp",
            fromPort: 22,
            toPort: 22,
            cidrBlocks: [myIp],
        },
        {
            description: "RDP from my IP",
            protocol: "tcp",
            fromPort: 3389,
            toPort: 3389,
            cidrBlocks: [myIp],
        }
    ],
    egress: [{
        description: "All outbound traffic",
        protocol: "-1",
        fromPort: 0,
        toPort: 0,
        cidrBlocks: ["0.0.0.0/0"],
    }],
    tags: {
        Name: "admin-security-group",
        Environment: "dev",
    },
});

// 9. Key Pair for EC2 instances
const generatedKeyPair = new aws_native.ec2.KeyPair("myGeneratedKeyPair", {
    keyName: "pulumi-demo-keypair",
    tags: [
        {
            key: "Name",
            value: "pulumi-demo-keypair"
        },
        {
            key: "Environment",
            value: "dev"
        }
    ]
});

// 10. Get the latest Amazon Linux 2 AMI
const amiId = aws.ec2.getAmi({
    mostRecent: true,
    owners: ["amazon"],
    filters: [
        {
            name: "name",
            values: ["amzn2-ami-hvm-*-x86_64-gp2"],
        },
        {
            name: "virtualization-type",
            values: ["hvm"],
        },
    ],
});

// 11. EC2 Instances

// Public EC2 instance (web server)
const publicEc2Instance = new aws.ec2.Instance("publicWebServer", {
    ami: amiId.then(ami => ami.id),
    instanceType: "t2.micro",
    keyName: generatedKeyPair.keyName,
    subnetId: publicSubnet1.id,
    vpcSecurityGroupIds: [webSg.id, adminSg.id],
    associatePublicIpAddress: true,
    userData: `#!/bin/bash
yum update -y
yum install -y httpd
systemctl start httpd
systemctl enable httpd
echo "<h1>Hello from Public Web Server</h1>" > /var/www/html/index.html
echo "<p>Instance ID: $(curl -s http://169.254.169.254/latest/meta-data/instance-id)</p>" >> /var/www/html/index.html
echo "<p>Availability Zone: $(curl -s http://169.254.169.254/latest/meta-data/placement/availability-zone)</p>" >> /var/www/html/index.html`,
    tags: {
        Name: "public-web-server",
        Environment: "dev",
        Type: "web-server",
    },
});

// Private EC2 instance (application server)
const privateEc2Instance = new aws.ec2.Instance("privateAppServer", {
    ami: amiId.then(ami => ami.id),
    instanceType: "t2.micro",
    keyName: generatedKeyPair.keyName,
    subnetId: privateSubnet1.id,
    vpcSecurityGroupIds: [dbSg.id], // Can communicate with web servers
    userData: `#!/bin/bash
yum update -y
yum install -y mysql
echo "Private application server configured" > /tmp/setup-complete.txt`,
    tags: {
        Name: "private-app-server",
        Environment: "dev",
        Type: "app-server",
    },
});

// Additional public EC2 instance in second AZ for high availability
const publicEc2Instance2 = new aws.ec2.Instance("publicWebServer2", {
    ami: amiId.then(ami => ami.id),
    instanceType: "t2.micro",
    keyName: generatedKeyPair.keyName,
    subnetId: publicSubnet2.id,
    vpcSecurityGroupIds: [webSg.id, adminSg.id],
    associatePublicIpAddress: true,
    userData: `#!/bin/bash
yum update -y
yum install -y httpd
systemctl start httpd
systemctl enable httpd
echo "<h1>Hello from Public Web Server 2</h1>" > /var/www/html/index.html
echo "<p>Instance ID: $(curl -s http://169.254.169.254/latest/meta-data/instance-id)</p>" >> /var/www/html/index.html
echo "<p>Availability Zone: $(curl -s http://169.254.169.254/latest/meta-data/placement/availability-zone)</p>" >> /var/www/html/index.html`,
    tags: {
        Name: "public-web-server-2",
        Environment: "dev",
        Type: "web-server",
    },
});

// Private EC2 instance in second AZ
const privateEc2Instance2 = new aws.ec2.Instance("privateAppServer2", {
    ami: amiId.then(ami => ami.id),
    instanceType: "t2.micro",
    keyName: generatedKeyPair.keyName,
    subnetId: privateSubnet2.id,
    vpcSecurityGroupIds: [dbSg.id],
    userData: `#!/bin/bash
yum update -y
yum install -y mysql
echo "Private application server 2 configured" > /tmp/setup-complete.txt`,
    tags: {
        Name: "private-app-server-2",
        Environment: "dev",
        Type: "app-server",
    },
});

// Export outputs for use by other stacks or reference
export const vpcId = vpc.id;
export const vpcCidr = vpc.cidrBlock;

// Subnet IDs
export const publicSubnet1Id = publicSubnet1.id;
export const publicSubnet2Id = publicSubnet2.id;
export const privateSubnet1Id = privateSubnet1.id;
export const privateSubnet2Id = privateSubnet2.id;

// Security Group IDs
export const webSecurityGroupId = webSg.id;
export const databaseSecurityGroupId = dbSg.id;
export const adminSecurityGroupId = adminSg.id;

// NAT Gateway IDs
export const natGateway1Id = natGateway1.id;
export const natGateway2Id = natGateway2.id;

// Key Pair
export const keyPairName = generatedKeyPair.keyName;

// Internet Gateway
export const internetGatewayId = igw.id;

// EC2 Instance Information
export const publicWebServer1Id = publicEc2Instance.id;
export const publicWebServer1PublicIp = publicEc2Instance.publicIp;
export const publicWebServer1PrivateIp = publicEc2Instance.privateIp;
export const publicWebServer1Url = pulumi.interpolate`http://${publicEc2Instance.publicIp}`;

export const publicWebServer2Id = publicEc2Instance2.id;
export const publicWebServer2PublicIp = publicEc2Instance2.publicIp;
export const publicWebServer2PrivateIp = publicEc2Instance2.privateIp;
export const publicWebServer2Url = pulumi.interpolate`http://${publicEc2Instance2.publicIp}`;

export const privateAppServer1Id = privateEc2Instance.id;
export const privateAppServer1PrivateIp = privateEc2Instance.privateIp;

export const privateAppServer2Id = privateEc2Instance2.id;
export const privateAppServer2PrivateIp = privateEc2Instance2.privateIp;

// Availability Zones used
export const availabilityZones = availableAzs.then(azs => [azs.names[0], azs.names[1]]);

// AMI ID used
export const amazonLinuxAmiId = amiId.then(ami => ami.id);

