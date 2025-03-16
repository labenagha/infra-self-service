module "storage_account" {
  source = "./modules/storage_account"

  # REQUIRED inputs
  resource_name       = "mystorageacct123"
  resource_group_name = azurerm_resource_group.example.name
  location            = azurerm_resource_group.example.location

  # OPTIONAL overrides
  kind                     = "StorageV2"
  sku                      = "Standard_LRS"
  access_tier              = "Hot"
  minimum_tls_version      = "TLS1_2"
  allow_blob_public_access = false
  enable_https_traffic_only = true
  default_action           = "Deny"
  bypass                   = "AzureServices"
  soft_delete_enabled      = true
  soft_delete_retention_days = 7
}

# Example usage of the outputs
output "my_storage_account_id" {
  description = "Storage account ID from the module"
  value       = module.storage_account.storage_account_id
}
