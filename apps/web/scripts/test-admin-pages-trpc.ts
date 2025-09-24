#!/usr/bin/env tsx

/**
 * Test script to verify tRPC integration for Admin Portal pages
 * Tests the data binding implementation for approvals, agents, and reports pages
 */

import { createTRPCClient, httpBatchLink } from '@trpc/client';
// import type { AppRouter } from '../../../server/src/routers';
type AppRouter = any; // Temporary type for build compatibility

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:8080';

// Create tRPC client for testing
const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${SERVER_URL}/trpc`,
      headers: {
        'Content-Type': 'application/json',
      },
    }),
  ],
});

interface TestResult {
  endpoint: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  responseTime?: number;
  dataReceived?: boolean;
}

const results: TestResult[] = [];

function logResult(result: TestResult) {
  const statusIcon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
  const timeInfo = result.responseTime ? ` (${result.responseTime}ms)` : '';
  console.log(`${statusIcon} ${result.endpoint}${timeInfo}: ${result.message}`);
  results.push(result);
}

async function testEndpoint<T>(
  name: string,
  testFn: () => Promise<T>,
  validateFn?: (data: T) => boolean
): Promise<void> {
  try {
    const startTime = Date.now();
    const data = await testFn();
    const responseTime = Date.now() - startTime;
    
    const isValid = validateFn ? validateFn(data) : true;
    const hasData = data !== null && data !== undefined;
    
    if (isValid && hasData) {
      logResult({
        endpoint: name,
        status: 'PASS',
        message: 'Successfully fetched and validated data',
        responseTime,
        dataReceived: true
      });
    } else {
      logResult({
        endpoint: name,
        status: 'FAIL',
        message: isValid ? 'No data received' : 'Data validation failed',
        responseTime,
        dataReceived: hasData
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logResult({
      endpoint: name,
      status: 'FAIL',
      message: `Error: ${errorMessage}`,
      dataReceived: false
    });
  }
}

async function runTests() {
  console.log('🧪 Testing Admin Portal tRPC Integration\n');
  console.log(`📡 Server URL: ${SERVER_URL}`);
  console.log('=' .repeat(60));

  // Test health check first
  await testEndpoint(
    'healthCheck',
    () => trpc.healthCheck.query(),
    (data) => data === 'OK'
  );

  // Test approval statistics
  await testEndpoint(
    'approvals.getStats',
    () => trpc.approvals.getStats.query({}),
    (data: any) => typeof data === 'object' && data !== null
  );

  // Test approvals list
  await testEndpoint(
    'approvals.list',
    () => trpc.approvals.list.query({
      limit: 10,
      offset: 0,
      sortBy: 'submittedAt',
      sortOrder: 'desc'
    }),
    (data: any) => data && typeof data === 'object' && Array.isArray(data.approvals)
  );

  // Test agent statistics
  await testEndpoint(
    'agents.getStats',
    () => trpc.agents.getStats.query({}),
    (data: any) => typeof data === 'object' && data !== null
  );

  // Test agents list
  await testEndpoint(
    'agents.list',
    () => trpc.agents.list.query({
      limit: 10,
      offset: 0,
      sortBy: 'name',
      sortOrder: 'asc'
    }),
    (data: any) => data && typeof data === 'object' && Array.isArray(data.agents)
  );

  // Test dashboard statistics for reports
  await testEndpoint(
    'reports.getDashboardStats',
    () => trpc.reports.getDashboardStats.query({
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate: new Date()
    }),
    (data: any) => typeof data === 'object' && data !== null
  );

  // Test performance analytics
  await testEndpoint(
    'reports.getPerformanceAnalytics',
    () => trpc.reports.getPerformanceAnalytics.query({
      periodType: 'monthly',
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate: new Date()
    }),
    (data: any) => Array.isArray(data)
  );

  // Print summary
  console.log('\n' + '=' .repeat(60));
  console.log('📊 Test Summary');
  console.log('=' .repeat(60));

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;
  const total = results.length;

  console.log(`✅ Passed: ${passed}/${total}`);
  console.log(`❌ Failed: ${failed}/${total}`);
  console.log(`⏭️ Skipped: ${skipped}/${total}`);

  const avgResponseTime = results
    .filter(r => r.responseTime)
    .reduce((sum, r) => sum + (r.responseTime || 0), 0) / 
    results.filter(r => r.responseTime).length;

  if (avgResponseTime) {
    console.log(`⏱️ Average Response Time: ${Math.round(avgResponseTime)}ms`);
  }

  if (failed === 0) {
    console.log('\n🎉 All tests passed! Admin Portal tRPC integration is working correctly.');
  } else {
    console.log('\n⚠️ Some tests failed. Check the server logs and database connection.');
    process.exit(1);
  }
}

// Run the tests
runTests().catch((error) => {
  console.error('❌ Test runner failed:', error);
  process.exit(1);
});
