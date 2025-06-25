// Comprehensive Auth Debug Script
// Run this to test each component of the auth system

import fetch from 'node-fetch';

const SERVER_URL = 'https://steelix-final-production.up.railway.app';
const FRONTEND_URLS = [
  'https://steelix-final-web.vercel.app',
  'https://steelix-final-web-git-master-lkmariobros-projects.vercel.app',
  'https://steelix-final-mx4or73lk-lkmariobros-projects.vercel.app'
];

console.log('🔍 COMPREHENSIVE AUTH DEBUGGING\n');

// Test 1: Server Health
async function testServerHealth() {
  console.log('1️⃣ Testing Server Health...');
  try {
    const response = await fetch(`${SERVER_URL}/ping`);
    const text = await response.text();
    console.log(`   ✅ Server responds: ${text}`);
    return true;
  } catch (error) {
    console.log(`   ❌ Server unreachable: ${error.message}`);
    return false;
  }
}

// Test 2: Auth Endpoints Accessibility
async function testAuthEndpoints() {
  console.log('\n2️⃣ Testing Auth Endpoints...');
  
  const endpoints = [
    '/api/auth/sign-in',
    '/api/auth/sign-up', 
    '/api/auth/session'
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${SERVER_URL}${endpoint}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`   ${endpoint}: ${response.status} ${response.statusText}`);
      
      if (response.status === 405) {
        // Try POST for sign-in/sign-up
        const postResponse = await fetch(`${SERVER_URL}${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({})
        });
        console.log(`   ${endpoint} (POST): ${postResponse.status} ${postResponse.statusText}`);
      }
    } catch (error) {
      console.log(`   ❌ ${endpoint}: ${error.message}`);
    }
  }
}

// Test 3: CORS Headers
async function testCORS() {
  console.log('\n3️⃣ Testing CORS Headers...');
  
  for (const origin of FRONTEND_URLS) {
    try {
      const response = await fetch(`${SERVER_URL}/api/auth/session`, {
        method: 'OPTIONS',
        headers: {
          'Origin': origin,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type'
        }
      });
      
      const corsHeaders = {
        'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin'),
        'Access-Control-Allow-Credentials': response.headers.get('Access-Control-Allow-Credentials'),
        'Access-Control-Allow-Methods': response.headers.get('Access-Control-Allow-Methods')
      };
      
      console.log(`   Origin: ${origin}`);
      console.log(`   Status: ${response.status}`);
      console.log(`   CORS Headers:`, corsHeaders);
      console.log('');
    } catch (error) {
      console.log(`   ❌ CORS test failed for ${origin}: ${error.message}`);
    }
  }
}

// Test 4: Database Connection
async function testDatabase() {
  console.log('4️⃣ Testing Database Connection...');
  try {
    // This would require a custom endpoint, but we can infer from other tests
    console.log('   ℹ️  Database test requires custom endpoint - check server logs');
  } catch (error) {
    console.log(`   ❌ Database test failed: ${error.message}`);
  }
}

// Test 5: Environment Variables (from server response)
async function testEnvironmentVars() {
  console.log('\n5️⃣ Testing Environment Configuration...');
  try {
    // We can't directly access env vars, but we can test their effects
    const response = await fetch(`${SERVER_URL}/api/auth/session`);
    console.log(`   Auth session endpoint status: ${response.status}`);
    
    if (response.status === 500) {
      console.log('   ⚠️  500 error might indicate env var or database issues');
    }
  } catch (error) {
    console.log(`   ❌ Environment test failed: ${error.message}`);
  }
}

// Test 6: Actual Sign-up Attempt
async function testSignUp() {
  console.log('\n6️⃣ Testing Actual Sign-up...');
  
  const testUser = {
    email: `test-${Date.now()}@example.com`,
    password: 'TestPassword123!',
    name: 'Test User'
  };
  
  try {
    const response = await fetch(`${SERVER_URL}/api/auth/sign-up`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': FRONTEND_URLS[0]
      },
      body: JSON.stringify(testUser)
    });
    
    const responseText = await response.text();
    console.log(`   Status: ${response.status}`);
    console.log(`   Response: ${responseText.substring(0, 200)}...`);
    
    if (response.status === 200 || response.status === 201) {
      console.log('   ✅ Sign-up successful!');
    } else {
      console.log('   ❌ Sign-up failed');
    }
  } catch (error) {
    console.log(`   ❌ Sign-up test failed: ${error.message}`);
  }
}

// Run all tests
async function runAllTests() {
  const serverHealthy = await testServerHealth();
  
  if (!serverHealthy) {
    console.log('\n🚨 Server is not responding. Check Railway deployment.');
    return;
  }
  
  await testAuthEndpoints();
  await testCORS();
  await testDatabase();
  await testEnvironmentVars();
  await testSignUp();
  
  console.log('\n🏁 Debug complete. Check results above for issues.');
}

runAllTests().catch(console.error);
