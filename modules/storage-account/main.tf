resource "azurerm_storage_account" "this" {
  name                      = var.resource_name
  resource_group_name       = var.resource_group_name
  location                  = var.location
  account_tier              = var.account_tier
  account_replication_type  = var.account_replication_type
  account_kind              = var.account_kind
  access_tier               = var.access_tier
  min_tls_version           = var.minimum_tls_version
  shared_access_key_enabled = var.shared_access_key_enabled
  https_traffic_only_enabled = var.https_traffic_only_enabled
  public_network_access_enabled = var.public_network_access_enabled
  tags                      = var.tags

  # Network rules should only be included if default_action is specified
  dynamic "network_rules" {
    for_each = var.default_action != "" ? [1] : []
    content {
      default_action = var.default_action
      bypass         = var.bypass
    }
  }

  # Blob properties should only be included if soft_delete_enabled is true
  dynamic "blob_properties" {
    for_each = var.soft_delete_enabled ? [1] : []
    content {
      delete_retention_policy {
        days = var.soft_delete_retention_days
      }
    }
  }
}