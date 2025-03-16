locals {
  environment = "dev"
  location    = "eastus"
  common_tags = {
    Environment = local.environment
    ManagedBy   = "terraform"
  }
}

resource "azurerm_resource_group" "servicebus" {
  name     = "servicebus-${local.environment}"
  location = local.location
  tags     = local.common_tags
}

module "service_bus" {
  source = "../service-bus"

  resource_name                = var.resource_name
  message_retention            = var.message_retention
  max_size_mb                  = var.max_size_mb
  requires_duplicate_detection = var.requires_duplicate_detection

  resource_group_name = azurerm_resource_group.servicebus.name
  location            = local.location
  tags                = local.common_tags
}