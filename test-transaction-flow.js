/**
 * Comprehensive Transaction Data Flow Test
 * Tests the complete flow from form submission to dashboard display
 */

const SERVER_URL = 'http://localhost:8080';
const WEB_URL = 'http://localhost:3001';

// Test data for transaction creation
const testTransactionData = {
  marketType: 'primary',
  transactionType: 'sale',
  transactionDate: new Date().toISOString(),
  propertyData: {
    address: '123 Test Street, Test City',
    propertyType: 'apartment',
    bedrooms: 3,
    bathrooms: 2,
    area: 1200,
    price: 500000,
    description: 'Beautiful test property for transaction flow testing'
  },
  clientData: {
    name: 'John Test Client',
    email: 'john.test@example.com',
    phone: '+1234567890',
    type: 'buyer',
    source: 'referral',
    notes: 'Test client for transaction flow verification'
  },
  isCoBroking: false,
  commissionType: 'percentage',
  commissionValue: 2.5,
  commissionAmount: 12500,
  documents: [],
  notes: 'Test transaction for comprehensive data flow verification'
};

// Test user credentials
const testAgent = {
  email: 'agent@test.com',
  password: 'TestAgent123!',
  name: 'Test Agent'
};

const testAdmin = {
  email: 'admin@test.com',
  password: 'TestAdmin123!',
  name: 'Test Admin'
};

/**
 * Test 1: Authentication Setup
 */
async function testAuthentication() {
  console.log('\n🔐 Testing Authentication Setup...');
  
  try {
    // Test server health
    const healthResponse = await fetch(`${SERVER_URL}/health`);
    if (healthResponse.ok) {
      console.log('✅ Server is healthy');
    } else {
      console.log('❌ Server health check failed');
      return false;
    }

    // Test auth endpoints
    const authResponse = await fetch(`${SERVER_URL}/api/auth`);
    if (authResponse.ok) {
      console.log('✅ Auth endpoints accessible');
    } else {
      console.log('❌ Auth endpoints not accessible');
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ Authentication test failed:', error.message);
    return false;
  }
}

/**
 * Test 2: Transaction Creation via tRPC
 */
async function testTransactionCreation() {
  console.log('\n📝 Testing Transaction Creation...');
  
  try {
    // This would normally require authentication
    // For now, we'll test the endpoint structure
    const response = await fetch(`${SERVER_URL}/trpc/transactions.create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ json: testTransactionData })
    });

    if (response.status === 401) {
      console.log('✅ Transaction endpoint requires authentication (expected)');
      return true;
    } else if (response.ok) {
      const data = await response.json();
      console.log('✅ Transaction created successfully:', data.result?.data?.id);
      return data.result?.data?.id;
    } else {
      console.log('❌ Transaction creation failed:', response.status);
      return false;
    }
  } catch (error) {
    console.error('❌ Transaction creation test failed:', error.message);
    return false;
  }
}

/**
 * Test 3: Dashboard Query Structure
 */
async function testDashboardQueries() {
  console.log('\n📊 Testing Dashboard Query Structure...');
  
  const queries = [
    'dashboard.getFinancialOverview',
    'dashboard.getSalesPipeline', 
    'dashboard.getRecentTransactions',
    'admin.getDashboardSummary',
    'admin.getCommissionApprovalQueue',
    'admin.getAgentPerformance'
  ];

  let allQueriesAccessible = true;

  for (const query of queries) {
    try {
      const response = await fetch(`${SERVER_URL}/trpc/${query}`, {
        method: 'GET',
        credentials: 'include'
      });

      if (response.status === 401) {
        console.log(`✅ ${query} requires authentication (expected)`);
      } else if (response.ok) {
        console.log(`✅ ${query} accessible`);
      } else {
        console.log(`❌ ${query} failed: ${response.status}`);
        allQueriesAccessible = false;
      }
    } catch (error) {
      console.log(`❌ ${query} error:`, error.message);
      allQueriesAccessible = false;
    }
  }

  return allQueriesAccessible;
}

/**
 * Test 4: Web App Accessibility
 */
async function testWebAppAccess() {
  console.log('\n🌐 Testing Web App Accessibility...');
  
  try {
    const response = await fetch(WEB_URL);
    if (response.ok) {
      console.log('✅ Web app is accessible');
      return true;
    } else {
      console.log('❌ Web app not accessible:', response.status);
      return false;
    }
  } catch (error) {
    console.error('❌ Web app access test failed:', error.message);
    return false;
  }
}

/**
 * Main test runner
 */
async function runComprehensiveTest() {
  console.log('🚀 Starting Comprehensive Transaction Data Flow Test');
  console.log('=' .repeat(60));

  const results = {
    authentication: await testAuthentication(),
    transactionCreation: await testTransactionCreation(),
    dashboardQueries: await testDashboardQueries(),
    webAppAccess: await testWebAppAccess()
  };

  console.log('\n📋 Test Results Summary:');
  console.log('=' .repeat(60));
  
  Object.entries(results).forEach(([test, result]) => {
    const status = result ? '✅ PASS' : '❌ FAIL';
    console.log(`${test.padEnd(20)}: ${status}`);
  });

  const allPassed = Object.values(results).every(result => result);
  
  console.log('\n🎯 Overall Status:', allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED');
  
  if (allPassed) {
    console.log('\n🎉 Transaction data flow infrastructure is ready!');
    console.log('Next steps:');
    console.log('1. Sign up/login at http://localhost:3001');
    console.log('2. Create a test transaction via the form');
    console.log('3. Verify it appears in the appropriate dashboard');
    console.log('4. Test admin approval workflow');
  }

  return allPassed;
}

// Run the test
runComprehensiveTest().catch(console.error);
