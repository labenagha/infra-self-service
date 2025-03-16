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


module "storage_account" {
  source = "../storage-account"

  resource_name                 = "mystorageaccount"
  resource_group_name           = "my-resource-group"
  location                      = "eastus"
  
  # Optional parameters with defaults
  account_kind                  = "StorageV2"
  account_tier                  = "Standard"
  account_replication_type      = "LRS"
  access_tier                   = "Hot"
  minimum_tls_version           = "TLS1_2"
  shared_access_key_enabled     = true
  https_traffic_only_enabled    = true
  public_network_access_enabled = false
  
  # Network rules configuration
  default_action                = "Deny"
  bypass                        = ["AzureServices"]
  
  # Soft delete configuration
  soft_delete_enabled           = true
  soft_delete_retention_days    = 7
  
  # Resource tagging
  tags = {
    Environment = "Production"
    Department  = "IT"
    Project     = "Infrastructure"
  }
}