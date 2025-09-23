#!/usr/bin/env tsx

/**
 * Test script to verify Reports & Analytics tRPC integration
 * This script tests the specific queries that were failing in the admin reports page
 */

import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../../../server/src/routers/_app';

// Create tRPC client
const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: 'http://localhost:8080/trpc',
      headers: {
        'Content-Type': 'application/json',
      },
    }),
  ],
});

async function testReportsQueries() {
  console.log('🧪 Testing Reports & Analytics tRPC Queries...\n');

  try {
    // Test 1: getDashboardStats query
    console.log('1️⃣ Testing trpc.reports.getDashboardStats...');
    const dashboardStats = await trpc.reports.getDashboardStats.query({
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
    });
    console.log('✅ getDashboardStats successful:', {
      transactionStats: dashboardStats.transactionStats,
      approvalStats: dashboardStats.approvalStats,
    });

    // Test 2: getPerformanceAnalytics query
    console.log('\n2️⃣ Testing trpc.reports.getPerformanceAnalytics...');
    const performanceAnalytics = await trpc.reports.getPerformanceAnalytics.query({
      periodType: 'monthly',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
    });
    console.log('✅ getPerformanceAnalytics successful:', {
      metricsCount: performanceAnalytics.length,
      sampleMetric: performanceAnalytics[0] || 'No metrics found',
    });

    console.log('\n🎉 All Reports & Analytics queries working correctly!');
    
  } catch (error) {
    console.error('❌ Error testing reports queries:', error);
    
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    
    process.exit(1);
  }
}

// Test server health first
async function testServerHealth() {
  try {
    console.log('🏥 Testing server health...');
    const response = await fetch('http://localhost:8080/health');
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Server healthy:', data);
      return true;
    } else {
      console.error('❌ Server health check failed:', response.status);
      return false;
    }
  } catch (error) {
    console.error('❌ Server not accessible:', error);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting Reports & Analytics tRPC Integration Test\n');
  
  // Check server health first
  const serverHealthy = await testServerHealth();
  if (!serverHealthy) {
    console.error('❌ Server is not healthy. Please start the server first.');
    process.exit(1);
  }
  
  console.log('');
  
  // Test reports queries
  await testReportsQueries();
  
  console.log('\n✅ All tests completed successfully!');
}

// Run the tests
main().catch((error) => {
  console.error('❌ Test script failed:', error);
  process.exit(1);
});
