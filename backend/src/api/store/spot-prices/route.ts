import type {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { SPOT_PRICE_MODULE, MetalType } from "../../../modules/spot-price"
import SpotPriceModuleService from "../../../modules/spot-price/service"

// Get current spot prices for display on storefront
export const GET = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  const spotPriceModuleService: SpotPriceModuleService = req.scope.resolve(
    SPOT_PRICE_MODULE
  )

  try {
    const currentPrices = await spotPriceModuleService.getCurrentPrices()

    // Format for frontend ticker display
    const tickerData = Object.entries(currentPrices)
      .filter(([_, price]) => price !== null)
      .map(([metal, price]) => ({
        symbol: price!.symbol,
        metal_type: metal,
        price: price!.price,
        currency: price!.currency,
        change_24h: price!.change_24h,
        change_percentage_24h: price!.change_percentage_24h,
        last_updated: price!.last_updated,
      }))

    // Set cache headers for 5 minutes
    res.setHeader('Cache-Control', 'public, max-age=300')
    res.json({
      ticker_data: tickerData,
      last_updated: new Date(),
    })
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch spot prices",
      message: "Service temporarily unavailable",
    })
  }
}
