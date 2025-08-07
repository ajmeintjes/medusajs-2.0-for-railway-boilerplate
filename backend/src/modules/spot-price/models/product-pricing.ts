import { model } from "@medusajs/framework/utils"

export enum PricingStrategy {
  SPOT_PLUS_PREMIUM = "spot_plus_premium",
  SPOT_TIMES_MULTIPLIER = "spot_times_multiplier",
  SPOT_PLUS_FIXED = "spot_plus_fixed",
  CUSTOM_FORMULA = "custom_formula"
}

export enum PricingStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  PAUSED = "paused"
}

const ProductPricing = model.define("spot_price_product_pricing", {
  id: model.id().primaryKey(),
  
  // Product reference
  product_id: model.text(), // Reference to Medusa Product ID
  variant_id: model.text().nullable(), // Optional: specific variant, null = all variants
  
  // Metal and pricing configuration
  metal_type: model.text(), // XAU, XAG, XPT
  weight_oz: model.number(), // Weight in troy ounces
  purity: model.number().default(1.0), // Purity factor (e.g., 0.999 for 99.9% pure)
  
  // Pricing strategy
  pricing_strategy: model.enum(Object.values(PricingStrategy)).default(PricingStrategy.SPOT_PLUS_PREMIUM),
  
  // Premium configuration (percentage)
  premium_percentage: model.number().default(0), // e.g., 5 = 5%
  premium_fixed: model.number().default(0), // Fixed premium in USD
  multiplier: model.number().default(1.0), // For multiplier strategy
  
  // Custom formula (for advanced users)
  custom_formula: model.text().nullable(), // e.g., "spot * weight * 1.15 + 25"
  
  // Price bounds (optional safety limits)
  min_price: model.number().nullable(),
  max_price: model.number().nullable(),
  
  // Pricing schedule
  update_frequency: model.text().default("real_time"), // real_time, hourly, daily
  last_updated: model.dateTime().nullable(),
  next_update: model.dateTime().nullable(),
  
  // Status and metadata
  status: model.enum(Object.values(PricingStatus)).default(PricingStatus.ACTIVE),
  auto_update: model.boolean().default(true),
  
  // Current calculated price cache
  current_spot_price: model.number().nullable(),
  current_calculated_price: model.number().nullable(),
  price_currency: model.text().default("USD"),
  
  // Audit fields
  created_by: model.text().nullable(),
  updated_by: model.text().nullable(),
  notes: model.text().nullable(),
  
  // Note: created_at, updated_at, and deleted_at are automatically added by Medusa
})
.indexes([
  {
    // Index for product lookups
    on: ["product_id", "status"],
    name: "IDX_PRODUCT_PRICING_PRODUCT_STATUS",
  },
  {
    // Index for variant lookups
    on: ["variant_id", "status"],
    name: "IDX_PRODUCT_PRICING_VARIANT_STATUS",
  },
  {
    // Index for metal type filtering
    on: ["metal_type", "status"],
    name: "IDX_PRODUCT_PRICING_METAL_STATUS",
  },
  {
    // Index for update scheduling
    on: ["auto_update", "next_update"],
    name: "IDX_PRODUCT_PRICING_AUTO_UPDATE",
  }
])

export default ProductPricing
