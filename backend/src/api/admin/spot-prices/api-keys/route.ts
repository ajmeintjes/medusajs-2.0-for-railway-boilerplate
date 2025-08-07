import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { SPOT_PRICE_MODULE, ApiKeyScope, ApiKeyStatus } from "../../../../modules/spot-price"
import SpotPriceModuleService from "../../../../modules/spot-price/service"
import { z } from "zod"

const CreateApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.nativeEnum(ApiKeyScope)).default([ApiKeyScope.READ]),
  expires_at: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
  key_format: z.enum(['standard', 'compact', 'uuid', 'jwt-like']).default('standard'),
})

// List all API keys
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const spotPriceModuleService: SpotPriceModuleService = req.scope.resolve(
    SPOT_PRICE_MODULE
  )

  try {
    const { status } = req.query as { status?: ApiKeyStatus }
    
    const apiKeys = await spotPriceModuleService.getApiKeys(
      status ? { status } : {}
    )

    res.json({
      api_keys: apiKeys,
    })
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch API keys",
      message: error.message,
    })
  }
}

// Create a new API key
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const spotPriceModuleService: SpotPriceModuleService = req.scope.resolve(
    SPOT_PRICE_MODULE
  )

  try {
    const validatedData = CreateApiKeySchema.parse(req.body)
  } catch (validationError) {
    return res.status(400).json({
      error: "Invalid request body",
      details: validationError.errors || validationError.message,
    })
  }

  const { name, scopes, expires_at, notes, key_format } = req.body as {
    name: string
    scopes: ApiKeyScope[]
    expires_at?: string
    notes?: string
    key_format?: string
  }

  try {
    const result = await spotPriceModuleService.createApiKey({
      name,
      scopes,
      expires_at: expires_at ? new Date(expires_at) : undefined,
      created_by: req.user?.userId || 'admin',
      notes,
      key_format: (key_format as 'standard' | 'compact' | 'uuid' | 'jwt-like') || 'standard',
    })

    res.status(201).json({
      api_key: result.apiKey,
      token: result.token, // Only returned once
      message: `API key "${name}" created successfully`,
    })
  } catch (error) {
    res.status(400).json({
      error: "Failed to create API key",
      message: error.message,
    })
  }
}
