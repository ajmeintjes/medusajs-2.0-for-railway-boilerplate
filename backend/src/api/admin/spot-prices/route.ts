import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { SPOT_PRICE_MODULE, MetalType, PriceSource } from "../../../modules/spot-price"
import SpotPriceModuleService from "../../../modules/spot-price/service"
import { CreateSpotPriceSchema } from "./validators"

// Get current spot prices for all metals
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    console.log("🔍 [SPOT-PRICES] Starting GET request...")
    console.log("🔍 [SPOT-PRICES] Available services in container:", Object.keys(req.scope.cradle))
    console.log("🔍 [SPOT-PRICES] Looking for module:", SPOT_PRICE_MODULE)
    
    // Check if the module is registered
    if (!req.scope.hasRegistration(SPOT_PRICE_MODULE)) {
      console.error("❌ [SPOT-PRICES] Module not registered:", SPOT_PRICE_MODULE)
      return res.status(500).json({
        error: "Module not registered",
        message: `Spot price module '${SPOT_PRICE_MODULE}' is not registered in the container`,
        available_services: Object.keys(req.scope.cradle).filter(key => key.includes('spot') || key.includes('price'))
      })
    }

    console.log("✅ [SPOT-PRICES] Module is registered, attempting to resolve...")
    const spotPriceModuleService: SpotPriceModuleService = req.scope.resolve(
      SPOT_PRICE_MODULE
    )
    console.log("✅ [SPOT-PRICES] Service resolved successfully")

    console.log("🔍 [SPOT-PRICES] Attempting to get current prices...")
    const currentPrices = await spotPriceModuleService.getCurrentPrices()
    console.log("✅ [SPOT-PRICES] Current prices retrieved")
    
    console.log("🔍 [SPOT-PRICES] Attempting to get statistics...")
    const statistics = await spotPriceModuleService.getPriceStatistics()
    console.log("✅ [SPOT-PRICES] Statistics retrieved")

    res.json({
      current_prices: currentPrices,
      statistics,
    })
  } catch (error) {
    console.error("❌ [SPOT-PRICES] Error in GET endpoint:")
    console.error("Error name:", error.name)
    console.error("Error message:", error.message)
    console.error("Error stack:", error.stack)
    
    // Check for specific error types
    let errorType = "unknown"
    let troubleshooting = []
    
    if (error.message.includes("relation") || error.message.includes("table")) {
      errorType = "database_schema"
      troubleshooting = [
        "Database tables may not exist",
        "Run database migrations",
        "Check if module models are properly registered"
      ]
    } else if (error.message.includes("connect") || error.message.includes("connection")) {
      errorType = "database_connection"
      troubleshooting = [
        "Check database connection string",
        "Verify database server is running",
        "Check network connectivity"
      ]
    } else if (error.message.includes("resolve") || error.message.includes("registration")) {
      errorType = "module_registration"
      troubleshooting = [
        "Check if module is registered in medusa-config.js",
        "Verify module exports are correct",
        "Check service dependencies"
      ]
    }
    
    res.status(500).json({
      error: "Failed to fetch spot prices",
      message: error.message,
      error_type: errorType,
      troubleshooting: troubleshooting,
      timestamp: new Date().toISOString()
    })
  }
}

// Manually create/update a spot price
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const spotPriceModuleService: SpotPriceModuleService = req.scope.resolve(
    SPOT_PRICE_MODULE
  )

  // Validate request body
  try {
    CreateSpotPriceSchema.parse(req.body)
  } catch (validationError) {
    return res.status(400).json({
      error: "Invalid request body",
      details: validationError.errors || validationError.message,
    })
  }

  const { 
    metal_type, 
    price_per_ounce, 
    currency = "USD",
    bid_price,
    ask_price 
  } = req.body as {
    metal_type: MetalType
    price_per_ounce: number
    currency?: string
    bid_price?: number
    ask_price?: number
  }

  try {
    // Calculate spread if both bid and ask are provided
    const spread = bid_price && ask_price ? ask_price - bid_price : undefined

    const spotPrice = await spotPriceModuleService.createSpotPrice({
      metal_type,
      symbol: metal_type, // XAU, XAG, XPT
      price_per_ounce,
      currency,
      source: PriceSource.MANUAL,
      source_timestamp: new Date(),
      bid_price,
      ask_price,
      spread,
    })

    res.status(201).json({
      spot_price: spotPrice,
      message: `Manually created spot price for ${metal_type}`,
    })
  } catch (error) {
    res.status(400).json({
      error: "Failed to create spot price",
      message: error.message,
    })
  }
}
