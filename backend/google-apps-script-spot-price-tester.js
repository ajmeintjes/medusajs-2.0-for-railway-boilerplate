/**
 * Google Apps Script for Testing MedusaJS Spot Price API
 * 
 * This script provides comprehensive testing functionality for your MedusaJS backend spot price API.
 * It can test multiple endpoints including GET, POST, import, and bulk import operations.
 * 
 * SETUP INSTRUCTIONS:
 * 1. Update the BASE_URL constant with your deployed backend URL
 * 2. Update the API_KEY constant with your admin API key
 * 3. Create a Google Sheet with the following structure:
 *    - Sheet "Settings": Metal data in rows 8-12 (columns A-D: Metal, Currency, Price, % Change)
 *    - Sheet "Test Results": For logging API test results
 *    - Sheet "Config": For API configuration and URLs
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

// Update these constants with your actual backend details
const BASE_URL = "https://your-medusa-backend-url.com"; // e.g., "https://your-app.railway.app"
const API_KEY = "your_admin_api_key_here"; // Your MedusaJS admin API key
const ADMIN_EMAIL = "admin@yourdomain.com"; // Admin email for authentication
const ADMIN_PASSWORD = "your_admin_password"; // Admin password

// API Endpoints
const ENDPOINTS = {
  // Public store endpoint (no auth required)
  STORE_SPOT_PRICES: `${BASE_URL}/store/spot-prices`,
  
  // Admin endpoints (require authentication)
  ADMIN_SPOT_PRICES: `${BASE_URL}/admin/spot-prices`,
  ADMIN_CREATE_SPOT_PRICE: `${BASE_URL}/admin/spot-prices`,
  ADMIN_IMPORT_SPOT_PRICES: `${BASE_URL}/admin/spot-prices/import`,
  ADMIN_BULK_IMPORT: `${BASE_URL}/admin/spot-prices/bulk-import`,
  
  // Authentication
  AUTH_LOGIN: `${BASE_URL}/admin/auth`,
  
  // Test connectivity
  TEST_CONNECTIVITY: `${BASE_URL}/admin/spot-prices/api/test-connectivity`
};

// Sheet names
const SHEETS = {
  SETTINGS: "Settings",
  TEST_RESULTS: "Test Results", 
  CONFIG: "Config"
};

// ============================================================================
// AUTHENTICATION UTILITIES
// ============================================================================

/**
 * Authenticates with the MedusaJS backend and returns the session token
 * @return {string|null} Session token or null if authentication failed
 */
function authenticateAdmin() {
  try {
    const payload = {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    };
    
    const options = {
      method: "POST",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(ENDPOINTS.AUTH_LOGIN, options);
    const responseCode = response.getResponseCode();
    const responseData = JSON.parse(response.getContentText());
    
    if (responseCode === 200 && responseData.token) {
      Logger.log("✅ Authentication successful");
      return responseData.token;
    } else {
      Logger.log("❌ Authentication failed:", responseCode, responseData);
      return null;
    }
  } catch (error) {
    Logger.log("❌ Authentication error:", error.toString());
    return null;
  }
}

/**
 * Creates headers for authenticated requests
 * @param {string} token - Session token
 * @return {Object} Headers object
 */
function createAuthHeaders(token) {
  return {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json"
  };
}

// ============================================================================
// DATA UTILITIES
// ============================================================================

/**
 * Reads spot price data from the Settings sheet
 * @return {Array} Array of spot price objects
 */
function getSpotPriceDataFromSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.SETTINGS);
  const dataStartRow = 8;
  const dataEndRow = 12;
  const metalColumn = 1; // Column A
  const currencyColumn = 2; // Column B  
  const priceColumn = 3; // Column C
  const percentChangeColumn = 4; // Column D
  
  const payload = [];
  
  for (let row = dataStartRow; row <= dataEndRow; row++) {
    const metal = sheet.getRange(row, metalColumn).getValue();
    const currency = sheet.getRange(row, currencyColumn).getValue();
    const price = sheet.getRange(row, priceColumn).getValue();
    const percentChange = sheet.getRange(row, percentChangeColumn).getValue();
    
    if (metal && currency && price) {
      // Clean and parse price
      const cleanPrice = typeof price === 'string' ? 
        parseFloat(price.toString().replace(/[^0-9.]/g, '')) : price;
        
      const cleanPercentChange = typeof percentChange === 'string' ? 
        parseFloat(percentChange.toString().replace(/[^0-9.-]/g, '')) : percentChange;
      
      if (!isNaN(cleanPrice)) {
        // Convert metal names to symbols
        const metalSymbol = convertMetalNameToSymbol(metal);
        
        payload.push({
          metal_type: metalSymbol,
          symbol: metalSymbol,
          price_per_ounce: cleanPrice,
          currency: currency || "USD",
          change_percentage_24h: !isNaN(cleanPercentChange) ? cleanPercentChange : null,
          source: "Google Sheets"
        });
      }
    }
  }
  
  return payload;
}

/**
 * Converts metal names to standard symbols
 * @param {string} metalName - Metal name from sheet
 * @return {string} Metal symbol (XAU, XAG, XPT)
 */
function convertMetalNameToSymbol(metalName) {
  const metal = metalName.toString().toUpperCase();
  if (metal.includes("GOLD") || metal.includes("XAU")) return "XAU";
  if (metal.includes("SILVER") || metal.includes("XAG")) return "XAG";  
  if (metal.includes("PLATINUM") || metal.includes("XPT")) return "XPT";
  return metal; // Return as-is if already a symbol
}

/**
 * Logs test results to the Test Results sheet
 * @param {string} testName - Name of the test
 * @param {boolean} success - Whether the test succeeded
 * @param {Object} response - API response
 * @param {string} error - Error message if any
 */
function logTestResult(testName, success, response = null, error = null) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.TEST_RESULTS) ||
                  SpreadsheetApp.getActiveSpreadsheet().insertSheet(SHEETS.TEST_RESULTS);
    
    // Add headers if this is the first entry
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["Timestamp", "Test Name", "Status", "Response", "Error", "Details"]);
    }
    
    const timestamp = new Date();
    const status = success ? "✅ PASS" : "❌ FAIL";
    const responseText = response ? JSON.stringify(response).substring(0, 500) : "";
    const errorText = error || "";
    
    sheet.appendRow([timestamp, testName, status, responseText, errorText, ""]);
    
    // Auto-resize columns
    sheet.autoResizeColumns(1, 6);
    
  } catch (e) {
    Logger.log("Failed to log test result:", e.toString());
  }
}

// ============================================================================
// API TEST FUNCTIONS
// ============================================================================

/**
 * Tests the public store spot prices endpoint
 * @return {boolean} Success status
 */
function testStoreSpotPricesEndpoint() {
  try {
    Logger.log("🧪 Testing Store Spot Prices Endpoint...");
    
    const options = {
      method: "GET",
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(ENDPOINTS.STORE_SPOT_PRICES, options);
    const responseCode = response.getResponseCode();
    const responseData = JSON.parse(response.getContentText());
    
    const success = responseCode === 200 && responseData.ticker_data;
    
    if (success) {
      Logger.log("✅ Store endpoint test passed");
      Logger.log("Ticker data count:", responseData.ticker_data.length);
      logTestResult("Store Spot Prices GET", true, responseData);
    } else {
      Logger.log("❌ Store endpoint test failed:", responseCode, responseData);
      logTestResult("Store Spot Prices GET", false, responseData);
    }
    
    return success;
  } catch (error) {
    Logger.log("❌ Store endpoint test error:", error.toString());
    logTestResult("Store Spot Prices GET", false, null, error.toString());
    return false;
  }
}

/**
 * Tests the admin spot prices GET endpoint
 * @param {string} token - Authentication token
 * @return {boolean} Success status
 */
function testAdminSpotPricesGet(token) {
  try {
    Logger.log("🧪 Testing Admin Spot Prices GET Endpoint...");
    
    const options = {
      method: "GET",
      headers: createAuthHeaders(token),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(ENDPOINTS.ADMIN_SPOT_PRICES, options);
    const responseCode = response.getResponseCode();
    const responseData = JSON.parse(response.getContentText());
    
    const success = responseCode === 200 && responseData.current_prices;
    
    if (success) {
      Logger.log("✅ Admin GET endpoint test passed");
      Logger.log("Current prices:", Object.keys(responseData.current_prices).length);
      logTestResult("Admin Spot Prices GET", true, responseData);
    } else {
      Logger.log("❌ Admin GET endpoint test failed:", responseCode, responseData);
      logTestResult("Admin Spot Prices GET", false, responseData);
    }
    
    return success;
  } catch (error) {
    Logger.log("❌ Admin GET endpoint test error:", error.toString());
    logTestResult("Admin Spot Prices GET", false, null, error.toString());
    return false;
  }
}

/**
 * Tests creating a single spot price via POST
 * @param {string} token - Authentication token
 * @return {boolean} Success status
 */
function testCreateSpotPrice(token) {
  try {
    Logger.log("🧪 Testing Create Spot Price POST Endpoint...");
    
    // Get sample data from sheet
    const spotPriceData = getSpotPriceDataFromSheet();
    if (spotPriceData.length === 0) {
      Logger.log("❌ No spot price data found in sheet");
      logTestResult("Create Spot Price POST", false, null, "No data in sheet");
      return false;
    }
    
    // Use first item for testing
    const testData = {
      metal_type: spotPriceData[0].metal_type,
      price_per_ounce: spotPriceData[0].price_per_ounce,
      currency: spotPriceData[0].currency,
      bid_price: spotPriceData[0].price_per_ounce * 0.995, // Simulate bid slightly lower
      ask_price: spotPriceData[0].price_per_ounce * 1.005  // Simulate ask slightly higher
    };
    
    const options = {
      method: "POST",
      headers: createAuthHeaders(token),
      payload: JSON.stringify(testData),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(ENDPOINTS.ADMIN_CREATE_SPOT_PRICE, options);
    const responseCode = response.getResponseCode();
    const responseData = JSON.parse(response.getContentText());
    
    const success = responseCode === 201 && responseData.spot_price;
    
    if (success) {
      Logger.log("✅ Create spot price test passed");
      Logger.log("Created spot price ID:", responseData.spot_price.id);
      logTestResult("Create Spot Price POST", true, responseData);
    } else {
      Logger.log("❌ Create spot price test failed:", responseCode, responseData);
      logTestResult("Create Spot Price POST", false, responseData);
    }
    
    return success;
  } catch (error) {
    Logger.log("❌ Create spot price test error:", error.toString());
    logTestResult("Create Spot Price POST", false, null, error.toString());
    return false;
  }
}

/**
 * Tests the import spot prices endpoint
 * @param {string} token - Authentication token
 * @return {boolean} Success status
 */
function testImportSpotPrices(token) {
  try {
    Logger.log("🧪 Testing Import Spot Prices Endpoint...");
    
    const importData = {
      source: "manual",
      metals: ["XAU", "XAG", "XPT"],
      requestTimeout: 5000
    };
    
    const options = {
      method: "POST",
      headers: createAuthHeaders(token),
      payload: JSON.stringify(importData),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(ENDPOINTS.ADMIN_IMPORT_SPOT_PRICES, options);
    const responseCode = response.getResponseCode();
    const responseData = JSON.parse(response.getContentText());
    
    const success = responseCode === 200 && responseData.results;
    
    if (success) {
      Logger.log("✅ Import spot prices test passed");
      Logger.log("Import summary:", responseData.summary);
      logTestResult("Import Spot Prices POST", true, responseData);
    } else {
      Logger.log("❌ Import spot prices test failed:", responseCode, responseData);
      logTestResult("Import Spot Prices POST", false, responseData);
    }
    
    return success;
  } catch (error) {
    Logger.log("❌ Import spot prices test error:", error.toString());
    logTestResult("Import Spot Prices POST", false, null, error.toString());
    return false;
  }
}

/**
 * Tests the bulk import spot prices endpoint
 * @param {string} token - Authentication token
 * @return {boolean} Success status
 */
function testBulkImportSpotPrices(token) {
  try {
    Logger.log("🧪 Testing Bulk Import Spot Prices Endpoint...");
    
    const bulkImportData = {
      sources: ["primary", "backup"],
      metals: ["XAU", "XAG", "XPT"]
    };
    
    const options = {
      method: "POST",
      headers: createAuthHeaders(token),
      payload: JSON.stringify(bulkImportData),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(ENDPOINTS.ADMIN_BULK_IMPORT, options);
    const responseCode = response.getResponseCode();
    const responseData = JSON.parse(response.getContentText());
    
    const success = responseCode === 200 && responseData.results;
    
    if (success) {
      Logger.log("✅ Bulk import spot prices test passed");
      Logger.log("Bulk import summary:", responseData.summary);
      logTestResult("Bulk Import Spot Prices POST", true, responseData);
    } else {
      Logger.log("❌ Bulk import spot prices test failed:", responseCode, responseData);
      logTestResult("Bulk Import Spot Prices POST", false, responseData);
    }
    
    return success;
  } catch (error) {
    Logger.log("❌ Bulk import spot prices test error:", error.toString());
    logTestResult("Bulk Import Spot Prices POST", false, null, error.toString());
    return false;
  }
}

/**
 * Tests the connectivity test endpoint
 * @param {string} token - Authentication token
 * @return {boolean} Success status
 */
function testConnectivity(token) {
  try {
    Logger.log("🧪 Testing API Connectivity Endpoint...");
    
    const options = {
      method: "POST",
      headers: createAuthHeaders(token),
      payload: JSON.stringify({}),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(ENDPOINTS.TEST_CONNECTIVITY, options);
    const responseCode = response.getResponseCode();
    const responseData = JSON.parse(response.getContentText());
    
    const success = responseCode === 200;
    
    if (success) {
      Logger.log("✅ Connectivity test passed");
      Logger.log("Connectivity result:", responseData);
      logTestResult("API Connectivity Test", true, responseData);
    } else {
      Logger.log("❌ Connectivity test failed:", responseCode, responseData);
      logTestResult("API Connectivity Test", false, responseData);
    }
    
    return success;
  } catch (error) {
    Logger.log("❌ Connectivity test error:", error.toString());
    logTestResult("API Connectivity Test", false, null, error.toString());
    return false;
  }
}

// ============================================================================
// MAIN TEST FUNCTIONS
// ============================================================================

/**
 * Runs all API tests
 * This is the main function to execute for comprehensive testing
 */
function runAllApiTests() {
  Logger.log("🚀 Starting comprehensive API tests for MedusaJS Spot Price backend...");
  
  // Clear previous results
  const resultsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.TEST_RESULTS);
  if (resultsSheet) {
    resultsSheet.clear();
  }
  
  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    tests: []
  };
  
  // Test 1: Public store endpoint (no auth required)
  Logger.log("\n📍 Phase 1: Testing public endpoints...");
  const storeTest = testStoreSpotPricesEndpoint();
  results.tests.push({name: "Store Spot Prices GET", passed: storeTest});
  results.total++;
  if (storeTest) results.passed++; else results.failed++;
  
  // Test 2-6: Admin endpoints (auth required)
  Logger.log("\n📍 Phase 2: Testing admin endpoints...");
  const token = authenticateAdmin();
  
  if (token) {
    Logger.log("✅ Authentication successful, running admin tests...");
    
    // Admin GET test
    const adminGetTest = testAdminSpotPricesGet(token);
    results.tests.push({name: "Admin Spot Prices GET", passed: adminGetTest});
    results.total++;
    if (adminGetTest) results.passed++; else results.failed++;
    
    // Create spot price test
    const createTest = testCreateSpotPrice(token);
    results.tests.push({name: "Create Spot Price POST", passed: createTest});
    results.total++;
    if (createTest) results.passed++; else results.failed++;
    
    // Import test
    const importTest = testImportSpotPrices(token);
    results.tests.push({name: "Import Spot Prices POST", passed: importTest});
    results.total++;
    if (importTest) results.passed++; else results.failed++;
    
    // Bulk import test
    const bulkImportTest = testBulkImportSpotPrices(token);
    results.tests.push({name: "Bulk Import Spot Prices POST", passed: bulkImportTest});
    results.total++;
    if (bulkImportTest) results.passed++; else results.failed++;
    
    // Connectivity test
    const connectivityTest = testConnectivity(token);
    results.tests.push({name: "API Connectivity Test", passed: connectivityTest});
    results.total++;
    if (connectivityTest) results.passed++; else results.failed++;
    
  } else {
    Logger.log("❌ Authentication failed, skipping admin tests");
    logTestResult("Authentication", false, null, "Failed to authenticate admin user");
  }
  
  // Summary
  Logger.log("\n📊 TEST RESULTS SUMMARY");
  Logger.log("=======================");
  Logger.log(`Total tests: ${results.total}`);
  Logger.log(`Passed: ${results.passed}`);
  Logger.log(`Failed: ${results.failed}`);
  Logger.log(`Success rate: ${((results.passed / results.total) * 100).toFixed(1)}%`);
  
  Logger.log("\n📋 Test Details:");
  results.tests.forEach(test => {
    const status = test.passed ? "✅" : "❌";
    Logger.log(`${status} ${test.name}`);
  });
  
  // Update sheet with summary
  const settingsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.SETTINGS);
  if (settingsSheet) {
    settingsSheet.getRange("G6").setValue(`Tests: ${results.passed}/${results.total} passed - ${new Date().toLocaleString()}`);
  }
  
  Logger.log("\n🏁 Testing complete! Check the 'Test Results' sheet for detailed logs.");
}

/**
 * Quick test function - just tests the store endpoint
 */
function quickApiTest() {
  Logger.log("🚀 Running quick API test...");
  
  const success = testStoreSpotPricesEndpoint();
  
  const settingsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.SETTINGS);
  if (settingsSheet) {
    const status = success ? "✅ Quick test passed" : "❌ Quick test failed";
    settingsSheet.getRange("G6").setValue(`${status} - ${new Date().toLocaleString()}`);
  }
  
  Logger.log(success ? "✅ Quick test completed successfully" : "❌ Quick test failed");
}

/**
 * Send spot price data from sheet to your backend API (similar to your original function)
 * This replaces your original Supabase function with calls to your MedusaJS backend
 */
function sendSpotPriceDataToMedusaAPI() {
  Logger.log("🚀 Sending spot price data to MedusaJS backend...");
  
  // Get authentication token
  const token = authenticateAdmin();
  if (!token) {
    Logger.log("❌ Failed to authenticate - cannot send data");
    const settingsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.SETTINGS);
    if (settingsSheet) {
      settingsSheet.getRange("G6").setValue("Auth failed - " + new Date().toLocaleString());
    }
    return;
  }
  
  // Get data from sheet
  const spotPriceData = getSpotPriceDataFromSheet();
  if (spotPriceData.length === 0) {
    Logger.log("❌ No valid data to send");
    return;
  }
  
  Logger.log(`📊 Found ${spotPriceData.length} spot prices to send`);
  
  const results = [];
  let successCount = 0;
  let failureCount = 0;
  
  // Send each spot price individually
  for (const priceData of spotPriceData) {
    try {
      const options = {
        method: "POST",
        headers: createAuthHeaders(token),
        payload: JSON.stringify(priceData),
        muteHttpExceptions: true
      };
      
      const response = UrlFetchApp.fetch(ENDPOINTS.ADMIN_CREATE_SPOT_PRICE, options);
      const responseCode = response.getResponseCode();
      const responseData = JSON.parse(response.getContentText());
      
      if (responseCode === 201) {
        Logger.log(`✅ Successfully sent ${priceData.metal_type}: $${priceData.price_per_ounce}`);
        successCount++;
        results.push({
          metal: priceData.metal_type,
          success: true,
          price: priceData.price_per_ounce,
          id: responseData.spot_price?.id
        });
      } else {
        Logger.log(`❌ Failed to send ${priceData.metal_type}: ${responseCode} ${responseData.message || ''}`);
        failureCount++;
        results.push({
          metal: priceData.metal_type,
          success: false,
          error: responseData.message || `HTTP ${responseCode}`
        });
      }
      
      // Small delay between requests
      Utilities.sleep(500);
      
    } catch (error) {
      Logger.log(`❌ Exception sending ${priceData.metal_type}: ${error.toString()}`);
      failureCount++;
      results.push({
        metal: priceData.metal_type,
        success: false,
        error: error.toString()
      });
    }
  }
  
  // Update status in sheet
  const settingsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.SETTINGS);
  if (settingsSheet) {
    const statusMessage = successCount > 0 ? 
      `✅ Sent ${successCount}/${spotPriceData.length} prices - ${new Date().toLocaleString()}` :
      `❌ Failed to send data - ${new Date().toLocaleString()}`;
    settingsSheet.getRange("G6").setValue(statusMessage);
    
    // Store detailed results in G8
    settingsSheet.getRange("G8").setValue(JSON.stringify(results));
  }
  
  // Log summary
  Logger.log(`\n📊 DATA SEND SUMMARY:`);
  Logger.log(`Total prices: ${spotPriceData.length}`);
  Logger.log(`Successful: ${successCount}`);
  Logger.log(`Failed: ${failureCount}`);
  
  logTestResult("Send Spot Price Data", successCount > 0, results);
  
  Logger.log("🏁 Data send operation complete!");
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Sets up the Google Sheet with proper structure for testing
 */
function setupTestSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Create Config sheet if it doesn't exist
  let configSheet = ss.getSheetByName(SHEETS.CONFIG);
  if (!configSheet) {
    configSheet = ss.insertSheet(SHEETS.CONFIG);
    
    // Add configuration headers and sample data
    configSheet.getRange("A1").setValue("Configuration");
    configSheet.getRange("A3").setValue("Backend URL:");
    configSheet.getRange("B3").setValue(BASE_URL);
    configSheet.getRange("A4").setValue("API Key:");
    configSheet.getRange("B4").setValue(API_KEY);
    configSheet.getRange("A5").setValue("Admin Email:");
    configSheet.getRange("B5").setValue(ADMIN_EMAIL);
    
    // Add instructions
    configSheet.getRange("A7").setValue("Instructions:");
    configSheet.getRange("A8").setValue("1. Update the configuration values above");
    configSheet.getRange("A9").setValue("2. Run 'runAllApiTests()' for comprehensive testing");
    configSheet.getRange("A10").setValue("3. Run 'quickApiTest()' for a quick store endpoint test");
    configSheet.getRange("A11").setValue("4. Run 'sendSpotPriceDataToMedusaAPI()' to send data from Settings sheet");
  }
  
  // Create Test Results sheet if it doesn't exist
  let testResultsSheet = ss.getSheetByName(SHEETS.TEST_RESULTS);
  if (!testResultsSheet) {
    testResultsSheet = ss.insertSheet(SHEETS.TEST_RESULTS);
  }
  
  Logger.log("✅ Test sheet setup complete!");
}

/**
 * Validation function to check if the configuration is properly set up
 */
function validateConfiguration() {
  const issues = [];
  
  if (BASE_URL === "https://your-medusa-backend-url.com") {
    issues.push("BASE_URL needs to be updated with your actual backend URL");
  }
  
  if (API_KEY === "your_admin_api_key_here") {
    issues.push("API_KEY needs to be updated with your actual admin API key");
  }
  
  if (ADMIN_EMAIL === "admin@yourdomain.com") {
    issues.push("ADMIN_EMAIL needs to be updated with your actual admin email");
  }
  
  if (ADMIN_PASSWORD === "your_admin_password") {
    issues.push("ADMIN_PASSWORD needs to be updated with your actual admin password");
  }
  
  if (issues.length > 0) {
    Logger.log("❌ Configuration Issues Found:");
    issues.forEach(issue => Logger.log(`   - ${issue}`));
    return false;
  }
  
  Logger.log("✅ Configuration validation passed");
  return true;
}

// ============================================================================
// TRIGGER FUNCTIONS (Optional - for scheduled testing)
// ============================================================================

/**
 * Creates a time-based trigger to run tests periodically
 * Uncomment and run this function to set up automated testing
 */
/*
function createPeriodicTestTrigger() {
  // Delete existing triggers
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === 'quickApiTest') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // Create new trigger - runs every hour
  ScriptApp.newTrigger('quickApiTest')
    .timeBased()
    .everyHours(1)
    .create();
    
  Logger.log("✅ Periodic test trigger created (runs every hour)");
}
*/
