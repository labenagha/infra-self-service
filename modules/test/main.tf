locals {
  environment = "test"
  location    = "eastus"
  common_tags = {
    Environment = local.environment
    ManagedBy   = "terraform"
  }
}

resource "azurerm_resource_group" "rg" {
  name     = "rg-selfservice-${local.environment}"
  location = local.location
  tags     = local.common_tags
}

module "storage_account" {
  source = "../storage-account"

  resource_name                 = var.resource_name
  resource_group_name           = azurerm_resource_group.rg.name
  location                      = local.location
  
  # Optional parameters with defaults
  account_kind                  = var.account_kind
  account_tier                  = var.account_tier
  account_replication_type      = var.account_replication_type
  access_tier                   = var.access_tier
  minimum_tls_version           = var.minimum_tls_version
  shared_access_key_enabled     = var.shared_access_key_enabled
  https_traffic_only_enabled    = var.https_traffic_only_enabled
  public_network_access_enabled = var.public_network_access_enabled
  
  # Network rules configuration
  default_action                = var.default_action
  bypass                        = var.bypass
  
  # Soft delete configuration
  soft_delete_enabled           = var.soft_delete_enabled
  soft_delete_retention_days    = var.soft_delete_retention_days
  
  # Resource tagging
  tags = {
    Environment = "Production"
    Department  = "IT"
    Project     = "Infrastructure"
  }
}