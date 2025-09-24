#!/usr/bin/env node

/**
 * Enhanced Authentication Test
 * Tests the new debugging endpoints
 */

const BACKEND_URL = 'https://steelix-final-production.up.railway.app';

console.log('🧪 ENHANCED AUTHENTICATION TEST');
console.log('================================');
console.log(`Backend: ${BACKEND_URL}`);
console.log('');

// Test 1: Enhanced Auth Config
async function testEnhancedAuthConfig() {
  console.log('1️⃣ Testing Enhanced Auth Configuration...');
  try {
    const response = await fetch(`${BACKEND_URL}/debug/auth-config`);
    const data = await response.json();
    console.log(`   ✅ Status: ${response.status}`);
    console.log(`   🔐 Better Auth URL: ${data.betterAuthUrl}`);
    console.log(`   🌐 CORS Origins: ${data.corsOrigins}`);
    console.log(`   🔑 Has Secret: ${data.hasSecret}`);
    console.log(`   🗄️  Has Database: ${data.hasDatabaseUrl}`);
    console.log(`   🌍 Environment: ${data.nodeEnv}`);
    console.log(`   🚀 Auth Initialized: ${data.authInitialized}`);
    console.log(`   🔧 Auth Handler Exists: ${data.authHandlerExists}`);
    
    if (!data.authInitialized) {
      console.log(`   ❌ CRITICAL: Better Auth not initialized!`);
    }
    if (!data.authHandlerExists) {
      console.log(`   ❌ CRITICAL: Auth handler function missing!`);
    }
  } catch (error) {
    console.log(`   ❌ Enhanced Auth Config Failed: ${error.message}`);
  }
  console.log('');
}

// Test 2: Direct Auth Session Test
async function testDirectAuthSession() {
  console.log('2️⃣ Testing Direct Auth Session...');
  try {
    const response = await fetch(`${BACKEND_URL}/debug/auth-session`);
    const data = await response.json();
    console.log(`   📡 Status: ${response.status}`);
    console.log(`   📊 Response:`, data);
  } catch (error) {
    console.log(`   ❌ Direct Auth Session Failed: ${error.message}`);
  }
  console.log('');
}

// Test 3: Manual Auth Session Test
async function testManualAuthSession() {
  console.log('3️⃣ Testing Manual Auth Session...');
  try {
    const response = await fetch(`${BACKEND_URL}/debug/test-auth-session`);
    const data = await response.json();
    console.log(`   📡 Status: ${response.status}`);
    console.log(`   🔗 Session URL: ${data.sessionUrl}`);
    console.log(`   📊 Session Status: ${data.status}`);
    console.log(`   📄 Session Body: ${data.body}`);
    
    if (data.status === 404) {
      console.log(`   ⚠️  WARNING: Auth session endpoint still returning 404`);
    }
  } catch (error) {
    console.log(`   ❌ Manual Auth Session Failed: ${error.message}`);
  }
  console.log('');
}

// Test 4: Test Auth Session Endpoint Directly
async function testAuthSessionDirect() {
  console.log('4️⃣ Testing Auth Session Endpoint Directly...');
  try {
    const response = await fetch(`${BACKEND_URL}/api/auth/session`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://steelix-final-web.vercel.app'
      }
    });
    
    console.log(`   📡 Status: ${response.status}`);
    console.log(`   🍪 Headers:`, Object.fromEntries(response.headers.entries()));
    
    if (response.status === 200) {
      const data = await response.json();
      console.log(`   📊 Data:`, data);
    } else {
      const text = await response.text();
      console.log(`   📄 Response:`, text);
    }
  } catch (error) {
    console.log(`   ❌ Direct Auth Session Failed: ${error.message}`);
  }
  console.log('');
}

// Main test function
async function runTests() {
  await testEnhancedAuthConfig();
  await testDirectAuthSession();
  await testManualAuthSession();
  await testAuthSessionDirect();
  
  console.log('🎯 TEST SUMMARY');
  console.log('===============');
  console.log('Check the results above for:');
  console.log('1. Auth initialization status');
  console.log('2. Handler function availability');
  console.log('3. Session endpoint accessibility');
  console.log('4. Error details and debugging info');
}

// Run tests
runTests().catch(console.error);
