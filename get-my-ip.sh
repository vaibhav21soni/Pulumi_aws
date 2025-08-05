#!/bin/bash

# Get your current public IP address
echo "Getting your current public IP address..."
MY_IP=$(curl -s https://checkip.amazonaws.com)

if [ -z "$MY_IP" ]; then
    echo "Failed to get IP address. Trying alternative method..."
    MY_IP=$(curl -s https://ipinfo.io/ip)
fi

if [ -z "$MY_IP" ]; then
    echo "Failed to get IP address. Please set it manually:"
    echo "pulumi config set myIp <your-ip>/32"
    exit 1
fi

echo "Your public IP address is: $MY_IP"
echo "Setting Pulumi configuration..."

# Set the IP in Pulumi config with /32 CIDR notation
pulumi config set myIp "$MY_IP/32"

echo "Configuration set successfully!"
echo "You can verify with: pulumi config get myIp"
