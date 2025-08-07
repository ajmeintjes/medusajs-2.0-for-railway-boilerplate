import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { SPOT_PRICE_MODULE } from "../../../../../modules/spot-price"
import SpotPriceModuleService from "../../../../../modules/spot-price/service"

// Get specific API key
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const spotPriceModuleService: SpotPriceModuleService = req.scope.resolve(
    SPOT_PRICE_MODULE
  )

  const { id } = req.params

  try {
    const apiKey = await spotPriceModuleService.getApiKey(id)

    if (!apiKey) {
      return res.status(404).json({
        error: "API key not found",
      })
    }

    res.json({
      api_key: apiKey,
    })
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch API key",
      message: error.message,
    })
  }
}

// Handle API key actions (revoke, regenerate)
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const spotPriceModuleService: SpotPriceModuleService = req.scope.resolve(
    SPOT_PRICE_MODULE
  )

  const { id } = req.params
  const { action } = req.body as { action: 'revoke' | 'regenerate' }

  if (!['revoke', 'regenerate'].includes(action)) {
    return res.status(400).json({
      error: "Invalid action. Supported actions: 'revoke', 'regenerate'",
    })
  }

  try {
    if (action === 'revoke') {
      const revokedKey = await spotPriceModuleService.revokeApiKey(id)
      return res.json({
        api_key: revokedKey,
        message: "API key revoked successfully",
      })
    }
    
    if (action === 'regenerate') {
      const result = await spotPriceModuleService.regenerateApiKey(id)
      return res.json({
        api_key: result.apiKey,
        token: result.token, // Only returned once
        message: "API key regenerated successfully",
      })
    }
  } catch (error) {
    res.status(400).json({
      error: `Failed to ${action} API key`,
      message: error.message,
    })
  }
}

// Delete API key
export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const spotPriceModuleService: SpotPriceModuleService = req.scope.resolve(
    SPOT_PRICE_MODULE
  )

  const { id } = req.params

  try {
    await spotPriceModuleService.deleteApiKey(id)

    res.json({
      message: "API key deleted successfully",
    })
  } catch (error) {
    res.status(400).json({
      error: "Failed to delete API key",
      message: error.message,
    })
  }
}
