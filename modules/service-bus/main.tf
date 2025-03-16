// modules/service-bus/main.tf
resource "azurerm_servicebus_namespace" "this" {
  name                = "${var.resource_name}-namespace"
  location            = var.location
  resource_group_name = var.resource_group_name
  sku                 = "Standard"
  tags                = var.tags
}

resource "azurerm_servicebus_topic" "this" {
  name                        = var.resource_name
  namespace_id                = azurerm_servicebus_namespace.this.id
  default_message_ttl         = "P${var.message_retention}D"
  max_size_in_megabytes       = var.max_size_mb
  requires_duplicate_detection = var.requires_duplicate_detection
}