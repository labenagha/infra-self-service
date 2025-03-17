variable "resource_name" {
  type        = string
  description = "Name of the storage account"
}

variable "account_kind" {
  type        = string
  description = "Storage account kind (Storage, StorageV2, BlobStorage, etc.)"
}

variable "account_tier" {
  type        = string
  description = "Account tier for the storage account (Standard or Premium)"
}

variable "account_replication_type" {
  type        = string
  description = "Replication type for the storage account (LRS, GRS, RAGRS, ZRS)"
}

variable "access_tier" {
  type        = string
  description = "Access tier (Hot or Cool). Applies only to BlobStorage or StorageV2"
}

variable "minimum_tls_version" {
  type        = string
  description = "Minimum allowed TLS version"
}

variable "shared_access_key_enabled" {
  type        = bool
  description = "Indicates whether the storage account permits requests to be authorized with the account access key via Shared Key"
}

variable "https_traffic_only_enabled" {
  type        = bool
  description = "Forces HTTPS if true"
}

variable "public_network_access_enabled" {
  type        = bool
  description = "Allow or disallow public access to all blobs or containers"
}

variable "default_action" {
  type        = string
  description = "Default action for network rule set (Allow or Deny)"
}

variable "bypass" {
  type        = list(string)
  description = "List of bypass options for network rules (AzureServices, Logging, Metrics, None)"
}

variable "soft_delete_enabled" {
  type        = bool
  description = "Enable blob soft delete"
}

variable "soft_delete_retention_days" {
  type        = number
  description = "Number of days to retain soft deleted blobs (between 1 and 365)"
}