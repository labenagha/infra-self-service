// storage-account-form.js
function loadStorageAccountForm(permissions) {
    const formContainer = document.getElementById("form-fields");
    formContainer.innerHTML = "";
  
    document.getElementById("form-title").textContent = "Create Storage Account";
  
    // Fetch the Storage Account schema
    fetch(
      "https://labenagha.github.io/infra-self-service/config/resource-templates/storage-account/schema.json"
    )
      .then((response) => response.json())
      .then((schema) => {
        // Create form fields based on schema
        Object.entries(schema.properties).forEach(([fieldName, fieldConfig]) => {
          // Skip nested objects - we'll handle them specially
          if (fieldConfig.type === "object") {
            return;
          }
  
          const fieldContainer = document.createElement("div");
          fieldContainer.className = "form-field";
  
          const label = document.createElement("label");
          label.textContent = fieldConfig.title || formatFieldName(fieldName);
          label.setAttribute("for", fieldName);
  
          let input;
          if (fieldConfig.enum) {
            input = document.createElement("select");
            fieldConfig.enum.forEach((option) => {
              const optionElement = document.createElement("option");
              optionElement.value = option;
              optionElement.textContent = option;
              if (fieldConfig.default && fieldConfig.default === option) {
                optionElement.selected = true;
              }
              input.appendChild(optionElement);
            });
          } else if (fieldConfig.type === "boolean") {
            input = document.createElement("input");
            input.type = "checkbox";
            if (fieldConfig.default === true) {
              input.checked = true;
            }
          } else {
            input = document.createElement("input");
            input.type = fieldConfig.type === "number" ? "number" : "text";
            if (fieldConfig.default !== undefined) {
              input.value = fieldConfig.default;
            }
            
            // Add validation attributes based on schema
            if (fieldConfig.minimum !== undefined) input.min = fieldConfig.minimum;
            if (fieldConfig.maximum !== undefined) input.max = fieldConfig.maximum;
            if (fieldConfig.pattern) input.pattern = fieldConfig.pattern;
          }
  
          input.id = fieldName;
          input.name = fieldName;
          
          // Add description as tooltip/help text if available
          if (fieldConfig.description) {
            const helpText = document.createElement("div");
            helpText.className = "help-text";
            helpText.textContent = fieldConfig.description;
            fieldContainer.appendChild(helpText);
          }
  
          // Apply limitations for contributor users if applicable
          if (
            userPermissions === "contributor" &&
            permissions.teams["epo-team"].limitations &&
            permissions.teams["epo-team"].limitations["StorageAccount"] &&
            permissions.teams["epo-team"].limitations["StorageAccount"][fieldName]
          ) {
            const limitation =
              permissions.teams["epo-team"].limitations["StorageAccount"][fieldName];
            if (Array.isArray(limitation)) {
              // For enum types, filter options
              if (input.tagName === "SELECT") {
                Array.from(input.options).forEach((option) => {
                  if (!limitation.includes(option.value)) {
                    option.remove();
                  }
                });
              }
            } else {
              // For numeric limitations
              input.max = limitation;
            }
          }
  
          fieldContainer.appendChild(label);
          fieldContainer.appendChild(input);
          formContainer.appendChild(fieldContainer);
        });
  
        // Handle networkRuleSet fields
        if (schema.properties.networkRuleSet) {
          const networkFields = schema.properties.networkRuleSet.properties;
          
          // Create section header
          const sectionHeader = document.createElement("h3");
          sectionHeader.className = "section-header";
          sectionHeader.textContent = "Network Configuration";
          formContainer.appendChild(sectionHeader);
          
          if (networkFields.defaultAction) {
            addSelectField(
              formContainer, 
              'defaultAction',
              networkFields.defaultAction.title,
              networkFields.defaultAction.enum,
              networkFields.defaultAction.default
            );
          }
          
          if (networkFields.bypass) {
            addSelectField(
              formContainer, 
              'bypass',
              networkFields.bypass.title,
              networkFields.bypass.enum,
              networkFields.bypass.default
            );
          }
        }
        
        // Handle blobServices deleteRetentionPolicy
        if (schema.properties.blobServices && 
            schema.properties.blobServices.properties && 
            schema.properties.blobServices.properties.deleteRetentionPolicy) {
          
          // Create section header
          const sectionHeader = document.createElement("h3");
          sectionHeader.className = "section-header";
          sectionHeader.textContent = "Data Protection";
          formContainer.appendChild(sectionHeader);
          
          const deletePolicy = schema.properties.blobServices.properties.deleteRetentionPolicy.properties;
          
          // Add checkbox for enabling soft delete
          if (deletePolicy.enabled) {
            addBooleanField(
              formContainer,
              'softDeleteEnabled',
              'Enable Soft Delete',
              deletePolicy.enabled.default
            );
          }
          
          // Add numeric field for retention days
          if (deletePolicy.days) {
            addNumericField(
              formContainer,
              'softDeleteRetentionDays',
              'Soft Delete Retention (Days)',
              deletePolicy.days.default,
              deletePolicy.days.minimum,
              deletePolicy.days.maximum
            );
          }
        }
  
        // Load environment selector
        loadStorageAccountEnvironmentSelector(permissions);
  
        document.getElementById("resource-selector").style.display = "none";
        document.getElementById("resource-form-container").style.display = "block";
      })
      .catch((error) => {
        console.error("Error loading Storage Account form:", error);
        document.getElementById("result-message").textContent = "Error loading Storage Account form";
      });
  }
  
  // Helper function to format field names
  function formatFieldName(camelCase) {
    return camelCase.replace(/([A-Z])/g, " $1").trim();
  }
  
  // Helper functions to create form fields
  function addSelectField(container, fieldName, labelText, options, defaultValue) {
    const fieldContainer = document.createElement("div");
    fieldContainer.className = "form-field";
    
    const label = document.createElement("label");
    label.textContent = labelText;
    label.setAttribute("for", fieldName);
    
    const select = document.createElement("select");
    select.id = fieldName;
    select.name = fieldName;
    
    options.forEach(option => {
      const optionElement = document.createElement("option");
      optionElement.value = option;
      optionElement.textContent = option;
      if (defaultValue === option) {
        optionElement.selected = true;
      }
      select.appendChild(optionElement);
    });
    
    fieldContainer.appendChild(label);
    fieldContainer.appendChild(select);
    container.appendChild(fieldContainer);
  }
  
  function addBooleanField(container, fieldName, labelText, defaultValue) {
    const fieldContainer = document.createElement("div");
    fieldContainer.className = "form-field";
    
    const label = document.createElement("label");
    label.textContent = labelText;
    label.setAttribute("for", fieldName);
    
    const input = document.createElement("input");
    input.type = "checkbox";
    input.id = fieldName;
    input.name = fieldName;
    
    if (defaultValue === true) {
      input.checked = true;
    }
    
    fieldContainer.appendChild(label);
    fieldContainer.appendChild(input);
    container.appendChild(fieldContainer);
  }
  
  function addNumericField(container, fieldName, labelText, defaultValue, min, max) {
    const fieldContainer = document.createElement("div");
    fieldContainer.className = "form-field";
    
    const label = document.createElement("label");
    label.textContent = labelText;
    label.setAttribute("for", fieldName);
    
    const input = document.createElement("input");
    input.type = "number";
    input.id = fieldName;
    input.name = fieldName;
    input.value = defaultValue;
    
    if (min !== undefined) input.min = min;
    if (max !== undefined) input.max = max;
    
    fieldContainer.appendChild(label);
    fieldContainer.appendChild(input);
    container.appendChild(fieldContainer);
  }
  
  function loadStorageAccountEnvironmentSelector(permissions) {
    const envSelector = document.getElementById("environment-selector");
    envSelector.innerHTML = "<label>Target Environment:</label>";
  
    const select = document.createElement("select");
    select.id = "environment";
    select.name = "environment";
  
    // Get available environments based on permissions
    let environments = [];
    if (userPermissions === "admin") {
      environments = permissions.teams["cie-team"].environments;
    } else if (userPermissions === "contributor") {
      environments = permissions.teams["epo-team"].environments;
    }
  
    environments.forEach((env) => {
      const option = document.createElement("option");
      option.value = env;
      option.textContent = env;
      select.appendChild(option);
    });
  
    envSelector.appendChild(select);
  
    // Add approval indication
    const approvalInfo = document.createElement("div");
    approvalInfo.className = "approval-info";
    approvalInfo.innerHTML = "&nbsp;";
  
    select.addEventListener("change", () => {
      const selectedEnv = select.value;
      if (
        userPermissions === "contributor" &&
        permissions.teams["epo-team"].approval_required &&
        permissions.teams["epo-team"].approval_required[selectedEnv]
      ) {
        approvalInfo.textContent = "* Requires approval from CIE team";
      } else {
        approvalInfo.innerHTML = "&nbsp;";
      }
    });
  
    // Trigger initial display
    const event = new Event("change");
    select.dispatchEvent(event);
  
    envSelector.appendChild(approvalInfo);
  }
  
  // Set up form submission
  document.getElementById("resource-form").addEventListener("submit", function (event) {
    event.preventDefault();
    submitStorageAccountRequest();
  });