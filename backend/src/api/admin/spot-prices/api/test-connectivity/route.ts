import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { SpotPriceApiClient } from "../../../../../modules/spot-price/services/api-client"

type ConnectivityTestRequest = {
  primaryApiKey?: string
  primaryApiUrl?: string
  backupApiKey?: string
  backupApiUrl?: string
  requestTimeout?: number
}

// Test API connectivity for spot price sources
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const {
    primaryApiKey,
    primaryApiUrl,
    backupApiKey,
    backupApiUrl,
    requestTimeout = 10000
  } = req.body as ConnectivityTestRequest

  try {
    // Configure API client with provided or environment variables
    const apiOptions = {
      primaryApiKey: primaryApiKey || process.env.METALS_API_PRIMARY_KEY,
      primaryApiUrl: primaryApiUrl || process.env.METALS_API_PRIMARY_URL || "https://api.metals-api.com/v1",
      backupApiKey: backupApiKey || process.env.METALS_API_BACKUP_KEY,
      backupApiUrl: backupApiUrl || process.env.METALS_API_BACKUP_URL,
      requestTimeout,
      maxRetries: 1, // Single retry for connectivity test
    }

    // Check if we have required API keys
    if (!apiOptions.primaryApiKey) {
      return res.status(400).json({
        error: "Primary API key is required",
        message: "Please provide a primary API key or configure METALS_API_PRIMARY_KEY environment variable"
      })
    }

    const apiClient = new SpotPriceApiClient(
      { logger: req.scope.resolve("logger") }, 
      apiOptions
    )

    // Test API connectivity
    const connectivity = await apiClient.testConnectivity()

    // Prepare detailed response
    const response = {
      primary: connectivity.primary,
      backup: connectivity.backup,
      errors: connectivity.errors,
      timestamp: new Date().toISOString(),
      configuration: {
        primary_url: apiOptions.primaryApiUrl,
        backup_url: apiOptions.backupApiUrl || null,
        primary_key_provided: !!apiOptions.primaryApiKey,
        backup_key_provided: !!apiOptions.backupApiKey,
        timeout: apiOptions.requestTimeout,
      },
      recommendations: generateRecommendations(connectivity)
    }

    // Set status based on connectivity results
    let status = 200
    if (!connectivity.primary && !connectivity.backup) {
      status = 503 // Service Unavailable
    } else if (!connectivity.primary) {
      status = 206 // Partial Content
    }

    res.status(status).json(response)

  } catch (error) {
    res.status(500).json({
      error: "Connectivity test failed",
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      primary: false,
      backup: false,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
      timestamp: new Date().toISOString(),
    })
  }
}

// Generate recommendations based on connectivity results
function generateRecommendations(connectivity: { primary: boolean; backup: boolean; errors: string[] }): string[] {
  const recommendations: string[] = []

  if (!connectivity.primary && !connectivity.backup) {
    recommendations.push("Both APIs are unreachable. Check your internet connection and API credentials.")
    recommendations.push("Verify that your API keys are valid and not expired.")
    recommendations.push("Consider setting up alternative data sources or manual price entry.")
  } else if (!connectivity.primary && connectivity.backup) {
    recommendations.push("Primary API is failing but backup is working. Consider switching to backup as primary.")
    recommendations.push("Check primary API credentials and service status.")
  } else if (connectivity.primary && !connectivity.backup) {
    recommendations.push("Primary API is working. Backup API connectivity failed - this may impact redundancy.")
    if (connectivity.errors.some(e => e.includes('Backup API'))) {
      recommendations.push("Consider configuring a working backup API for better resilience.")
    }
  } else {
    recommendations.push("All APIs are working correctly. Your spot price import should function normally.")
    recommendations.push("Consider setting up automated scheduled imports for real-time price updates.")
  }

  // Add specific error-based recommendations
  if (connectivity.errors.some(e => e.toLowerCase().includes('timeout'))) {
    recommendations.push("Some requests are timing out. Consider increasing the timeout value.")
  }

  if (connectivity.errors.some(e => e.toLowerCase().includes('unauthorized') || e.includes('401'))) {
    recommendations.push("Authentication failed. Please verify your API keys are correct and active.")
  }

  if (connectivity.errors.some(e => e.toLowerCase().includes('rate limit') || e.includes('429'))) {
    recommendations.push("Rate limit exceeded. Consider upgrading your API plan or implementing request delays.")
  }

  return recommendations
}
