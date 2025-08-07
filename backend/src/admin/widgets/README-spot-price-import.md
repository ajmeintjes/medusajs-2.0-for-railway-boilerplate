# Spot Price Import Widget

The **Spot Price Import Widget** provides a comprehensive interface for importing precious metal spot prices from external APIs into your Medusa backend. This widget is designed to work with the existing spot price system and offers both manual and automated import capabilities.

## Features

- **Multi-Source Import**: Support for primary and backup API sources
- **Real-time API Testing**: Test connectivity to external APIs before importing
- **Bulk Import**: Import all metals from multiple sources with fallback logic
- **Manual Configuration**: Override API settings for custom sources
- **Import History**: View detailed results of import operations
- **Current Price Display**: Real-time view of currently stored spot prices

## Location

The widget appears on the **Product List** page (`product.list.before` zone) for easy access during product management workflows.

## Usage

### 1. Quick Import (Recommended)

Use the **"Bulk Import"** button in the header for the fastest way to update all spot prices:

- Automatically tries multiple sources in order of preference
- Imports all metals (Gold, Silver, Platinum) by default
- Uses environment-configured API credentials
- Provides detailed success/failure reporting

### 2. Manual Import Configuration

For custom API sources or testing:

1. Select **"Manual Configuration"** from the Import Source dropdown
2. Enter your API credentials:
   - **Primary API Key**: Your metals-api.com API key (or similar)
   - **Primary API URL**: API endpoint (defaults to `https://api.metals-api.com/v1`)
   - **Backup API Key/URL**: Optional backup source
3. Choose which metals to import (XAU, XAG, XPT)
4. Click **"Import Prices"**

### 3. API Connectivity Testing

Before running imports, test your API connections:

1. Configure your API settings (if using manual configuration)
2. Click **"Test Connection"**
3. Review the connectivity status for primary and backup APIs
4. Follow any recommendations provided

## API Endpoints

The widget interacts with the following backend endpoints:

- `POST /admin/spot-prices/import` - Import from specific source
- `POST /admin/spot-prices/bulk-import` - Multi-source bulk import  
- `POST /admin/spot-prices/api/test-connectivity` - Test API connectivity
- `GET /admin/spot-prices` - Fetch current prices

## Environment Variables

Configure these environment variables for automatic API integration:

```bash
# Primary API (required)
METALS_API_PRIMARY_KEY=your_primary_api_key
METALS_API_PRIMARY_URL=https://api.metals-api.com/v1

# Backup API (optional)
METALS_API_BACKUP_KEY=your_backup_api_key  
METALS_API_BACKUP_URL=https://backup-api.example.com

# Configuration
METALS_API_TIMEOUT=10000
METALS_API_MAX_RETRIES=3
```

## Widget Sections

### Header
- **Import Controls**: Quick access to bulk import and connectivity testing
- **Status Indicators**: Real-time import status and loading states

### Current Prices Summary
- **Live Price Display**: Shows current spot prices for all metals
- **Source Badges**: Indicates the source of each price (API primary, backup, manual)
- **24h Change**: Price movement indicators where available
- **Last Import Timestamp**: When prices were last updated

### Import Configuration
- **Source Selection**: Choose between Primary API, Backup API, or Manual Configuration  
- **Metal Selection**: Choose which metals to import (checkboxes for XAU, XAG, XPT)
- **Manual API Settings**: Full API configuration when using manual mode

### Import Results Table
- **Detailed Results**: Success/failure status for each metal
- **Error Messages**: Specific error details for failed imports
- **Price Data**: Successfully imported prices with timestamps
- **Source Tracking**: Which API source provided each price

## Best Practices

### 1. Regular Updates
- Set up scheduled imports for real-time pricing
- Use bulk import for efficiency when updating multiple metals
- Monitor import results for API reliability

### 2. Redundancy
- Configure backup API sources for reliability
- Test connectivity regularly to ensure service availability
- Keep manual import capability as a fallback

### 3. Error Handling
- Review failed imports and investigate error messages
- Check API key validity and service status
- Consider rate limiting for high-frequency imports

### 4. Data Validation
- Monitor imported prices for unusual values
- Compare prices across different sources when available
- Set up alerts for significant price movements

## Troubleshooting

### Common Issues

**"Primary API key is required"**
- Solution: Configure `METALS_API_PRIMARY_KEY` environment variable or use manual configuration

**"No price data received from API"**  
- Check API key validity and permissions
- Verify API service status
- Test connectivity using the "Test Connection" button

**"Import failed with timeout"**
- Increase timeout value in manual configuration
- Check network connectivity
- Try backup API source

**"Rate limit exceeded"**
- Reduce import frequency
- Upgrade API plan if available
- Implement delays between requests

### Connectivity Issues
1. Use "Test Connection" to diagnose API problems
2. Check the recommendations provided after testing
3. Verify firewall and network settings allow outbound API calls
4. Confirm API endpoints are accessible from your server

## Integration

The widget integrates seamlessly with:
- **Spot Price Management System**: Uses existing models and services
- **Product Pricing**: Automatically updates product prices based on new spot prices
- **API Key Management**: Leverages existing API authentication system
- **Admin Dashboard**: Follows Medusa Admin design patterns

## Customization

### Changing Widget Location
Modify the `zone` in the widget configuration:

```typescript
export const config = defineWidgetConfig({
  zone: "product.list.before", // Change this to your preferred location
})
```

Available zones include:
- `product.list.before` - Before product list
- `order.details.before` - Before order details  
- `customer.details.before` - Before customer details
- And many more (see Medusa documentation)

### Adding Custom Metals
1. Update the metal selection checkboxes in the widget
2. Add corresponding enum values in the backend models
3. Update API client to handle additional metal types

### Custom API Sources
1. Extend the `SpotPriceApiClient` service  
2. Add new source types to the import endpoints
3. Update widget to support additional configuration options

## Support

For issues or questions:
1. Check server logs for detailed error messages
2. Review API provider documentation and status pages
3. Test with smaller imports to isolate problems
4. Verify environment configuration and credentials
