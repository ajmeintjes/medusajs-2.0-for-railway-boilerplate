import { model } from "@medusajs/framework/utils"

export enum ApiKeyScope {
  READ = "read",
  WRITE = "write", 
  ADMIN = "admin"
}

export enum ApiKeyStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  REVOKED = "revoked"
}

const ApiKey = model.define("spot_price_api_key", {
  id: model.id().primaryKey(),
  
  // Key identification
  name: model.text(), // Human-readable name for the key
  key_prefix: model.text(), // First few characters of the key (for display)
  key_hash: model.text(), // Hashed version of the full key
  
  // Key properties
  scopes: model.json(), // Array of scopes
  status: model.enum(Object.values(ApiKeyStatus)).default(ApiKeyStatus.ACTIVE),
  
  // Expiration
  expires_at: model.dateTime().nullable(), // Optional expiration date
  
  // Usage tracking
  last_used_at: model.dateTime().nullable(),
  usage_count: model.number().default(0),
  
  // Metadata
  created_by: model.text().nullable(), // User who created the key
  notes: model.text().nullable(), // Optional notes
  
  // Note: created_at, updated_at, and deleted_at are automatically added by Medusa
})
.indexes([
  {
    // Index for active keys lookup
    on: ["status", "created_at"],
    name: "IDX_API_KEY_STATUS_CREATED",
  },
  {
    // Unique constraint on key_hash
    on: ["key_hash"],
    unique: true,
    name: "UNQ_API_KEY_HASH"
  }
])

export default ApiKey
