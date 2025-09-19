# Team Switcher Enhancement Documentation

## Overview

The Team Switcher component has been completely enhanced with real authentication, improved UX, accessibility features, and comprehensive error handling. This document outlines all the improvements made and how to use the enhanced component.

## Key Improvements

### 1. Authentication & Security
- ✅ **Real Authentication**: Replaced mock `const isAdmin = true` with actual Better Auth integration
- ✅ **tRPC Integration**: Uses `trpc.admin.checkAdminRole.useQuery()` for real-time role checking
- ✅ **Strict Admin Enforcement**: Server now enforces `role === "admin"` only (no team_lead)
- ✅ **Session Management**: Proper session state handling with loading and error states

### 2. User Experience Enhancements
- ✅ **Loading States**: Animated spinner during authentication checks
- ✅ **Error Handling**: Graceful error messages for failed role checks
- ✅ **Visual Feedback**: Clear current portal indication and disabled states
- ✅ **Responsive Design**: Works seamlessly across all screen sizes
- ✅ **Navigation Safety**: Error handling for navigation failures

### 3. Accessibility Features
- ✅ **ARIA Labels**: Comprehensive screen reader support
- ✅ **Keyboard Navigation**: Full keyboard support (Enter, Space, Escape)
- ✅ **Focus Management**: Proper focus states and visual indicators
- ✅ **Role Attributes**: Semantic HTML with proper roles
- ✅ **Tab Navigation**: Logical tab order and focus trapping

### 4. Code Quality
- ✅ **TypeScript**: Full type safety with proper interfaces
- ✅ **Error Boundaries**: Comprehensive error handling
- ✅ **Performance**: Optimized re-renders and memoized callbacks
- ✅ **Testing**: Complete test suite with accessibility tests
- ✅ **Documentation**: Comprehensive inline documentation

## Component API

### Props
```typescript
interface TeamSwitcherProps {
  teams?: {
    name: string;
    logo: string;
  }[];
}
```

### Usage
```tsx
import { TeamSwitcher } from "@/components/team-switcher";

// Basic usage (teams are optional, defaults to InnovaCraft)
<TeamSwitcher />

// With custom teams
<TeamSwitcher teams={[
  {
    name: "Custom Team",
    logo: "https://example.com/logo.png"
  }
]} />
```

## Authentication States

### 1. Loading State
- Shows animated spinner while checking session and role
- Displays "Loading..." message for screen readers
- Prevents interaction until authentication is resolved

### 2. Not Authenticated
- Shows "Please sign in to access portals" message
- Dropdown is accessible but shows authentication prompt
- No portal switching options available

### 3. Authenticated Agent (Non-Admin)
- Shows "Agent Dashboard" option only
- "Admin Portal" is hidden (not just disabled)
- Can switch to agent dashboard from any location

### 4. Authenticated Admin
- Shows both "Agent Dashboard" and "Admin Portal" options
- Current portal is clearly indicated with "Current" label
- Can switch between portals freely

### 5. Error State
- Shows "Failed to load user permissions" message
- Graceful degradation - component remains functional
- Error details logged to console for debugging

## Accessibility Features

### Keyboard Navigation
- **Enter/Space**: Open/close dropdown
- **Escape**: Close dropdown
- **Tab**: Navigate through menu items
- **Enter/Space on items**: Activate navigation

### Screen Reader Support
- Comprehensive ARIA labels for all interactive elements
- Live regions for dynamic content updates
- Semantic HTML structure with proper roles
- Clear state announcements (expanded/collapsed)

### Visual Accessibility
- High contrast focus indicators
- Clear visual hierarchy
- Consistent spacing and typography
- Loading states with visual and text indicators

## Server-Side Changes

### tRPC Admin Procedure
```typescript
// Before: Allowed both admin and team_lead
if (!userRole || !["admin", "team_lead"].includes(userRole)) {

// After: Admin only
if (userRole !== "admin") {
  throw new TRPCError({
    code: "FORBIDDEN",
    message: "Admin access required",
    cause: `User role '${userRole}' is not authorized for admin operations`,
  });
}
```

### Admin Role Check
```typescript
// Before: Included team_lead
const isAdmin = userRole === "admin" || userRole === "team_lead";

// After: Admin only
const isAdmin = userRole === "admin";
```

## Testing

### Unit Tests
- Authentication state handling
- Role-based access control
- Navigation functionality
- Error handling
- Accessibility compliance

### Manual Testing Checklist
- [ ] Sign in as non-admin: Only Agent Dashboard visible
- [ ] Sign in as admin: Both portals visible
- [ ] Navigation works correctly
- [ ] Loading states display properly
- [ ] Error states handle gracefully
- [ ] Keyboard navigation works
- [ ] Screen reader announces correctly

## Performance Considerations

### Optimizations
- Memoized navigation callbacks to prevent unnecessary re-renders
- Conditional tRPC queries (only when session exists)
- Efficient state management with minimal re-renders
- Lazy loading of role data

### Bundle Size
- Minimal additional dependencies
- Tree-shakeable imports
- Optimized icon usage

## Migration Guide

### From Old Implementation
1. Remove any mock `isAdmin` flags
2. Ensure Better Auth is properly configured
3. Update server admin procedures to admin-only
4. Test with different user roles
5. Verify accessibility with screen readers

### Breaking Changes
- `teams` prop is now optional (defaults to InnovaCraft)
- Removed team selection functionality (as per requirements)
- Server admin procedures now require admin role only

## Future Enhancements

### Potential Improvements
- [ ] Add team creation modal
- [ ] Implement team switching functionality
- [ ] Add user preferences for default portal
- [ ] Enhanced error recovery mechanisms
- [ ] Offline state handling

### Accessibility Roadmap
- [ ] High contrast mode support
- [ ] Reduced motion preferences
- [ ] Voice control compatibility
- [ ] Mobile accessibility improvements

## Support

For issues or questions about the enhanced Team Switcher:
1. Check the test suite for expected behavior
2. Review the accessibility documentation
3. Verify Better Auth configuration
4. Check server-side admin procedures
5. Test with different user roles and states
