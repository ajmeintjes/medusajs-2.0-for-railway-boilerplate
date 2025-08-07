import SpotPriceModuleService from "./service"
import { Module } from "@medusajs/framework/utils"

export const SPOT_PRICE_MODULE = "spotPrice"

export default Module(SPOT_PRICE_MODULE, {
  service: SpotPriceModuleService,
})

// Export types for use in other modules
export { MetalType, PriceSource } from "./models/spot-price"
export { ApiKeyScope, ApiKeyStatus } from "./models/api-key"
export { PricingStrategy, PricingStatus } from "./models/product-pricing"
export type { 
  SpotPriceCreateInput, 
  SpotPriceUpdateInput, 
  CurrentPricesResponse,
  ApiKeyCreateInput,
  ApiKeyResponse,
  ProductPricingCreateInput,
  ProductPricingResponse
} from "./service"
