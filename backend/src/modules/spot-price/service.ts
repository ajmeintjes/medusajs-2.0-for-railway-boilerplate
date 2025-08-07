import { 
  MedusaService,
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
} from "@medusajs/framework/utils"
import { Logger } from "@medusajs/framework/types"
import { Context } from "@medusajs/framework/types"
import { EntityManager } from "@mikro-orm/knex"
import SpotPrice, { MetalType, PriceSource } from "./models/spot-price"
import ApiKey, { ApiKeyScope, ApiKeyStatus } from "./models/api-key"
import ProductPricing, { PricingStrategy, PricingStatus } from "./models/product-pricing"
import crypto from "crypto"

type InjectedDependencies = {
  logger: Logger
}

export type SpotPriceCreateInput = {
  metal_type: MetalType
  symbol: string
  price_per_ounce: number
  currency?: string
  source: PriceSource
  source_timestamp: Date
  api_response_raw?: string
  bid_price?: number
  ask_price?: number
  spread?: number
  change_24h?: number
  change_percentage_24h?: number
}

export type SpotPriceUpdateInput = Partial<SpotPriceCreateInput> & {
  id: string
  is_active?: boolean
  is_validated?: boolean
}

export type CurrentPricesResponse = {
  [key in MetalType]: {
    symbol: string
    metal_type: string
    price: number
    currency: string
    last_updated: string
    source: PriceSource
    bid_price?: number
    ask_price?: number
    spread?: number
    change_24h?: number
    change_percentage_24h?: number
  } | null
}

export type ApiKeyCreateInput = {
  name: string
  scopes: ApiKeyScope[]
  expires_at?: Date
  created_by?: string
  notes?: string
  key_format?: 'standard' | 'compact' | 'uuid' | 'jwt-like'
}

export type ApiKeyResponse = {
  id: string
  name: string
  key_prefix: string
  scopes: ApiKeyScope[]
  status: ApiKeyStatus
  expires_at?: string
  last_used_at?: string
  usage_count: number
  created_by?: string
  notes?: string
  created_at: string
  updated_at: string
}

export type ProductPricingCreateInput = {
  product_id: string
  variant_id?: string
  metal_type: MetalType
  weight_oz: number
  purity?: number
  pricing_strategy?: PricingStrategy
  premium_percentage?: number
  premium_fixed?: number
  multiplier?: number
  custom_formula?: string
  min_price?: number
  max_price?: number
  update_frequency?: string
  auto_update?: boolean
  created_by?: string
  notes?: string
}

export type ProductPricingResponse = {
  id: string
  product_id: string
  variant_id?: string
  metal_type: string
  weight_oz: number
  purity: number
  pricing_strategy: string
  premium_percentage: number
  premium_fixed: number
  multiplier: number
  custom_formula?: string
  min_price?: number
  max_price?: number
  update_frequency: string
  last_updated?: string
  next_update?: string
  status: string
  auto_update: boolean
  current_spot_price?: number
  current_calculated_price?: number
  price_currency: string
  created_by?: string
  updated_by?: string
  notes?: string
  created_at: string
  updated_at: string
}

export default class SpotPriceModuleService extends MedusaService({
  SpotPrice,
  ApiKey,
  ProductPricing,
}) {
  protected logger_: Logger

  constructor({ logger }: InjectedDependencies) {
    super(...arguments)
    this.logger_ = logger
  }

  /**
   * Create a hash of the API response for integrity verification
   */
  private createApiResponseHash(responseData: string): string {
    return crypto
      .createHash('sha256')
      .update(responseData)
      .digest('hex')
  }

  /**
   * Store new spot price data with integrity checks
   */
  @InjectTransactionManager()
  async createSpotPrice(
    input: SpotPriceCreateInput,
    @MedusaContext() sharedContext?: Context<EntityManager>
  ) {
    const hash = input.api_response_raw 
      ? this.createApiResponseHash(input.api_response_raw)
      : null

    // Deactivate current active price for this metal type
    if (input.source !== PriceSource.MANUAL) {
      await this.deactivateCurrentPrice(input.metal_type, sharedContext)
    }

    const spotPrice = await this.createSpotPrices({
      ...input,
      api_response_hash: hash,
      is_active: true,
      is_validated: input.source === PriceSource.MANUAL, // Manual entries are pre-validated
    })

    this.logger_.info(`Created new spot price for ${input.metal_type}: $${input.price_per_ounce}`)
    
    return spotPrice
  }

  /**
   * Get current active prices for all metals
   */
  @InjectManager()
  async getCurrentPrices(
    @MedusaContext() sharedContext?: Context<EntityManager>
  ): Promise<CurrentPricesResponse> {
    const activePrices = await this.listSpotPrices({
      is_active: true,
      deleted_at: null,
    })

    const result: CurrentPricesResponse = {
      [MetalType.GOLD]: null,
      [MetalType.SILVER]: null,
      [MetalType.PLATINUM]: null,
    }

    activePrices.forEach((price) => {
      result[price.metal_type as MetalType] = {
        symbol: price.symbol,
        metal_type: price.metal_type,
        price: parseFloat(price.price_per_ounce.toString()),
        currency: price.currency,
        last_updated: price.source_timestamp.toISOString(),
        source: price.source as PriceSource,
        bid_price: price.bid_price ? parseFloat(price.bid_price.toString()) : undefined,
        ask_price: price.ask_price ? parseFloat(price.ask_price.toString()) : undefined,
        spread: price.spread ? parseFloat(price.spread.toString()) : undefined,
        change_24h: price.change_24h ? parseFloat(price.change_24h.toString()) : undefined,
        change_percentage_24h: price.change_percentage_24h ? parseFloat(price.change_percentage_24h.toString()) : undefined,
      }
    })

    return result
  }

  /**
   * Get current active price for a specific metal
   */
  @InjectManager()
  async getCurrentPriceForMetal(
    metalType: MetalType,
    @MedusaContext() sharedContext?: Context<EntityManager>
  ) {
    const [price] = await this.listSpotPrices({
      metal_type: metalType,
      is_active: true,
      deleted_at: null,
    })

    return price || null
  }

  /**
   * Get price history for a metal within a date range
   */
  @InjectManager()
  async getPriceHistory(
    metalType: MetalType,
    options: {
      from?: Date
      to?: Date
      limit?: number
    } = {},
    @MedusaContext() sharedContext?: Context<EntityManager>
  ) {
    const filters: any = {
      metal_type: metalType,
      deleted_at: null,
    }

    if (options.from || options.to) {
      filters.created_at = {}
      if (options.from) {
        filters.created_at.$gte = options.from
      }
      if (options.to) {
        filters.created_at.$lte = options.to
      }
    }

    return await this.listSpotPrices(
      filters,
      {
        take: options.limit || 100,
        order: { created_at: "DESC" },
      }
    )
  }

  /**
   * Validate a spot price entry
   */
  @InjectTransactionManager()
  async validateSpotPrice(
    id: string,
    isValid: boolean,
    @MedusaContext() sharedContext?: Context<EntityManager>
  ) {
    const price = await this.retrieveSpotPrice(id)
    
    const updatedPrice = await this.updateSpotPrices({
      id,
      is_validated: isValid,
      validation_attempts: price.validation_attempts + 1,
    })

    this.logger_.info(`Spot price ${id} validation: ${isValid ? 'PASSED' : 'FAILED'}`)
    
    return updatedPrice
  }

  /**
   * Calculate product pricing based on spot prices
   */
  @InjectManager()
  async calculateProductPrice(
    metalType: MetalType,
    weightInOunces: number,
    premiumPercentage: number = 0,
    fixedPremium: number = 0,
    @MedusaContext() sharedContext?: Context<EntityManager>
  ) {
    const currentPrice = await this.getCurrentPriceForMetal(metalType)
    
    if (!currentPrice) {
      throw new Error(`No active price found for ${metalType}`)
    }

    const spotValue = parseFloat(currentPrice.price_per_ounce.toString()) * weightInOunces
    const premiumValue = (spotValue * premiumPercentage / 100) + fixedPremium
    const totalPrice = spotValue + premiumValue

    return {
      spot_price: parseFloat(currentPrice.price_per_ounce.toString()),
      weight_oz: weightInOunces,
      spot_value: spotValue,
      premium_percentage: premiumPercentage,
      premium_fixed: fixedPremium,
      premium_total: premiumValue,
      total_price: totalPrice,
      currency: currentPrice.currency,
      price_timestamp: currentPrice.source_timestamp,
    }
  }

  /**
   * Deactivate current active price for a metal type
   */
  @InjectTransactionManager()
  private async deactivateCurrentPrice(
    metalType: MetalType,
    @MedusaContext() sharedContext?: Context<EntityManager>
  ) {
    const currentPrice = await this.getCurrentPriceForMetal(metalType)
    
    if (currentPrice) {
      await this.updateSpotPrices({
        id: currentPrice.id,
        is_active: false,
      })
    }
  }

  /**
   * Get statistics for price data
   */
  @InjectManager()
  async getPriceStatistics(
    metalType?: MetalType,
    @MedusaContext() sharedContext?: Context<EntityManager>
  ) {
    const filters: any = {
      deleted_at: null,
    }

    if (metalType) {
      filters.metal_type = metalType
    }

    const [prices, count] = await this.listAndCountSpotPrices(filters, {
      order: { created_at: "DESC" },
      take: 1000, // Last 1000 entries for statistics
    })

    if (count === 0) {
      return {
        total_entries: 0,
        metals_tracked: 0,
        last_update: null,
        data_sources: {},
      }
    }

    const stats = {
      total_entries: count,
      metals_tracked: new Set(prices.map(p => p.metal_type)).size,
      last_update: prices[0]?.created_at || null,
      data_sources: prices.reduce((acc, price) => {
        acc[price.source] = (acc[price.source] || 0) + 1
        return acc
      }, {} as Record<string, number>),
    }

    return stats
  }

  // ===== API KEY MANAGEMENT METHODS =====

  /**
   * Generate a new API key based on format
   */
  private generateSecureKey(format: string = 'standard'): string {
    switch (format) {
      case 'compact':
        return crypto.randomBytes(16).toString('hex') // 32 chars
      case 'uuid':
        return crypto.randomUUID().replace(/-/g, '') // UUID without dashes
      case 'jwt-like':
        const header = Buffer.from(JSON.stringify({ typ: 'API', alg: 'HS256' })).toString('base64url')
        const payload = Buffer.from(JSON.stringify({ 
          iat: Math.floor(Date.now() / 1000),
          rnd: crypto.randomBytes(8).toString('hex')
        })).toString('base64url')
        const signature = crypto.randomBytes(16).toString('base64url')
        return `sp_${header}.${payload}.${signature}`
      case 'standard':
      default:
        return crypto.randomBytes(32).toString('hex') // 64 chars
    }
  }

  /**
   * Hash an API key for storage
   */
  private hashKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex')
  }

  /**
   * Create a new API key
   */
  @InjectTransactionManager()
  async createApiKey(
    input: ApiKeyCreateInput,
    @MedusaContext() sharedContext?: Context<EntityManager>
  ): Promise<{ apiKey: ApiKeyResponse; token: string }> {
    const rawKey = this.generateSecureKey(input.key_format)
    const keyHash = this.hashKey(rawKey)
    const keyPrefix = this.extractKeyPrefix(rawKey, input.key_format)

    const apiKey = await this.createApiKeys({
      name: input.name,
      key_prefix: keyPrefix,
      key_hash: keyHash,
      scopes: input.scopes as any,
      status: ApiKeyStatus.ACTIVE,
      expires_at: input.expires_at,
      created_by: input.created_by,
      notes: input.notes,
      usage_count: 0,
    })

    this.logger_.info(`Created new API key: ${input.name} (${keyPrefix}...) format: ${input.key_format || 'standard'}`)

    return {
      apiKey: this.formatApiKeyResponse(apiKey),
      token: rawKey, // Return the full key only once
    }
  }

  /**
   * Extract key prefix based on format
   */
  private extractKeyPrefix(key: string, format: string = 'standard'): string {
    switch (format) {
      case 'jwt-like':
        return key.split('.')[0] // Return header part
      case 'uuid':
        return key.substring(0, 8)
      case 'compact':
        return key.substring(0, 6)
      case 'standard':
      default:
        return key.substring(0, 8)
    }
  }

  /**
   * Regenerate an API key
   */
  @InjectTransactionManager()
  async regenerateApiKey(
    id: string,
    @MedusaContext() sharedContext?: Context<EntityManager>
  ): Promise<{ apiKey: ApiKeyResponse; token: string }> {
    const existingKey = await this.retrieveApiKey(id)
    
    if (existingKey.status !== ApiKeyStatus.ACTIVE) {
      throw new Error('Cannot regenerate inactive API key')
    }

    // Generate new key with same format (inferred from existing key structure)
    const keyFormat = this.inferKeyFormat(existingKey.key_prefix)
    const rawKey = this.generateSecureKey(keyFormat)
    const keyHash = this.hashKey(rawKey)
    const keyPrefix = this.extractKeyPrefix(rawKey, keyFormat)

    const updatedKey = await this.updateApiKeys({
      id,
      key_prefix: keyPrefix,
      key_hash: keyHash,
      usage_count: 0, // Reset usage count
      last_used_at: null, // Reset last used
    })

    this.logger_.info(`Regenerated API key: ${id} (${keyPrefix}...)`)

    return {
      apiKey: this.formatApiKeyResponse(updatedKey),
      token: rawKey,
    }
  }

  /**
   * Infer key format from existing prefix
   */
  private inferKeyFormat(prefix: string): string {
    if (prefix.startsWith('sp_')) return 'jwt-like'
    if (prefix.length === 6) return 'compact'
    if (prefix.length === 8 && /^[0-9a-f]+$/i.test(prefix)) return 'standard'
    return 'standard' // default fallback
  }

  /**
   * List all API keys
   */
  @InjectManager()
  async getApiKeys(
    filters: { status?: ApiKeyStatus } = {},
    @MedusaContext() sharedContext?: Context<EntityManager>
  ): Promise<ApiKeyResponse[]> {
    const apiKeys = await this.listApiKeys({
      deleted_at: null,
      ...filters,
    })

    return apiKeys.map(key => this.formatApiKeyResponse(key))
  }

  /**
   * Get API key by ID
   */
  @InjectManager()
  async getApiKey(
    id: string,
    @MedusaContext() sharedContext?: Context<EntityManager>
  ): Promise<ApiKeyResponse | null> {
    try {
      const apiKey = await this.retrieveApiKey(id)
      return this.formatApiKeyResponse(apiKey)
    } catch {
      return null
    }
  }

  /**
   * Validate an API key token
   */
  @InjectManager()
  async validateApiKey(
    token: string,
    @MedusaContext() sharedContext?: Context<EntityManager>
  ): Promise<ApiKeyResponse | null> {
    const keyHash = this.hashKey(token)

    const [apiKey] = await this.listApiKeys({
      key_hash: keyHash,
      status: ApiKeyStatus.ACTIVE,
      deleted_at: null,
    })

    if (!apiKey) {
      return null
    }

    // Check if key is expired
    if (apiKey.expires_at && new Date() > apiKey.expires_at) {
      await this.updateApiKeys({
        id: apiKey.id,
        status: ApiKeyStatus.INACTIVE,
      })
      return null
    }

    // Update usage tracking
    await this.updateApiKeys({
      id: apiKey.id,
      last_used_at: new Date(),
      usage_count: apiKey.usage_count + 1,
    })

    return this.formatApiKeyResponse(apiKey)
  }

  /**
   * Revoke an API key
   */
  @InjectTransactionManager()
  async revokeApiKey(
    id: string,
    @MedusaContext() sharedContext?: Context<EntityManager>
  ): Promise<ApiKeyResponse> {
    const apiKey = await this.updateApiKeys({
      id,
      status: ApiKeyStatus.REVOKED,
    })

    this.logger_.info(`Revoked API key: ${id}`)
    return this.formatApiKeyResponse(apiKey)
  }

  /**
   * Delete an API key
   */
  @InjectTransactionManager()
  async deleteApiKey(
    id: string,
    @MedusaContext() sharedContext?: Context<EntityManager>
  ): Promise<void> {
    await this.deleteApiKeys([id])
    this.logger_.info(`Deleted API key: ${id}`)
  }

  /**
   * Format API key for response (exclude sensitive data)
   */
  private formatApiKeyResponse(apiKey: any): ApiKeyResponse {
    return {
      id: apiKey.id,
      name: apiKey.name,
      key_prefix: apiKey.key_prefix,
      scopes: apiKey.scopes,
      status: apiKey.status,
      expires_at: apiKey.expires_at?.toISOString(),
      last_used_at: apiKey.last_used_at?.toISOString(),
      usage_count: apiKey.usage_count,
      created_by: apiKey.created_by,
      notes: apiKey.notes,
      created_at: apiKey.created_at.toISOString(),
      updated_at: apiKey.updated_at.toISOString(),
    }
  }

  // ===== PRODUCT PRICING METHODS =====

  /**
   * Create product pricing configuration
   */
  @InjectTransactionManager()
  async createProductPricing(
    input: ProductPricingCreateInput,
    @MedusaContext() sharedContext?: Context<EntityManager>
  ): Promise<ProductPricingResponse> {
    // Calculate next update time
    const nextUpdate = this.calculateNextUpdate(input.update_frequency || 'real_time')
    
    const productPricing = await this.createProductPricings({
      product_id: input.product_id,
      variant_id: input.variant_id,
      metal_type: input.metal_type,
      weight_oz: input.weight_oz,
      purity: input.purity || 1.0,
      pricing_strategy: input.pricing_strategy || PricingStrategy.SPOT_PLUS_PREMIUM,
      premium_percentage: input.premium_percentage || 0,
      premium_fixed: input.premium_fixed || 0,
      multiplier: input.multiplier || 1.0,
      custom_formula: input.custom_formula,
      min_price: input.min_price,
      max_price: input.max_price,
      update_frequency: input.update_frequency || 'real_time',
      next_update: nextUpdate,
      status: PricingStatus.ACTIVE,
      auto_update: input.auto_update ?? true,
      price_currency: 'USD',
      created_by: input.created_by,
      notes: input.notes,
    })

    // Calculate initial price
    await this.updateProductPricing(productPricing.id)

    this.logger_.info(`Created product pricing for ${input.product_id}: ${input.metal_type} ${input.weight_oz}oz`)
    
    return this.formatProductPricingResponse(productPricing)
  }

  /**
   * Update product pricing and recalculate price
   */
  @InjectTransactionManager()
  async updateProductPricing(
    id: string,
    input?: Partial<ProductPricingCreateInput>,
    @MedusaContext() sharedContext?: Context<EntityManager>
  ): Promise<ProductPricingResponse> {
    const productPricing = await this.retrieveProductPricing(id)
    const spotPrice = await this.getCurrentPriceForMetal(productPricing.metal_type as MetalType)
    
    if (!spotPrice) {
      throw new Error(`No active spot price found for ${productPricing.metal_type}`)
    }

    const currentSpotPrice = parseFloat(spotPrice.price_per_ounce.toString())
    const calculatedPrice = this.calculatePriceFromStrategy(
      currentSpotPrice,
      productPricing.weight_oz,
      productPricing.purity,
      productPricing.pricing_strategy as PricingStrategy,
      {
        premium_percentage: productPricing.premium_percentage,
        premium_fixed: productPricing.premium_fixed,
        multiplier: productPricing.multiplier,
        custom_formula: productPricing.custom_formula,
      }
    )

    // Apply price bounds
    const boundedPrice = this.applyPriceBounds(
      calculatedPrice,
      productPricing.min_price,
      productPricing.max_price
    )

    const updateData: any = {
      id,
      current_spot_price: currentSpotPrice,
      current_calculated_price: boundedPrice,
      last_updated: new Date(),
      next_update: this.calculateNextUpdate(productPricing.update_frequency),
      ...input,
    }

    const updatedPricing = await this.updateProductPricings(updateData)
    
    this.logger_.info(`Updated product pricing ${id}: $${boundedPrice} (spot: $${currentSpotPrice})`)
    
    return this.formatProductPricingResponse(updatedPricing)
  }

  /**
   * Get product pricing by ID
   */
  @InjectManager()
  async getProductPricing(
    id: string,
    @MedusaContext() sharedContext?: Context<EntityManager>
  ): Promise<ProductPricingResponse | null> {
    try {
      const productPricing = await this.retrieveProductPricing(id)
      return this.formatProductPricingResponse(productPricing)
    } catch {
      return null
    }
  }

  /**
   * List product pricing configurations
   */
  @InjectManager()
  async getProductPricings(
    filters: {
      product_id?: string
      variant_id?: string
      metal_type?: MetalType
      status?: PricingStatus
    } = {},
    @MedusaContext() sharedContext?: Context<EntityManager>
  ): Promise<ProductPricingResponse[]> {
    const productPricings = await this.listProductPricings({
      deleted_at: null,
      ...filters,
    })

    return productPricings.map(pricing => this.formatProductPricingResponse(pricing))
  }

  /**
   * Update all active product prices
   */
  @InjectManager()
  async updateAllProductPrices(
    metalType?: MetalType,
    @MedusaContext() sharedContext?: Context<EntityManager>
  ): Promise<{ updated: number; errors: string[] }> {
    const filters: any = {
      status: PricingStatus.ACTIVE,
      auto_update: true,
      deleted_at: null,
    }

    if (metalType) {
      filters.metal_type = metalType
    }

    const productPricings = await this.getProductPricings(filters)
    let updated = 0
    const errors: string[] = []

    for (const pricing of productPricings) {
      try {
        await this.updateProductPricing(pricing.id)
        updated++
      } catch (error) {
        errors.push(`Failed to update ${pricing.id}: ${error.message}`)
      }
    }

    this.logger_.info(`Updated ${updated} product prices${metalType ? ` for ${metalType}` : ''}`)
    
    return { updated, errors }
  }

  /**
   * Calculate price based on pricing strategy
   */
  private calculatePriceFromStrategy(
    spotPrice: number,
    weight: number,
    purity: number,
    strategy: PricingStrategy,
    params: {
      premium_percentage?: number
      premium_fixed?: number
      multiplier?: number
      custom_formula?: string
    }
  ): number {
    const adjustedSpotPrice = spotPrice * weight * purity

    switch (strategy) {
      case PricingStrategy.SPOT_PLUS_PREMIUM:
        const premiumValue = (adjustedSpotPrice * (params.premium_percentage || 0) / 100) + (params.premium_fixed || 0)
        return adjustedSpotPrice + premiumValue

      case PricingStrategy.SPOT_TIMES_MULTIPLIER:
        return adjustedSpotPrice * (params.multiplier || 1.0)

      case PricingStrategy.SPOT_PLUS_FIXED:
        return adjustedSpotPrice + (params.premium_fixed || 0)

      case PricingStrategy.CUSTOM_FORMULA:
        if (params.custom_formula) {
          try {
            // Basic formula evaluation (replace with more secure eval if needed)
            return this.evaluateCustomFormula(params.custom_formula, {
              spot: spotPrice,
              weight,
              purity,
              adjusted_spot: adjustedSpotPrice,
            })
          } catch (error) {
            this.logger_.error(`Custom formula evaluation failed: ${error.message}`)
            return adjustedSpotPrice // Fallback to spot price
          }
        }
        return adjustedSpotPrice

      default:
        return adjustedSpotPrice
    }
  }

  /**
   * Evaluate custom formula (basic implementation)
   */
  private evaluateCustomFormula(formula: string, variables: Record<string, number>): number {
    // This is a basic implementation. For production, consider using a secure formula parser
    let evaluatedFormula = formula
    
    Object.entries(variables).forEach(([key, value]) => {
      evaluatedFormula = evaluatedFormula.replace(new RegExp(key, 'g'), value.toString())
    })

    // Basic mathematical operations only
    const safeFormula = evaluatedFormula.replace(/[^0-9+\-*/().\s]/g, '')
    
    try {
      return Function(`"use strict"; return (${safeFormula})`)() as number
    } catch {
      throw new Error('Invalid formula')
    }
  }

  /**
   * Apply price bounds
   */
  private applyPriceBounds(price: number, minPrice?: number, maxPrice?: number): number {
    let boundedPrice = price
    
    if (minPrice !== undefined && boundedPrice < minPrice) {
      boundedPrice = minPrice
    }
    
    if (maxPrice !== undefined && boundedPrice > maxPrice) {
      boundedPrice = maxPrice
    }
    
    return boundedPrice
  }

  /**
   * Calculate next update time based on frequency
   */
  private calculateNextUpdate(frequency: string): Date | null {
    const now = new Date()
    
    switch (frequency) {
      case 'real_time':
        return null // No scheduled update
      case 'hourly':
        return new Date(now.getTime() + 60 * 60 * 1000)
      case 'daily':
        return new Date(now.getTime() + 24 * 60 * 60 * 1000)
      default:
        return null
    }
  }

  /**
   * Format product pricing for response
   */
  private formatProductPricingResponse(productPricing: any): ProductPricingResponse {
    return {
      id: productPricing.id,
      product_id: productPricing.product_id,
      variant_id: productPricing.variant_id,
      metal_type: productPricing.metal_type,
      weight_oz: productPricing.weight_oz,
      purity: productPricing.purity,
      pricing_strategy: productPricing.pricing_strategy,
      premium_percentage: productPricing.premium_percentage,
      premium_fixed: productPricing.premium_fixed,
      multiplier: productPricing.multiplier,
      custom_formula: productPricing.custom_formula,
      min_price: productPricing.min_price,
      max_price: productPricing.max_price,
      update_frequency: productPricing.update_frequency,
      last_updated: productPricing.last_updated?.toISOString(),
      next_update: productPricing.next_update?.toISOString(),
      status: productPricing.status,
      auto_update: productPricing.auto_update,
      current_spot_price: productPricing.current_spot_price,
      current_calculated_price: productPricing.current_calculated_price,
      price_currency: productPricing.price_currency,
      created_by: productPricing.created_by,
      updated_by: productPricing.updated_by,
      notes: productPricing.notes,
      created_at: productPricing.created_at.toISOString(),
      updated_at: productPricing.updated_at.toISOString(),
    }
  }
}
