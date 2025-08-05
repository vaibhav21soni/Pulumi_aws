#!/bin/bash

# Script to retrieve and save the EC2 key pair from AWS Systems Manager Parameter Store

KEY_NAME="pulumi-demo-keypair"
KEY_PATH="$HOME/.ssh/${KEY_NAME}.pem"
SSM_PARAMETER="/ec2/keypair/${KEY_NAME}"

echo "🔑 Retrieving private key from AWS Systems Manager..."
echo "Parameter: ${SSM_PARAMETER}"
echo "Saving to: ${KEY_PATH}"
echo ""

# Create .ssh directory if it doesn't exist
mkdir -p "$HOME/.ssh"

# Retrieve the private key from SSM Parameter Store
aws ssm get-parameter \
    --name "${SSM_PARAMETER}" \
    --with-decryption \
    --query 'Parameter.Value' \
    --output text > "${KEY_PATH}" 2>/dev/null

# Check if the command was successful
if [ $? -eq 0 ] && [ -s "${KEY_PATH}" ]; then
    # Set correct permissions for the private key
    chmod 400 "${KEY_PATH}"
    
    echo "✅ Success! Private key saved to: ${KEY_PATH}"
    echo ""
    echo "📋 Next steps:"
    echo "1. Get your instance IP from Pulumi output:"
    echo "   pulumi stack output publicWebServer1PublicIp"
    echo ""
    echo "2. SSH to your instance:"
    echo "   ssh -i ${KEY_PATH} ec2-user@<instance-ip>"
    echo ""
    echo "3. Or use the convenience command:"
    echo "   ssh -i ${KEY_PATH} ec2-user@\$(pulumi stack output publicWebServer1PublicIp)"
    
else
    echo "❌ Failed to retrieve private key."
    echo ""
    echo "🔍 Troubleshooting:"
    echo "1. Check if your AWS credentials are configured:"
    echo "   aws sts get-caller-identity"
    echo ""
    echo "2. Verify the parameter exists:"
    echo "   aws ssm describe-parameters --parameter-filters Key=Name,Values=${SSM_PARAMETER}"
    echo ""
    echo "3. Check if you have the required permissions:"
    echo "   - ssm:GetParameter"
    echo "   - kms:Decrypt (if parameter is encrypted)"
    echo ""
    echo "4. Make sure you've deployed the infrastructure:"
    echo "   pulumi up"
    
    # Clean up empty file if created
    [ -f "${KEY_PATH}" ] && [ ! -s "${KEY_PATH}" ] && rm "${KEY_PATH}"
    
    exit 1
fi
