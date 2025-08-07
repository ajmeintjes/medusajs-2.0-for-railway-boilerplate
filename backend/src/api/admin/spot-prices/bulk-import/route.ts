import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { SPOT_PRICE_MODULE, MetalType, PriceSource } from "../../../../modules/spot-price"
import SpotPriceModuleService from "../../../../modules/spot-price/service"
import { SpotPriceApiClient } from "../../../../modules/spot-price/services/api-client"

type BulkImportRequest = {
  sources: ('primary' | 'backup')[]
  metals: string[]
}

// Bulk import spot prices from multiple sources
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const spotPriceModuleService: SpotPriceModuleService = req.scope.resolve(
    SPOT_PRICE_MODULE
  )

  const { 
    sources = ['primary'], 
    metals = ['XAU', 'XAG', 'XPT'] 
  } = req.body as BulkImportRequest

  if (!metals || metals.length === 0) {
    return res.status(400).json({
      error: "No metals specified for import",
      message: "Please select at least one metal type to import"
    })
  }

  if (!sources || sources.length === 0) {
    return res.status(400).json({
      error: "No sources specified for import",
      message: "Please select at least one import source"
    })
  }

  try {
    // Configure API client with environment variables
    const apiOptions = {
      primaryApiKey: process.env.METALS_API_PRIMARY_KEY,
      primaryApiUrl: process.env.METALS_API_PRIMARY_URL || "https://api.metals-api.com/v1",
      backupApiKey: process.env.METALS_API_BACKUP_KEY,
      backupApiUrl: process.env.METALS_API_BACKUP_URL,
      requestTimeout: parseInt(process.env.METALS_API_TIMEOUT || "10000"),
      maxRetries: parseInt(process.env.METALS_API_MAX_RETRIES || "3"),
    }

    const apiClient = new SpotPriceApiClient(
      { logger: req.scope.resolve("logger") }, 
      apiOptions
    )

    const allResults: any[] = []
    const sourceResults: Record<string, any[]> = {}

    // Try each source in order of preference
    for (const source of sources) {
      sourceResults[source] = []

      for (const metalSymbol of metals) {
        try {
          // Check if we already have a successful result for this metal from a previous source
          const existingSuccess = allResults.find(r => 
            r.metal_type === metalSymbol && r.success
          )
          
          if (existingSuccess) {
            // Skip this metal as we already have a successful import
            continue
          }

          // Validate metal type
          const metalType = getMetalTypeFromSymbol(metalSymbol)
          if (!metalType) {
            const errorResult = {
              success: false,
              metal_type: metalSymbol,
              error: `Invalid metal symbol: ${metalSymbol}`,
              price: 0,
              source: source,
              timestamp: new Date().toISOString(),
            }
            sourceResults[source].push(errorResult)
            allResults.push(errorResult)
            continue
          }

          // Fetch price data from API
          const priceData = await apiClient.fetchPriceForMetal(metalType)
          
          if (!priceData) {
            const errorResult = {
              success: false,
              metal_type: metalSymbol,
              error: `No price data received from ${source} API`,
              price: 0,
              source: source,
              timestamp: new Date().toISOString(),
            }
            sourceResults[source].push(errorResult)
            allResults.push(errorResult)
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

          const successResult = {
            success: true,
            metal_type: metalSymbol,
            price: priceData.price_per_ounce,
            source: priceData.source,
            timestamp: priceData.timestamp.toISOString(),
            id: spotPrice.id,
          }

          sourceResults[source].push(successResult)
          allResults.push(successResult)

        } catch (metalError) {
          const errorResult = {
            success: false,
            metal_type: metalSymbol,
            error: metalError instanceof Error ? metalError.message : 'Unknown error occurred',
            price: 0,
            source: source,
            timestamp: new Date().toISOString(),
          }
          sourceResults[source].push(errorResult)
          allResults.push(errorResult)
        }
      }
    }

    // Calculate statistics
    const totalRequested = metals.length
    const successfulImports = allResults.filter(r => r.success).length
    const failedImports = totalRequested - successfulImports

    // Get unique successful metals (in case multiple sources succeeded for the same metal)
    const uniqueSuccessfulMetals = new Set(
      allResults.filter(r => r.success).map(r => r.metal_type)
    ).size

    const summary = {
      total_requested: totalRequested,
      unique_successful: uniqueSuccessfulMetals,
      total_failed: failedImports,
      sources_attempted: sources,
      results_by_source: Object.fromEntries(
        Object.entries(sourceResults).map(([source, results]) => [
          source,
          {
            attempted: results.length,
            successful: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
          }
        ])
      ),
      timestamp: new Date().toISOString(),
    }

    res.json({
      message: `Bulk import completed: ${uniqueSuccessfulMetals}/${totalRequested} metals imported successfully`,
      results: allResults,
      summary,
      source_breakdown: sourceResults,
    })

  } catch (error) {
    res.status(500).json({
      error: "Bulk import operation failed",
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
