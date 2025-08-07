import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { SPOT_PRICE_MODULE, MetalType, PriceSource } from "../../../../modules/spot-price"
import SpotPriceModuleService from "../../../../modules/spot-price/service"
import { SpotPriceApiClient } from "../../../../modules/spot-price/services/api-client"

type ImportRequest = {
  source: 'primary' | 'backup' | 'manual'
  metals: string[]
  primaryApiKey?: string
  primaryApiUrl?: string
  backupApiKey?: string
  backupApiUrl?: string
  requestTimeout?: number
}

type BulkImportRequest = {
  sources: ('primary' | 'backup')[]
  metals: string[]
}

// Import spot prices from external APIs
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const spotPriceModuleService: SpotPriceModuleService = req.scope.resolve(
    SPOT_PRICE_MODULE
  )

  const { 
    source, 
    metals = ['XAU', 'XAG', 'XPT'], 
    primaryApiKey,
    primaryApiUrl,
    backupApiKey,
    backupApiUrl,
    requestTimeout = 10000
  } = req.body as ImportRequest

  if (!metals || metals.length === 0) {
    return res.status(400).json({
      error: "No metals specified for import",
      message: "Please select at least one metal type to import"
    })
  }

  try {
    // Configure API client based on source
    const apiOptions = {
      primaryApiKey: primaryApiKey || process.env.METALS_API_PRIMARY_KEY,
      primaryApiUrl: primaryApiUrl || process.env.METALS_API_PRIMARY_URL || "https://api.metals-api.com/v1",
      backupApiKey: backupApiKey || process.env.METALS_API_BACKUP_KEY,
      backupApiUrl: backupApiUrl || process.env.METALS_API_BACKUP_URL,
      requestTimeout,
    }

    const apiClient = new SpotPriceApiClient({ logger: req.scope.resolve("logger") }, apiOptions)
    const results: any[] = []

    // Import prices for each selected metal
    for (const metalSymbol of metals) {
      try {
        // Validate metal type
        const metalType = getMetalTypeFromSymbol(metalSymbol)
        if (!metalType) {
          results.push({
            success: false,
            metal_type: metalSymbol,
            error: `Invalid metal symbol: ${metalSymbol}`,
            price: 0,
            source: source,
            timestamp: new Date().toISOString(),
          })
          continue
        }

        // Fetch price data from API
        const priceData = await apiClient.fetchPriceForMetal(metalType)
        
        if (!priceData) {
          results.push({
            success: false,
            metal_type: metalSymbol,
            error: "No price data received from API",
            price: 0,
            source: source,
            timestamp: new Date().toISOString(),
          })
          continue
        }

        // Store the spot price
        const spotPrice = await spotPriceModuleService.createSpotPrice({
          metal_type: priceData.metal_type,
          symbol: priceData.symbol,
          price_per_ounce: priceData.price_per_ounce,
          currency: priceData.currency,
          source: priceData.source,
          source_timestamp: priceData.timestamp,
          api_response_raw: priceData.raw_response,
          bid_price: priceData.bid_price,
          ask_price: priceData.ask_price,
          spread: priceData.spread,
          change_24h: priceData.change_24h,
          change_percentage_24h: priceData.change_percentage_24h,
        })

        results.push({
          success: true,
          metal_type: metalSymbol,
          price: priceData.price_per_ounce,
          source: priceData.source,
          timestamp: priceData.timestamp.toISOString(),
          id: spotPrice.id,
        })

      } catch (metalError) {
        results.push({
          success: false,
          metal_type: metalSymbol,
          error: metalError instanceof Error ? metalError.message : 'Unknown error occurred',
          price: 0,
          source: source,
          timestamp: new Date().toISOString(),
        })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failureCount = results.filter(r => !r.success).length

    res.json({
      message: `Import completed: ${successCount} successful, ${failureCount} failed`,
      results,
      summary: {
        total: results.length,
        successful: successCount,
        failed: failureCount,
        source: source,
        timestamp: new Date().toISOString(),
      }
    })

  } catch (error) {
    res.status(500).json({
      error: "Import operation failed",
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      results: [],
    })
  }
}

// Helper function to convert symbol to MetalType enum
function getMetalTypeFromSymbol(symbol: string): MetalType | null {
  switch (symbol.toUpperCase()) {
    case 'XAU':
      return MetalType.GOLD
    case 'XAG':
      return MetalType.SILVER
    case 'XPT':
      return MetalType.PLATINUM
    default:
      return null
  }
}
