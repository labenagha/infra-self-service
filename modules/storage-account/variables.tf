variable "resource_name" {
  type        = string
  description = "Name of the Storage Account"
}

variable "resource_group_name" {
  type        = string
  description = "Name of the Resource Group where the storage account will be created"
}

variable "location" {
  type        = string
  description = "Azure region (e.g. eastus, westus)"
}

variable "account_kind" {
  type        = string
  default     = "StorageV2"
  description = "Storage account kind (Storage, StorageV2, BlobStorage, etc.)"
}

variable "account_tier" {
  type        = string
  default     = "Standard"
  description = "Account tier for the storage account (Standard or Premium)"
}

variable "account_replication_type" {
  type        = string
  default     = "LRS"
  description = "Replication type for the storage account (LRS, GRS, RAGRS, ZRS)"
}

variable "access_tier" {
  type        = string
  default     = "Hot"
  description = "Access tier (Hot or Cool). Applies only to BlobStorage or StorageV2"
}

variable "minimum_tls_version" {
  type        = string
  default     = "TLS1_2"
  description = "Minimum allowed TLS version"
}

variable "shared_access_key_enabled" {
  type        = bool
  default     = true
  description = "Indicates whether the storage account permits requests to be authorized with the account access key via Shared Key"
}

variable "https_traffic_only_enabled" {
  type        = bool
  default     = true
  description = "Forces HTTPS if true"
}

variable "public_network_access_enabled" {
  type        = bool
  default     = false
  description = "Allow or disallow public access to all blobs or containers"
}

variable "default_action" {
  type        = string
  default     = "Deny"
  description = "Default action for network rule set (Allow or Deny). Set to empty string to disable network rules."
  validation {
    condition     = contains(["Allow", "Deny", ""], var.default_action)
    error_message = "The default_action value must be 'Allow', 'Deny', or '' (empty string)."
  }
}

variable "bypass" {
  type        = list(string)
  default     = ["AzureServices"]
  description = "List of bypass options for network rules (AzureServices, Logging, Metrics, None)"
}

variable "soft_delete_enabled" {
  type        = bool
  default     = true
  description = "Enable blob soft delete"
}

variable "soft_delete_retention_days" {
  type        = number
  default     = 7
  description = "Number of days to retain soft deleted blobs (between 1 and 365)"
  validation {
    condition     = var.soft_delete_retention_days >= 1 && var.soft_delete_retention_days <= 365
    error_message = "The soft_delete_retention_days value must be between 1 and 365 days."
  }
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "Map of tags to apply to the storage account"
}