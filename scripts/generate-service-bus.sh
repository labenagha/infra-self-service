#!/bin/bash
# This script generates terraform variables from a service bus request YAML

REQUEST_FILE=$1
OUTPUT_DIR="./terraform-configs"

# Extract values from YAML
NAME=$(yq -r '.metadata.name' $REQUEST_FILE)
ENV=$(yq -r '.metadata.environment' $REQUEST_FILE)
RETENTION=$(yq -r '.spec.messageRetention' $REQUEST_FILE)
MAX_SIZE=$(yq -r '.spec.maxSizeInMegabytes' $REQUEST_FILE)

# Create terraform.tfvars file pointing to your existing modules
mkdir -p $OUTPUT_DIR
cat > $OUTPUT_DIR/terraform.tfvars <<EOF
# Generated from service bus request
module_source = "../modules/service-bus"
resource_name = "${NAME}"
environment = "${ENV}"
message_retention_days = ${RETENTION}
max_size_mb = ${MAX_SIZE}
EOF

# Set output path for next workflow step
echo "CONFIG_PATH=$OUTPUT_DIR" >> $GITHUB_ENV
echo "RESOURCE_TYPE=service-bus" >> $GITHUB_ENV