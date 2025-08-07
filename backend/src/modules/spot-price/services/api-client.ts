import { Logger } from "@medusajs/framework/types"
import { MetalType, PriceSource } from "../models/spot-price"
import axios, { AxiosInstance } from "axios"

type InjectedDependencies = {
  logger: Logger
}

export type SpotPriceApiOptions = {
  primaryApiKey?: string
  primaryApiUrl?: string
  backupApiKey?: string
  backupApiUrl?: string
  requestTimeout?: number
  maxRetries?: number
}

export type ApiPriceResponse = {
  metal_type: MetalType
  symbol: string
  price_per_ounce: number
  currency: string
  timestamp: Date
  source: PriceSource
  bid_price?: number
  ask_price?: number
  spread?: number
  change_24h?: number
  change_percentage_24h?: number
  raw_response: string
}

export class SpotPriceApiClient {
  private logger_: Logger
  private options_: SpotPriceApiOptions
  private primaryClient: AxiosInstance
  private backupClient?: AxiosInstance

  constructor(
    { logger }: InjectedDependencies,
    options: SpotPriceApiOptions
  ) {
    this.logger_ = logger
    this.options_ = options

    // Primary API client
    this.primaryClient = axios.create({
      baseURL: options.primaryApiUrl || "https://api.metals-api.com/v1",
      timeout: options.requestTimeout || 10000,
      headers: {
        'Authorization': `Bearer ${options.primaryApiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Medusa-SpotPrice/1.0',
      },
    })

    // Backup API client (if configured)
    if (options.backupApiUrl && options.backupApiKey) {
      this.backupClient = axios.create({
        baseURL: options.backupApiUrl,
        timeout: options.requestTimeout || 10000,
        headers: {
          'Authorization': `Bearer ${options.backupApiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Medusa-SpotPrice/1.0',
        },
      })
    }
  }

  /**
   * Fetch current spot prices for all metals
   */
  async fetchCurrentPrices(): Promise<ApiPriceResponse[]> {
    const results: ApiPriceResponse[] = []
    const metals = [MetalType.GOLD, MetalType.SILVER, MetalType.PLATINUM]

    for (const metal of metals) {
      try {
        const priceData = await this.fetchPriceForMetal(metal)
        if (priceData) {
          results.push(priceData)
        }
      } catch (error) {
        this.logger_.error(`Failed to fetch ${metal} price: ${error.message}`)
        // Continue with other metals even if one fails
      }
    }

    return results
  }

  /**
   * Fetch spot price for a specific metal
   */
  async fetchPriceForMetal(metalType: MetalType): Promise<ApiPriceResponse | null> {
    let lastError: Error | null = null

    // Try primary API first
    try {
      return await this.fetchFromPrimaryApi(metalType)
    } catch (error) {
      lastError = error as Error
      this.logger_.warn(`Primary API failed for ${metalType}: ${error.message}`)
    }

    // Try backup API if available
    if (this.backupClient) {
      try {
        return await this.fetchFromBackupApi(metalType)
      } catch (error) {
        this.logger_.warn(`Backup API failed for ${metalType}: ${error.message}`)
        lastError = error as Error
      }
    }

    // If both APIs failed
    this.logger_.error(`All APIs failed for ${metalType}. Last error: ${lastError?.message}`)
    throw lastError || new Error(`Failed to fetch price for ${metalType}`)
  }

  /**
   * Fetch from primary API (example for metals-api.com)
   */
  private async fetchFromPrimaryApi(metalType: MetalType): Promise<ApiPriceResponse> {
    const symbol = this.getMetalSymbol(metalType)
    
    // Example API call - adjust based on your actual API
    const response = await this.primaryClient.get(`/latest`, {
      params: {
        access_key: this.options_.primaryApiKey,
        base: 'USD',
        symbols: symbol,
      },
    })

    if (!response.data || !response.data.success) {
      throw new Error(`API returned error: ${response.data?.error?.info || 'Unknown error'}`)
    }

    const rates = response.data.rates
    const price = rates[symbol]

    if (!price) {
      throw new Error(`No price data found for ${symbol}`)
    }

    // Convert price per gram to price per troy ounce (1 troy ounce = 31.1035 grams)
    const pricePerOunce = price * 31.1035

    return {
      metal_type: metalType,
      symbol: symbol,
      price_per_ounce: pricePerOunce,
      currency: 'USD',
      timestamp: new Date(response.data.timestamp * 1000),
      source: PriceSource.API_PRIMARY,
      raw_response: JSON.stringify(response.data),
    }
  }

  /**
   * Fetch from backup API
   */
  private async fetchFromBackupApi(metalType: MetalType): Promise<ApiPriceResponse> {
    const symbol = this.getMetalSymbol(metalType)
    
    // Example backup API call - adjust based on your backup API
    const response = await this.backupClient!.get(`/spot-prices/${symbol.toLowerCase()}`)

    if (!response.data) {
      throw new Error('No data received from backup API')
    }

    // Adjust this parsing based on your backup API response format
    const priceData = response.data

    return {
      metal_type: metalType,
      symbol: symbol,
      price_per_ounce: priceData.price,
      currency: priceData.currency || 'USD',
      timestamp: new Date(priceData.timestamp),
      source: PriceSource.API_BACKUP,
      bid_price: priceData.bid,
      ask_price: priceData.ask,
      spread: priceData.spread,
      change_24h: priceData.change_24h,
      change_percentage_24h: priceData.change_percentage_24h,
      raw_response: JSON.stringify(response.data),
    }
  }

  /**
   * Get API symbol for metal type
   */
  private getMetalSymbol(metalType: MetalType): string {
    switch (metalType) {
      case MetalType.GOLD:
        return 'XAU'
      case MetalType.SILVER:
        return 'XAG'
      case MetalType.PLATINUM:
        return 'XPT'
      default:
        throw new Error(`Unsupported metal type: ${metalType}`)
    }
  }

  /**
   * Test API connectivity
   */
  async testConnectivity(): Promise<{
    primary: boolean
    backup: boolean
    errors: string[]
  }> {
    const result = {
      primary: false,
      backup: false,
      errors: [] as string[],
    }

    // Test primary API
    try {
      await this.primaryClient.get('/latest', {
        params: {
          access_key: this.options_.primaryApiKey,
          base: 'USD',
          symbols: 'XAU',
        },
        timeout: 5000,
      })
      result.primary = true
    } catch (error) {
      result.errors.push(`Primary API: ${error.message}`)
    }

    // Test backup API
    if (this.backupClient) {
      try {
        await this.backupClient.get('/health', { timeout: 5000 })
        result.backup = true
      } catch (error) {
        result.errors.push(`Backup API: ${error.message}`)
      }
    }

    return result
  }
}
