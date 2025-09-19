#!/usr/bin/env tsx

/**
 * Team Switcher Validation Script
 * 
 * This script validates that the team switcher implementation
 * meets all the requirements and best practices.
 */

import fs from 'fs';
import path from 'path';

interface ValidationResult {
  passed: boolean;
  message: string;
  details?: string;
}

class TeamSwitcherValidator {
  private results: ValidationResult[] = [];
  private basePath: string;

  constructor() {
    this.basePath = process.cwd();
  }

  private addResult(passed: boolean, message: string, details?: string) {
    this.results.push({ passed, message, details });
  }

  private fileExists(filePath: string): boolean {
    return fs.existsSync(path.join(this.basePath, filePath));
  }

  private readFile(filePath: string): string {
    try {
      return fs.readFileSync(path.join(this.basePath, filePath), 'utf-8');
    } catch {
      return '';
    }
  }

  private checkFileContent(filePath: string, pattern: RegExp, description: string): boolean {
    const content = this.readFile(filePath);
    return pattern.test(content);
  }

  validateTeamSwitcherComponent() {
    console.log('🔍 Validating Team Switcher Component...\n');

    // Check if component file exists
    const componentPath = 'src/components/team-switcher.tsx';
    if (!this.fileExists(componentPath)) {
      this.addResult(false, 'Team switcher component file missing', componentPath);
      return;
    }

    const componentContent = this.readFile(componentPath);

    // Check for real authentication (no mock flags)
    const hasMockAdmin = /const\s+isAdmin\s*=\s*true/.test(componentContent);
    this.addResult(
      !hasMockAdmin,
      'No mock admin flags found',
      hasMockAdmin ? 'Found mock isAdmin = true' : undefined
    );

    // Check for Better Auth integration
    const hasBetterAuth = /authClient\.useSession/.test(componentContent);
    this.addResult(
      hasBetterAuth,
      'Better Auth integration present',
      !hasBetterAuth ? 'Missing authClient.useSession()' : undefined
    );

    // Check for tRPC role checking
    const hasTrpcRoleCheck = /trpc\.admin\.checkAdminRole\.useQuery/.test(componentContent);
    this.addResult(
      hasTrpcRoleCheck,
      'tRPC admin role checking present',
      !hasTrpcRoleCheck ? 'Missing tRPC admin role check' : undefined
    );

    // Check for loading states
    const hasLoadingStates = /isLoading|isPending/.test(componentContent);
    this.addResult(
      hasLoadingStates,
      'Loading states implemented',
      !hasLoadingStates ? 'Missing loading state handling' : undefined
    );

    // Check for error handling
    const hasErrorHandling = /error|Error/.test(componentContent);
    this.addResult(
      hasErrorHandling,
      'Error handling implemented',
      !hasErrorHandling ? 'Missing error handling' : undefined
    );

    // Check for accessibility features
    const hasAriaLabels = /aria-label|aria-expanded|aria-haspopup/.test(componentContent);
    this.addResult(
      hasAriaLabels,
      'Accessibility features present',
      !hasAriaLabels ? 'Missing ARIA attributes' : undefined
    );

    // Check for keyboard navigation
    const hasKeyboardNav = /onKeyDown|handleKeyDown/.test(componentContent);
    this.addResult(
      hasKeyboardNav,
      'Keyboard navigation implemented',
      !hasKeyboardNav ? 'Missing keyboard navigation' : undefined
    );
  }

  validateServerSideChanges() {
    console.log('🔍 Validating Server-Side Changes...\n');

    // Check tRPC admin procedure
    const trpcPath = 'src/lib/trpc.ts';
    if (this.fileExists(`../server/${trpcPath}`)) {
      const trpcContent = this.readFile(`../server/${trpcPath}`);
      
      // Check for strict admin-only enforcement
      const hasStrictAdmin = /userRole\s*!==\s*"admin"/.test(trpcContent);
      this.addResult(
        hasStrictAdmin,
        'Strict admin-only enforcement in tRPC',
        !hasStrictAdmin ? 'Missing strict admin check in adminProcedure' : undefined
      );
    }

    // Check admin router
    const adminRouterPath = 'src/routers/admin.ts';
    if (this.fileExists(`../server/${adminRouterPath}`)) {
      const adminContent = this.readFile(`../server/${adminRouterPath}`);
      
      // Check for admin-only role check
      const hasAdminOnlyCheck = /userRole\s*===\s*"admin"/.test(adminContent);
      this.addResult(
        hasAdminOnlyCheck,
        'Admin-only role check in admin router',
        !hasAdminOnlyCheck ? 'Missing admin-only check in checkAdminRole' : undefined
      );
    }
  }

  validateSupportingFiles() {
    console.log('🔍 Validating Supporting Files...\n');

    // Check for loading spinner component
    const hasLoadingSpinner = this.fileExists('src/components/ui/loading-spinner.tsx');
    this.addResult(
      hasLoadingSpinner,
      'Loading spinner component exists',
      !hasLoadingSpinner ? 'Missing loading spinner component' : undefined
    );

    // Check for error boundary component
    const hasErrorBoundary = this.fileExists('src/components/ui/error-boundary.tsx');
    this.addResult(
      hasErrorBoundary,
      'Error boundary component exists',
      !hasErrorBoundary ? 'Missing error boundary component' : undefined
    );

    // Check for access denied component
    const hasAccessDenied = this.fileExists('src/components/ui/access-denied.tsx');
    this.addResult(
      hasAccessDenied,
      'Access denied component exists',
      !hasAccessDenied ? 'Missing access denied component' : undefined
    );

    // Check for keyboard navigation hook
    const hasKeyboardHook = this.fileExists('src/hooks/use-keyboard-navigation.ts');
    this.addResult(
      hasKeyboardHook,
      'Keyboard navigation hook exists',
      !hasKeyboardHook ? 'Missing keyboard navigation hook' : undefined
    );

    // Check for test file
    const hasTests = this.fileExists('src/components/__tests__/team-switcher.test.tsx');
    this.addResult(
      hasTests,
      'Test file exists',
      !hasTests ? 'Missing test file' : undefined
    );

    // Check for documentation
    const hasDocumentation = this.fileExists('TEAM_SWITCHER_ENHANCEMENT.md');
    this.addResult(
      hasDocumentation,
      'Documentation exists',
      !hasDocumentation ? 'Missing enhancement documentation' : undefined
    );
  }

  validateAppSidebarCleanup() {
    console.log('🔍 Validating App Sidebar Cleanup...\n');

    const sidebarPath = 'src/components/app-sidebar.tsx';
    if (!this.fileExists(sidebarPath)) {
      this.addResult(false, 'App sidebar component missing', sidebarPath);
      return;
    }

    const sidebarContent = this.readFile(sidebarPath);

    // Check for removed mock data
    const hasMockTeams = /Acme Corp|Evil Corp/.test(sidebarContent);
    this.addResult(
      !hasMockTeams,
      'Mock team data removed from sidebar',
      hasMockTeams ? 'Found mock team data' : undefined
    );

    // Check for removed unused imports
    const hasUnusedAuthImport = /import.*authClient.*from.*auth-client/.test(sidebarContent);
    this.addResult(
      !hasUnusedAuthImport,
      'Unused auth client import removed',
      hasUnusedAuthImport ? 'Found unused authClient import' : undefined
    );
  }

  validateAdminSettingsPage() {
    console.log('🔍 Validating Admin Settings Page...\n');

    const settingsPath = 'src/app/admin/settings/page.tsx';
    if (!this.fileExists(settingsPath)) {
      this.addResult(false, 'Admin settings page missing', settingsPath);
      return;
    }

    const settingsContent = this.readFile(settingsPath);

    // Check for proper role checking (no temporary bypasses)
    const hasBypassComments = /TEMPORARILY ALLOW ACCESS|TODO.*Re-enable role check/.test(settingsContent);
    this.addResult(
      !hasBypassComments,
      'No temporary access bypasses in admin settings',
      hasBypassComments ? 'Found temporary bypass comments' : undefined
    );

    // Check for tRPC integration
    const hasTrpcImport = /import.*trpc.*from.*utils\/trpc/.test(settingsContent);
    this.addResult(
      hasTrpcImport,
      'tRPC integration in admin settings',
      !hasTrpcImport ? 'Missing tRPC import' : undefined
    );
  }

  run() {
    console.log('🚀 Team Switcher Enhancement Validation\n');
    console.log('=' .repeat(50) + '\n');

    this.validateTeamSwitcherComponent();
    this.validateServerSideChanges();
    this.validateSupportingFiles();
    this.validateAppSidebarCleanup();
    this.validateAdminSettingsPage();

    console.log('\n' + '=' .repeat(50));
    console.log('📊 Validation Results\n');

    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;
    const percentage = Math.round((passed / total) * 100);

    this.results.forEach(result => {
      const icon = result.passed ? '✅' : '❌';
      console.log(`${icon} ${result.message}`);
      if (result.details) {
        console.log(`   ${result.details}`);
      }
    });

    console.log(`\n📈 Score: ${passed}/${total} (${percentage}%)`);

    if (percentage === 100) {
      console.log('\n🎉 All validations passed! Team switcher enhancement is complete.');
    } else if (percentage >= 80) {
      console.log('\n⚠️  Most validations passed. Review failed items above.');
    } else {
      console.log('\n🚨 Several validations failed. Please address the issues above.');
    }

    return percentage === 100;
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new TeamSwitcherValidator();
  const success = validator.run();
  process.exit(success ? 0 : 1);
}

export { TeamSwitcherValidator };
