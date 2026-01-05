"use client";

import { trpc } from '@/utils/trpc';
import { useQuery } from '@tanstack/react-query';

export function TestDocumentsTRPC() {
  // Test the tRPC proxy setup with a simple health check
  const testQuery = useQuery({
    queryKey: ['healthCheck'],
    queryFn: async () => {
      const response = await fetch(`/api/trpc/healthCheck`, {
        credentials: 'include'
      });
      return response.json();
    }
  });

  const handleTest = () => {
    console.log('Testing tRPC setup...');
    console.log('Available tRPC methods:', Object.keys(trpc));
    console.log('tRPC object:', trpc);

    // Test individual routers
    console.log('Documents router:', trpc.documents);
    console.log('Dashboard router:', trpc.dashboard);
    console.log('Admin router:', trpc.admin);
    console.log('HealthCheck:', trpc.healthCheck);

    console.log('Test query status:', testQuery.status);
    console.log('Test query data:', testQuery.data);
    console.log('Test query error:', testQuery.error);
  };

  return (
    <div className="p-4 border rounded">
      <h3>tRPC Documents Test</h3>
      <button onClick={handleTest} className="px-4 py-2 bg-blue-500 text-white rounded">
        Test tRPC Setup
      </button>
      <div className="mt-2 text-sm">
        <p>Query Status: {testQuery.status}</p>
        <p>Has Error: {testQuery.error ? 'Yes' : 'No'}</p>
        {testQuery.error && <p className="text-red-500">Error: {testQuery.error.message}</p>}
      </div>
    </div>
  );
}
