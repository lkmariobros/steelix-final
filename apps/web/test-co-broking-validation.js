// Test script to validate co-broking form submission
// This script simulates the form data that would be sent to the server

const testCases = [
  {
    name: "Valid co-broking transaction",
    data: {
      marketType: "secondary",
      transactionType: "sale",
      transactionDate: new Date(),
      propertyData: {
        address: "123 Test St",
        propertyType: "apartment",
        price: 500000,
      },
      clientData: {
        name: "John Doe",
        email: "john@example.com",
        phone: "123-456-7890",
        type: "buyer",
        source: "referral",
      },
      isCoBroking: true,
      coBrokingData: {
        agentName: "Jane Smith",
        agencyName: "ABC Realty",
        commissionSplit: 50,
        contactInfo: "jane@abcrealty.com",
      },
      commissionType: "percentage",
      commissionValue: 3,
      commissionAmount: 15000,
    },
    expectedResult: "success",
  },
  {
    name: "Invalid co-broking - missing agent name",
    data: {
      marketType: "secondary",
      transactionType: "sale",
      transactionDate: new Date(),
      propertyData: {
        address: "123 Test St",
        propertyType: "apartment",
        price: 500000,
      },
      clientData: {
        name: "John Doe",
        email: "john@example.com",
        phone: "123-456-7890",
        type: "buyer",
        source: "referral",
      },
      isCoBroking: true,
      coBrokingData: {
        agentName: "", // Empty agent name
        agencyName: "ABC Realty",
        commissionSplit: 50,
        contactInfo: "jane@abcrealty.com",
      },
      commissionType: "percentage",
      commissionValue: 3,
      commissionAmount: 15000,
    },
    expectedResult: "error",
    expectedError: "Agent name is required",
  },
  {
    name: "Valid non-co-broking transaction",
    data: {
      marketType: "secondary",
      transactionType: "sale",
      transactionDate: new Date(),
      propertyData: {
        address: "123 Test St",
        propertyType: "apartment",
        price: 500000,
      },
      clientData: {
        name: "John Doe",
        email: "john@example.com",
        phone: "123-456-7890",
        type: "buyer",
        source: "referral",
      },
      isCoBroking: false,
      // coBrokingData should be undefined for non-co-broking
      commissionType: "percentage",
      commissionValue: 3,
      commissionAmount: 15000,
    },
    expectedResult: "success",
  },
];

console.log("🧪 Co-broking Validation Test Cases");
console.log("=" .repeat(50));

testCases.forEach((testCase, index) => {
  console.log(`\n${index + 1}. ${testCase.name}`);
  console.log("Data:", JSON.stringify(testCase.data, null, 2));
  console.log("Expected:", testCase.expectedResult);
  if (testCase.expectedError) {
    console.log("Expected Error:", testCase.expectedError);
  }
});

console.log("\n✅ Test cases prepared. Use these to manually test the form submission.");
console.log("📝 Instructions:");
console.log("1. Open the sales form at http://localhost:3001/sales");
console.log("2. Fill out the form with the test data above");
console.log("3. Verify that validation works as expected");
console.log("4. Check browser console for any errors");
