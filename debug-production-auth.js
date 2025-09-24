#!/usr/bin/env node

/**
 * Production Authentication Diagnostic Tool
 * Helps diagnose auth issues between Vercel frontend and Railway backend
 */

const FRONTEND_URL = 'https://steelix-final-web.vercel.app';
const BACKEND_URL = 'https://steelix-final-production.up.railway.app';

console.log('🔍 PRODUCTION AUTHENTICATION DIAGNOSTIC');
console.log('=====================================');
console.log(`Frontend: ${FRONTEND_URL}`);
console.log(`Backend:  ${BACKEND_URL}`);
console.log('');

// Test 1: Backend Health Check
async function testBackendHealth() {
  console.log('1️⃣ Testing Backend Health...');
  try {
    const response = await fetch(`${BACKEND_URL}/health`);
    const data = await response.json();
    console.log(`   ✅ Backend Status: ${response.status}`);
    console.log(`   📊 Response:`, data);
  } catch (error) {
    console.log(`   ❌ Backend Health Failed: ${error.message}`);
  }
  console.log('');
}

// Test 2: Auth Configuration
async function testAuthConfig() {
  console.log('2️⃣ Testing Auth Configuration...');
  try {
    const response = await fetch(`${BACKEND_URL}/debug/auth-config`);
    const data = await response.json();
    console.log(`   ✅ Auth Config Status: ${response.status}`);
    console.log(`   🔐 Better Auth URL: ${data.betterAuthUrl}`);
    console.log(`   🌐 CORS Origins: ${data.corsOrigins}`);
    console.log(`   🔑 Has Secret: ${data.hasSecret}`);
    console.log(`   🗄️  Has Database: ${data.hasDatabaseUrl}`);
    console.log(`   🌍 Environment: ${data.nodeEnv}`);
    
    // Check for common issues
    if (data.betterAuthUrl !== BACKEND_URL) {
      console.log(`   ⚠️  WARNING: BETTER_AUTH_URL (${data.betterAuthUrl}) != Backend URL (${BACKEND_URL})`);
    }
    if (!data.corsOrigins.includes(FRONTEND_URL)) {
      console.log(`   ⚠️  WARNING: Frontend URL not in CORS origins`);
    }
  } catch (error) {
    console.log(`   ❌ Auth Config Failed: ${error.message}`);
  }
  console.log('');
}

// Test 3: Auth Session Endpoint
async function testAuthSession() {
  console.log('3️⃣ Testing Auth Session Endpoint...');
  try {
    const response = await fetch(`${BACKEND_URL}/api/auth/session`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Origin': FRONTEND_URL
      }
    });
    
    console.log(`   📡 Session Status: ${response.status}`);
    console.log(`   🍪 Response Headers:`, Object.fromEntries(response.headers.entries()));
    
    if (response.status === 200) {
      const data = await response.json();
      console.log(`   📊 Session Data:`, data);
    } else {
      const text = await response.text();
      console.log(`   ❌ Error Response:`, text);
    }
  } catch (error) {
    console.log(`   ❌ Session Test Failed: ${error.message}`);
  }
  console.log('');
}

// Test 4: CORS Preflight
async function testCORS() {
  console.log('4️⃣ Testing CORS Configuration...');
  try {
    const response = await fetch(`${BACKEND_URL}/api/auth/session`, {
      method: 'OPTIONS',
      headers: {
        'Origin': FRONTEND_URL,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    });
    
    console.log(`   🌐 CORS Status: ${response.status}`);
    console.log(`   🔧 CORS Headers:`, Object.fromEntries(response.headers.entries()));
    
    const allowOrigin = response.headers.get('Access-Control-Allow-Origin');
    const allowCredentials = response.headers.get('Access-Control-Allow-Credentials');
    
    if (allowOrigin !== FRONTEND_URL && allowOrigin !== '*') {
      console.log(`   ⚠️  WARNING: CORS Allow-Origin (${allowOrigin}) doesn't match frontend`);
    }
    if (allowCredentials !== 'true') {
      console.log(`   ⚠️  WARNING: CORS Allow-Credentials not set to true`);
    }
  } catch (error) {
    console.log(`   ❌ CORS Test Failed: ${error.message}`);
  }
  console.log('');
}

// Test 5: tRPC Health Check
async function testTRPC() {
  console.log('5️⃣ Testing tRPC Connection...');
  try {
    const response = await fetch(`${BACKEND_URL}/trpc/healthCheck`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Origin': FRONTEND_URL
      }
    });
    
    console.log(`   🔌 tRPC Status: ${response.status}`);
    if (response.status === 200) {
      const data = await response.json();
      console.log(`   📊 tRPC Response:`, data);
    } else {
      const text = await response.text();
      console.log(`   ❌ tRPC Error:`, text);
    }
  } catch (error) {
    console.log(`   ❌ tRPC Test Failed: ${error.message}`);
  }
  console.log('');
}

// Main diagnostic function
async function runDiagnostics() {
  await testBackendHealth();
  await testAuthConfig();
  await testAuthSession();
  await testCORS();
  await testTRPC();
  
  console.log('🎯 DIAGNOSTIC SUMMARY');
  console.log('====================');
  console.log('If you see warnings above, check these common issues:');
  console.log('');
  console.log('📋 ENVIRONMENT VARIABLES TO CHECK:');
  console.log('');
  console.log('🚂 Railway Backend:');
  console.log(`   BETTER_AUTH_URL=${BACKEND_URL}`);
  console.log(`   CORS_ORIGIN=${FRONTEND_URL}`);
  console.log('   BETTER_AUTH_SECRET=your-secret-key');
  console.log('   DATABASE_URL=your-database-url');
  console.log('');
  console.log('🚀 Vercel Frontend:');
  console.log(`   NEXT_PUBLIC_SERVER_URL=${BACKEND_URL}`);
  console.log('');
  console.log('🔧 COMMON FIXES:');
  console.log('1. Ensure BETTER_AUTH_URL matches your Railway backend URL exactly');
  console.log('2. Add your Vercel frontend URL to CORS_ORIGIN');
  console.log('3. Verify DATABASE_URL is accessible from Railway');
  console.log('4. Check that cookies are enabled in your browser');
  console.log('5. Clear browser cookies and try again');
}

// Run diagnostics
runDiagnostics().catch(console.error);
