// modules/service-bus/outputs.tf
output "namespace_id" {
  description = "ID of the Service Bus Namespace"
  value       = azurerm_servicebus_namespace.this.id
}

output "namespace_name" {
  description = "Name of the Service Bus Namespace"
  value       = azurerm_servicebus_namespace.this.name
}

output "topic_id" {
  description = "ID of the Service Bus Topic"
  value       = azurerm_servicebus_topic.this.id
}

output "topic_name" {
  description = "Name of the Service Bus Topic"
  value       = azurerm_servicebus_topic.this.name
}