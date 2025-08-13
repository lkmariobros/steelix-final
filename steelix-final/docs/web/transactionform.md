# Sales Transaction Entry Implementation Guide

The Sales Transaction Entry feature is a multi-step form that allows real estate agents to record property transactions. The form guides agents through a 7-step process, collecting all necessary information for transaction processing and approval by administrators.

## Overview

"Directory Structure"

apps/web/
├── src/
│   ├── features/
│   │   └── sales-entry/                # Main feature directory
│   │       ├── transaction-form.tsx    # Main multi-step form component
│   │       ├── transaction-schema.ts   # Zod schema and TypeScript types
│   │       ├── steps/                  # Individual form steps
│   │       │   ├── step-1-initiation.tsx
│   │       │   ├── step-2-property.tsx
│   │       │   ├── step-3-client.tsx
│   │       │   ├── step-4-co-broking.tsx
│   │       │   ├── step-5-commission.tsx
│   │       │   ├── step-6-documents.tsx
│   │       │   └── step-7-review.tsx
│   │       ├── components/             # Feature-specific components
│   │       │   ├── property-search.tsx
│   │       │   ├── client-form.tsx
│   │       │   ├── commission-calculator.tsx
│   │       │   ├── document-uploader.tsx
│   │       │   └── transaction-summary.tsx
│   │       └── utils/                  # Feature-specific utilities
│   │           ├── form-state.ts       # Form state management
│   │           └── calculations.ts     # Commission calculations
│   ├── lib/
│   │   └── supabase-client.ts          # Supabase client configuration
│   ├── utils/
│   │   ├── trpc.ts                     # tRPC client setup
│   │   └── validators.ts               # Common validation utilities
│   ├── server/
│   │   └── api/
│   │       └── routers/
│   │           └── transactions.ts     # tRPC router for transactions
│   └── app/
│       └── sales/                      # Page route
│           └── page.tsx                # Page component

## "File Naming Conventions"

• Use kebab-case for all file and directory names
• Use descriptive names that indicate purpose
• Group related components in subdirectories
• Keep component files focused on a single responsibility

# Component Implementation Guidelines

*Main Transaction Form*

Location: apps/web/src/features/sales-entry/transaction-form.tsx

This is the main container component that:

• Manages the multi-step form state
• Handles navigation between steps
• Coordinates form submission
• Integrates with tRPC for data persistence

*Transaction Schema*

Location: apps/web/src/features/sales-entry/transaction-schema.ts

Define all form types and validation schemas:

• Use Zod for schema validation
• Export TypeScript types derived from schemas
• Define separate schemas for each step
• Include helper functions for schema operations

*Step Components*


Location: apps/web/src/features/sales-entry/steps/

Location: apps/web/src/features/sales-entry/steps/

Each step should:

• Be a self-contained component
• Accept form state and update callbacks as props
• Handle its own validation
• Provide navigation controls
• Implement responsive design

*Feature-Specific Components*

Location: apps/web/src/features/sales-entry/components/

Create reusable components specific to this feature:

• Property search component with autocomplete
• Client information form
• Commission calculator
• Document upload interface
• Transaction summary view

*Utility Functions*

Location: apps/web/src/features/sales-entry/utils/

Implement helper functions:

• Form state management
• Commission calculations
• Data formatting
• Step validation

*Page Component*

Location: apps/web/src/app/sales/page.tsx

The Next.js page that:

• Imports and renders the transaction form
• Handles authentication/authorization
•Provides layout and navigation context

# Backend Integration

*tRPC Router*

Location: apps/web/src/server/api/routers/transactions.ts

Define API procedures:

• Create transaction
• Update transaction
• Get transaction by ID
• List transactions
• Change transaction status

*Supabase Integration*

Location: apps/web/src/lib/supabase-client.ts

Configure Supabase client with authentication and authorization.

• Document storage
• Real-time updates
• User authentication (if applicable)

Import components from the UI directory:

Examples: 

import { Button } from "@/components/ui/button"
import { Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
// etc.

# Integration Points for Future Features

## Property Search Feature

The transaction form should be designed to easily integrate with the future property search feature:

• Use placeholder interfaces that match expected API
• Implement mock data for development
• Document integration points clearly
• Use Command component for search interface

## Client Database Integration

Similar approach for client selection/search:

• Prepare interfaces for future client API
• Use consistent data structures
• Document integration requirements

#Testing Strategy

• Unit tests for individual components
• Integration tests for form flow
• End-to-end tests for complete submission

# Deployment Considerations

• Ensure proper error handling
• Implement loading states
• Add responsive design for mobile agents
• Set up analytics for form completion rates


# User Journey 

┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  1. Initiation  │────>│  2. Property    │────>│  3. Client      │
│  - Market type  │     │  - Search/Entry │     │  - Details      │
│  - Trans. type  │     │  - Specs        │     │  - Type         │
│  - Date         │     │  - Price        │     │  - Source       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                                                │
        │                                                ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  7. Review      │<────│  6. Documents   │<────│  5. Commission  │
│  - Summary      │     │  - Upload files │     │  - Type         │
│  - Submit       │     │  - Add notes    │     │  - Calculation  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                                                ▲
        ▼                                                │
┌─────────────────┐                            ┌─────────────────┐
│  Submission     │                            │  4. Co-Broking  │
│  - Confirmation │                            │  - Toggle       │
│  - Status       │                            │  - Details      │
└─────────────────┘                            └─────────────────┘


## User Flow:

1. Agent initiates transaction by selecting market type, transaction type, and date
2. Agent enters or searches for property information
3. Agent provides client details
4. If applicable, agent enters co-broking information
5. Agent calculates commission
6. Agent uploads required documents and adds notes
7. Agent reviews all information and submits the transaction
8. Admin receives notification and can approve, reject, or request changes
9. Agent receives status updates in real-time

## Data Flow

The data flow in the transaction form follows this pattern:

1. User Input → Form fields capture user input
2. Form State → TanStack Form manages form state
3. Validation → Zod schemas validate input at each step
4. Persistence → Auto-save stores form state (localStorage/backend)
5. Submission → Complete form data is submitted via tRPC
6. Backend Processing → Server validates and stores data
7. Database → Data is stored in the database
8. Real-time Updates → Status changes are pushed to clients
9. UI Updates → UI reflects current transaction status


