import { model } from "@medusajs/framework/utils"

export enum MetalType {
  GOLD = "XAU",
  SILVER = "XAG", 
  PLATINUM = "XPT"
}

export enum PriceSource {
  API_PRIMARY = "api_primary",
  API_BACKUP = "api_backup",
  MANUAL = "manual"
}

const SpotPrice = model.define("spot_price", {
  id: model.id().primaryKey(),
  
  // Metal information
  metal_type: model.enum(Object.values(MetalType)),
  symbol: model.text(), // XAU, XAG, XPT
  
  // Price information
  price_per_ounce: model.bigNumber(), // Price in USD per troy ounce
  currency: model.text().default("USD"),
  
  // Data source and integrity
  source: model.enum(Object.values(PriceSource)),
  source_timestamp: model.dateTime(), // When price was fetched from source
  api_response_hash: model.text().nullable(), // Hash of API response for integrity
  
  // Validation and status
  is_active: model.boolean().default(true),
  is_validated: model.boolean().default(false),
  validation_attempts: model.number().default(0),
  
  // API metadata
  bid_price: model.bigNumber().nullable(), // Bid price if available
  ask_price: model.bigNumber().nullable(), // Ask price if available
  spread: model.bigNumber().nullable(), // Bid-ask spread
  
  // Change tracking
  change_24h: model.bigNumber().nullable(), // 24h price change
  change_percentage_24h: model.bigNumber().nullable(), // 24h percentage change
  
  // Note: created_at, updated_at, and deleted_at are automatically added by Medusa
})
.indexes([
  {
    // Compound index for efficient queries
    on: ["metal_type", "created_at"],
    name: "IDX_SPOT_PRICE_METAL_CREATED",
  },
  {
    // Index for active prices
    on: ["is_active", "metal_type"],
    name: "IDX_SPOT_PRICE_ACTIVE_METAL",
  },
  {
    // Unique constraint for current active price per metal
    on: ["metal_type"],
    where: {
      is_active: true,
      deleted_at: null,
    },
    unique: true,
    name: "UNQ_ACTIVE_SPOT_PRICE_PER_METAL"
  }
])

export default SpotPrice
