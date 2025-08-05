# AWS Infrastructure with Pulumi (TypeScript)

A comprehensive Pulumi template for provisioning production-ready AWS infrastructure using TypeScript. This project creates a complete VPC setup with EC2 instances, security groups, and networking components following AWS best practices.

## 🏗️ Infrastructure Overview

This template provisions:

- **VPC**: Custom VPC with DNS support
- **Subnets**: Public and private subnets across multiple availability zones
- **Internet Gateway**: For public subnet internet access
- **NAT Gateways**: For private subnet outbound internet access (with Elastic IPs)
- **Route Tables**: Properly configured routing for public and private subnets
- **Security Groups**: Layered security with web, database, and admin access controls
- **EC2 Instances**: t2.micro instances in both public and private subnets
- **Key Pair**: AWS-generated key pair for EC2 access

## 🚀 Architecture

```
Internet Gateway
       |
   Public Subnets (2 AZs)
   [Web Servers - t2.micro]
       |
   NAT Gateways
       |
   Private Subnets (2 AZs)
   [App Servers - t2.micro]
```

### Network Layout
- **VPC CIDR**: 10.0.0.0/16
- **Public Subnet 1**: 10.0.1.0/24 (AZ-a)
- **Public Subnet 2**: 10.0.2.0/24 (AZ-b)
- **Private Subnet 1**: 10.0.3.0/24 (AZ-a)
- **Private Subnet 2**: 10.0.4.0/24 (AZ-b)

## 📋 Prerequisites

- **Pulumi CLI** (>= v3): [Installation Guide](https://www.pulumi.com/docs/get-started/install/)
- **Node.js** (>= 14): [Download](https://nodejs.org/)
- **AWS CLI** configured with appropriate credentials
- **TypeScript** knowledge for customization

## 🔧 Pulumi Setup & Configuration

### 1. Install Pulumi CLI

**macOS (Homebrew)**:
```bash
brew install pulumi
```

**Linux**:
```bash
curl -fsSL https://get.pulumi.com | sh
```

**Windows (Chocolatey)**:
```bash
choco install pulumi
```

### 2. Configure AWS Credentials

**Option A: AWS CLI (Recommended)**
```bash
aws configure
# Enter your AWS Access Key ID, Secret Access Key, and default region
```

**Option B: Environment Variables**
```bash
export AWS_ACCESS_KEY_ID=your-access-key
export AWS_SECRET_ACCESS_KEY=your-secret-key
export AWS_DEFAULT_REGION=us-east-1
```

**Option C: AWS Profile**
```bash
# Configure named profile
aws configure --profile pulumi-demo

# Use profile with Pulumi
export AWS_PROFILE=pulumi-demo
```

### 3. Login to Pulumi Backend

**Pulumi Cloud (Free tier available)**:
```bash
pulumi login
```

**Local Backend (Self-managed)**:
```bash
pulumi login file://~/.pulumi
```

### 4. Verify Setup

```bash
# Check Pulumi version
pulumi version

# Verify AWS credentials
aws sts get-caller-identity

# Test Pulumi AWS access
pulumi whoami
```

## 🛠️ Setup Instructions

### 1. Clone and Initialize

```bash
git clone <your-repo-url>
cd pulumi-demo
npm install
```

### 2. Configure Your IP Address

**Option A: Automatic (recommended)**
```bash
bash get-my-ip.sh
```

**Option B: Manual**
```bash
# Get your public IP
curl -s https://checkip.amazonaws.com

# Set it in Pulumi config
pulumi config set myIp <your-ip>/32
```

### 3. Configure AWS Region (Optional)

```bash
pulumi config set aws:region us-west-2  # Default: us-east-1
```

### 4. Deploy Infrastructure

```bash
# Preview changes
pulumi preview

# Deploy infrastructure
pulumi up

# When finished, destroy resources
pulumi destroy
```

## 🔒 Security Features

### Security Groups

1. **Web Security Group**
   - HTTP (80) and HTTPS (443) from anywhere
   - SSH (22) from your IP only

2. **Database Security Group**
   - MySQL (3306) and PostgreSQL (5432) from web servers only
   - No direct internet access

3. **Admin Security Group**
   - SSH (22) and RDP (3389) from your IP only

### Network Security
- Private subnets have no direct internet access
- NAT Gateways provide secure outbound internet access
- Multi-AZ deployment for high availability

## 📊 Outputs

After deployment, you'll get:

```bash
# Network Information
vpcId: vpc-xxxxxxxxx
publicSubnet1Id: subnet-xxxxxxxxx
privateSubnet1Id: subnet-xxxxxxxxx

# EC2 Instance Information
publicWebServer1PublicIp: x.x.x.x
publicWebServer1Url: http://x.x.x.x
privateAppServer1PrivateIp: 10.0.x.x

# Security and Access
keyPairName: pulumi-demo-keypair
webSecurityGroupId: sg-xxxxxxxxx
```

## 🖥️ Accessing Your Infrastructure

### Web Servers
- Access via the provided URLs in the output
- SSH access: `ssh -i <key-file> ec2-user@<public-ip>`

### Private Servers
- SSH through public instances (bastion pattern)
- Or use AWS Systems Manager Session Manager

## 🔑 Key Pair Management

When you deploy this infrastructure, AWS generates a key pair for EC2 access. The private key is automatically stored in AWS Systems Manager Parameter Store for security.

### Retrieving Your Private Key

**Method 1: Using AWS CLI (Recommended)**
```bash
# Get the private key from Systems Manager Parameter Store
aws ssm get-parameter \
    --name "/ec2/keypair/pulumi-demo-keypair" \
    --with-decryption \
    --query 'Parameter.Value' \
    --output text > ~/.ssh/pulumi-demo-keypair.pem

# Set correct permissions
chmod 400 ~/.ssh/pulumi-demo-keypair.pem

# Test the key
ssh -i ~/.ssh/pulumi-demo-keypair.pem ec2-user@<public-ip>
```

**Method 2: Using AWS Console**
1. Go to AWS Systems Manager → Parameter Store
2. Find parameter: `/ec2/keypair/pulumi-demo-keypair`
3. Click "Show" to reveal the private key
4. Copy the entire key (including `-----BEGIN RSA PRIVATE KEY-----` and `-----END RSA PRIVATE KEY-----`)
5. Save to a file: `~/.ssh/pulumi-demo-keypair.pem`
6. Set permissions: `chmod 400 ~/.ssh/pulumi-demo-keypair.pem`

**Method 3: Automated Script**
```bash
#!/bin/bash
# save-keypair.sh

KEY_NAME="pulumi-demo-keypair"
KEY_PATH="$HOME/.ssh/${KEY_NAME}.pem"

echo "Retrieving private key from AWS Systems Manager..."

aws ssm get-parameter \
    --name "/ec2/keypair/${KEY_NAME}" \
    --with-decryption \
    --query 'Parameter.Value' \
    --output text > "${KEY_PATH}"

if [ $? -eq 0 ]; then
    chmod 400 "${KEY_PATH}"
    echo "Private key saved to: ${KEY_PATH}"
    echo "You can now SSH using: ssh -i ${KEY_PATH} ec2-user@<instance-ip>"
else
    echo "Failed to retrieve private key. Check your AWS credentials and permissions."
fi
```

### SSH Connection Examples

**Connect to Public Web Server**:
```bash
# Get the public IP from Pulumi output
PUBLIC_IP=$(pulumi stack output publicWebServer1PublicIp)

# SSH to the instance
ssh -i ~/.ssh/pulumi-demo-keypair.pem ec2-user@$PUBLIC_IP
```

**Connect to Private Server (via Bastion)**:
```bash
# SSH with port forwarding through public instance
ssh -i ~/.ssh/pulumi-demo-keypair.pem \
    -J ec2-user@$PUBLIC_IP \
    ec2-user@<private-ip>
```

**Using SSH Config File**:
Create `~/.ssh/config`:
```
Host pulumi-bastion
    HostName <public-ip>
    User ec2-user
    IdentityFile ~/.ssh/pulumi-demo-keypair.pem

Host pulumi-private
    HostName <private-ip>
    User ec2-user
    IdentityFile ~/.ssh/pulumi-demo-keypair.pem
    ProxyJump pulumi-bastion
```

Then connect with:
```bash
ssh pulumi-bastion    # Direct to public instance
ssh pulumi-private    # To private instance via bastion
```

## 📁 Project Structure

```
pulumi-demo/
├── index.ts              # Main infrastructure code
├── package.json          # Node.js dependencies
├── tsconfig.json         # TypeScript configuration
├── Pulumi.yaml           # Pulumi project metadata
├── Pulumi.dev.yaml       # Stack configuration
├── get-my-ip.sh          # IP configuration helper script
├── save-keypair.sh       # Key pair retrieval script
├── README.md             # This file
├── LICENSE               # MIT License
└── .gitignore           # Git ignore rules
```

## ⚙️ Configuration Options

| Key | Description | Default |
|-----|-------------|---------|
| `aws:region` | AWS region for deployment | `us-east-1` |
| `myIp` | Your public IP for SSH access | Required |

Set configuration:
```bash
pulumi config set <key> <value>
```

## 🔧 Customization

### Adding More EC2 Instances
Modify `index.ts` to add additional instances:

```typescript
const newInstance = new aws.ec2.Instance("newInstance", {
    ami: amiId.then(ami => ami.id),
    instanceType: "t2.micro",
    subnetId: publicSubnet1.id,
    // ... other configuration
});
```

### Changing Instance Types
Update the `instanceType` property:
```typescript
instanceType: "t3.small", // Instead of t2.micro
```

### Adding Load Balancer
Consider adding an Application Load Balancer for production use.

## 💰 Cost Considerations

This template uses AWS Free Tier eligible resources where possible:
- **t2.micro instances**: Free tier eligible (750 hours/month)
- **NAT Gateways**: ~$45/month each (2 deployed)
- **Elastic IPs**: Free when attached to running instances

**Estimated monthly cost**: ~$90-100 (primarily NAT Gateways)

## 🚨 Important Notes

- **NAT Gateways** are the primary cost component
- **Key Pairs** are generated by AWS - download the private key from AWS Console
- **Security Groups** follow least-privilege principles
- **Multi-AZ deployment** provides high availability but increases costs

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with `pulumi preview`
5. Submit a pull request

## 📚 Additional Resources

- [Pulumi AWS Documentation](https://www.pulumi.com/docs/reference/pkg/aws/)
- [AWS VPC Best Practices](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-security-best-practices.html)
- [Pulumi TypeScript Guide](https://www.pulumi.com/docs/intro/languages/javascript/)

## 🆘 Troubleshooting

### Common Issues

1. **IP Configuration Error**
   ```bash
   # Verify your IP is set
   pulumi config get myIp
   ```

2. **AWS Credentials**
   ```bash
   # Verify AWS credentials
   aws sts get-caller-identity
   ```

3. **TypeScript Compilation**
   ```bash
   # Check for syntax errors
   npx tsc --noEmit
   ```

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

**⚠️ Remember**: Always run `pulumi destroy` when you're done testing to avoid unnecessary AWS charges!
