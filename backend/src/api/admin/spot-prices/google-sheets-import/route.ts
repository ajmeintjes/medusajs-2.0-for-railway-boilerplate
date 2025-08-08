import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { SPOT_PRICE_MODULE, MetalType, PriceSource } from "../../../../modules/spot-price"
import SpotPriceModuleService from "../../../../modules/spot-price/service"
import { z } from "zod"

// Validation schema for Google Sheets import
const GoogleSheetsImportSchema = z.object({
  prices: z.array(z.object({
    metal_type: z.enum(["XAU", "XAG", "XPT"]),
    price_per_ounce: z.number().positive(),
    currency: z.string().default("USD"),
    change_percentage_24h: z.number().optional(),
    source: z.string().default("Google Sheets"),
    timestamp: z.string().datetime().optional(),
  }))
})

type GoogleSheetsImportRequest = z.infer<typeof GoogleSheetsImportSchema>

/**
 * Simple endpoint optimized for Google Apps Script integration
 * Accepts batch spot price updates directly from Google Sheets
 * POST /admin/spot-prices/google-sheets-import
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const spotPriceModuleService: SpotPriceModuleService = req.scope.resolve(
    SPOT_PRICE_MODULE
  )

  try {
    // Validate request body
    const validationResult = GoogleSheetsImportSchema.safeParse(req.body)
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Invalid request format",
        details: validationResult.error.errors,
        example: {
          prices: [
            {
              metal_type: "XAU",
              price_per_ounce: 2650.50,
              currency: "USD",
              change_percentage_24h: 1.2,
              source: "Google Sheets"
            }
          ]
        }
      })
    }

    const { prices } = validationResult.data
    const results: any[] = []
    let successCount = 0
    let failureCount = 0

    // Process each price update
    for (const priceData of prices) {
      try {
        // Map string metal type to enum
        const metalType = getMetalTypeFromSymbol(priceData.metal_type)
        if (!metalType) {
          results.push({
            success: false,
            metal_type: priceData.metal_type,
            error: `Invalid metal type: ${priceData.metal_type}`,
            price: priceData.price_per_ounce
          })
          failureCount++
          continue
        }

        // Create/update spot price
        const spotPrice = await spotPriceModuleService.createSpotPrice({
          metal_type: metalType,
          symbol: priceData.metal_type,
          price_per_ounce: priceData.price_per_ounce,
          currency: priceData.currency,
          source: PriceSource.MANUAL, // Since it's coming from Google Sheets
          source_timestamp: priceData.timestamp ? new Date(priceData.timestamp) : new Date(),
          change_percentage_24h: priceData.change_percentage_24h || null,
          // Mark as validated since it's manually curated
          is_validated: true,
          validation_attempts: 0,
        })

        results.push({
          success: true,
          metal_type: priceData.metal_type,
          price: priceData.price_per_ounce,
          currency: priceData.currency,
          change_24h: priceData.change_percentage_24h,
          id: spotPrice.id,
          timestamp: spotPrice.created_at
        })
        successCount++

      } catch (error) {
        results.push({
          success: false,
          metal_type: priceData.metal_type,
          error: error instanceof Error ? error.message : 'Unknown error occurred',
          price: priceData.price_per_ounce
        })
        failureCount++
      }
    }

    // Return comprehensive response
    const response = {
      message: `Google Sheets import completed: ${successCount} successful, ${failureCount} failed`,
      summary: {
        total_received: prices.length,
        successful: successCount,
        failed: failureCount,
        success_rate: Math.round((successCount / prices.length) * 100),
        import_source: "Google Sheets",
        timestamp: new Date().toISOString()
      },
      results
    }

    // Log for debugging
    console.log(`📊 Google Sheets Import Summary:`, {
      total: prices.length,
      successful: successCount,
      failed: failureCount,
      metals: prices.map(p => p.metal_type)
    })

    res.json(response)

  } catch (error) {
    console.error("❌ Google Sheets import failed:", error)
    
    res.status(500).json({
      error: "Import operation failed",
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString()
    })
  }
}

/**
 * Get current spot prices in a format optimized for Google Sheets
 * GET /admin/spot-prices/google-sheets-import
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const spotPriceModuleService: SpotPriceModuleService = req.scope.resolve(
    SPOT_PRICE_MODULE
  )

  try {
    const currentPrices = await spotPriceModuleService.getCurrentPrices()
    
    // Format for Google Sheets consumption
    const sheetsFormat = Object.entries(currentPrices)
      .filter(([_, price]) => price !== null)
      .map(([metal, price]) => ({
        metal_type: metal,
        symbol: price!.symbol,
        price_per_ounce: parseFloat(price!.price.toString()),
        currency: price!.currency,
        change_percentage_24h: price!.change_percentage_24h ? 
          parseFloat(price!.change_percentage_24h.toString()) : null,
        last_updated: price!.last_updated,
        source: price!.source || "Manual"
      }))

    res.json({
      prices: sheetsFormat,
      count: sheetsFormat.length,
      last_updated: new Date(),
      format_note: "Optimized for Google Sheets integration"
    })

  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch spot prices",
      message: error instanceof Error ? error.message : 'Unknown error occurred'
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
