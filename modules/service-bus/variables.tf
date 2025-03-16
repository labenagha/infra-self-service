// modules/service-bus/variables.tf
variable "resource_name" {
  description = "Name of the Service Bus Topic"
  type        = string
}

variable "message_retention" {
  description = "Message retention period in days"
  type        = number
  default     = 7
}

variable "max_size_mb" {
  description = "Maximum size of the topic in MB"
  type        = number
  default     = 1024
}

variable "requires_duplicate_detection" {
  description = "Enable duplicate detection"
  type        = bool
  default     = false
}

variable "resource_group_name" {
  description = "Resource group name"
  type        = string
}

variable "location" {
  description = "Azure region"
  type        = string
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}