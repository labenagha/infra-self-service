terraform {
  backend "azurerm" {
    subscription_id      = "78ee441a-cdf8-420c-8563-2cb95a50ddb5"
    resource_group_name  = "rg-self-service-solution"
    storage_account_name = "stselfservicefunc"
    container_name       = "tfstate"
    key                  = "dev.terraform.tfstate"
  }
}

provider "azurerm" {
  features {}

  subscription_id = "78ee441a-cdf8-420c-8563-2cb95a50ddb5"
  client_id       = "6d0d28a1-69be-4e1a-a512-35ef596f2a46"
  tenant_id       = "bf2d1078-8c70-4e72-9e6a-cfc84de736b5"
}