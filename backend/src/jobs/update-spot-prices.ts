import { MedusaContainer } from "@medusajs/framework/types"
import { SPOT_PRICE_MODULE } from "../modules/spot-price"
import SpotPriceModuleService from "../modules/spot-price/service"
import { SpotPriceApiClient } from "../modules/spot-price/services/api-client"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export default async function updateSpotPricesJob(
  container: MedusaContainer
) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const spotPriceModuleService: SpotPriceModuleService = container.resolve(
    SPOT_PRICE_MODULE
  )

  logger.info("[SPOT-PRICES] Starting scheduled price update...")

  try {
    // Get API configuration from environment variables
    const apiOptions = {
      primaryApiKey: process.env.METALS_API_KEY,
      primaryApiUrl: process.env.METALS_API_URL || "https://api.metals-api.com/v1",
      backupApiKey: process.env.BACKUP_METALS_API_KEY,
      backupApiUrl: process.env.BACKUP_METALS_API_URL,
      requestTimeout: 15000,
      maxRetries: 3,
    }

    if (!apiOptions.primaryApiKey) {
      logger.warn("[SPOT-PRICES] No API key configured, skipping price update")
      return
    }

    // Initialize API client
    const apiClient = new SpotPriceApiClient(
      { logger },
      apiOptions
    )

    // Test connectivity first
    const connectivity = await apiClient.testConnectivity()
    if (!connectivity.primary && !connectivity.backup) {
      logger.error("[SPOT-PRICES] No API connectivity available")
      logger.error(JSON.stringify(connectivity.errors))
      return
    }

    // Fetch current prices from APIs
    const apiPrices = await apiClient.fetchCurrentPrices()
    
    if (apiPrices.length === 0) {
      logger.warn("[SPOT-PRICES] No price data received from APIs")
      return
    }

    // Store the prices in database
    const updatedPrices = []
    for (const apiPrice of apiPrices) {
      try {
        const spotPrice = await spotPriceModuleService.createSpotPrice({
          metal_type: apiPrice.metal_type,
          symbol: apiPrice.symbol,
          price_per_ounce: apiPrice.price_per_ounce,
          currency: apiPrice.currency,
          source: apiPrice.source,
          source_timestamp: apiPrice.timestamp,
          api_response_raw: apiPrice.raw_response,
          bid_price: apiPrice.bid_price,
          ask_price: apiPrice.ask_price,
          spread: apiPrice.spread,
          change_24h: apiPrice.change_24h,
          change_percentage_24h: apiPrice.change_percentage_24h,
        })

        updatedPrices.push({
          metal: apiPrice.metal_type,
          price: apiPrice.price_per_ounce,
          source: apiPrice.source,
        })

        logger.info(`[SPOT-PRICES] Updated ${apiPrice.metal_type}: $${apiPrice.price_per_ounce}`)
      } catch (error) {
        logger.error(`[SPOT-PRICES] Failed to store ${apiPrice.metal_type} price: ${error.message}`)
      }
    }

    // Log summary
    logger.info(`[SPOT-PRICES] Price update completed. Updated ${updatedPrices.length} metals:`)
    logger.info(JSON.stringify({ updated_metals: updatedPrices }))

    // Optional: Trigger price-dependent product updates
    // await triggerProductPriceRecalculation(container, updatedPrices)

  } catch (error) {
    logger.error("[SPOT-PRICES] Failed to update spot prices:")
    logger.error(JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }))
  }
}

// Optional function to trigger product price recalculation
async function triggerProductPriceRecalculation(
  container: MedusaContainer,
  updatedPrices: Array<{ metal: string; price: number; source: string }>
) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  
  // This is where you would trigger product price updates
  // if your products are priced based on spot prices
  logger.info("[SPOT-PRICES] Triggering product price recalculation for updated metals...")
  
  // Example: You could emit an event here that other services listen to
  // const eventBusService = container.resolve("eventBusService")
  // await eventBusService.emit("spot-prices.updated", { updatedPrices })
}

export const config = {
  name: "update-spot-prices",
  // Run every 5 minutes during market hours (9 AM to 6 PM EST, Mon-Fri)
  // This cron runs every 5 minutes: */5 * * * *
  // For market hours only, you'd need additional logic in the job
  schedule: "*/5 * * * *",
}
