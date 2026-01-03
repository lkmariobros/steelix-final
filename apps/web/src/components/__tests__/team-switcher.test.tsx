import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter, usePathname } from 'next/navigation';
import { TeamSwitcher } from '../team-switcher';
import { authClient } from '@/lib/auth-client';
import { trpc } from '@/utils/trpc';

// Mock dependencies
jest.mock('next/navigation');
jest.mock('@/lib/auth-client');
jest.mock('@/utils/trpc');

const mockRouter = {
  push: jest.fn(),
};

const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUsePathname = usePathname as jest.MockedFunction<typeof usePathname>;
const mockAuthClient = authClient as jest.Mocked<typeof authClient>;
const mockTrpc = trpc as jest.Mocked<typeof trpc>;

describe('TeamSwitcher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouter.mockReturnValue(mockRouter);
    mockUsePathname.mockReturnValue('/dashboard');
  });

  describe('Loading States', () => {
    it('shows loading spinner when session is pending', () => {
      mockAuthClient.useSession.mockReturnValue({
        data: null,
        isPending: true,
      });

      mockTrpc.admin.checkAdminRole.useQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
      });

      render(<TeamSwitcher />);
      
      expect(screen.getByLabelText(/loading/i)).toBeInTheDocument();
    });

    it('shows loading spinner when role is loading', () => {
      mockAuthClient.useSession.mockReturnValue({
        data: { user: { id: '1' } },
        isPending: false,
      });

      mockTrpc.admin.checkAdminRole.useQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      });

      render(<TeamSwitcher />);
      
      expect(screen.getByLabelText(/loading/i)).toBeInTheDocument();
    });
  });

  describe('Authentication States', () => {
    it('shows not authenticated message when user is not signed in', async () => {
      mockAuthClient.useSession.mockReturnValue({
        data: null,
        isPending: false,
      });

      mockTrpc.admin.checkAdminRole.useQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
      });

      render(<TeamSwitcher />);
      
      // Click to open dropdown
      fireEvent.click(screen.getByRole('button'));
      
      await waitFor(() => {
        expect(screen.getByText(/please sign in to access portals/i)).toBeInTheDocument();
      });
    });

    it('shows error message when role check fails', async () => {
      mockAuthClient.useSession.mockReturnValue({
        data: { user: { id: '1' } },
        isPending: false,
      });

      mockTrpc.admin.checkAdminRole.useQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Failed to check role'),
      });

      render(<TeamSwitcher />);
      
      // Click to open dropdown
      fireEvent.click(screen.getByRole('button'));
      
      await waitFor(() => {
        expect(screen.getByText(/failed to load user permissions/i)).toBeInTheDocument();
      });
    });
  });

  describe('Role-based Access', () => {
    it('shows only Agent Dashboard for non-admin users', async () => {
      mockAuthClient.useSession.mockReturnValue({
        data: { user: { id: '1' } },
        isPending: false,
      });

      mockTrpc.admin.checkAdminRole.useQuery.mockReturnValue({
        data: { hasAdminAccess: false, role: 'agent' },
        isLoading: false,
        error: null,
      });

      render(<TeamSwitcher />);
      
      // Click to open dropdown
      fireEvent.click(screen.getByRole('button'));
      
      await waitFor(() => {
        expect(screen.getByText('Agent Dashboard')).toBeInTheDocument();
        expect(screen.queryByText('Admin Portal')).not.toBeInTheDocument();
      });
    });

    it('shows both portals for admin users', async () => {
      mockAuthClient.useSession.mockReturnValue({
        data: { user: { id: '1' } },
        isPending: false,
      });

      mockTrpc.admin.checkAdminRole.useQuery.mockReturnValue({
        data: { hasAdminAccess: true, role: 'admin' },
        isLoading: false,
        error: null,
      });

      render(<TeamSwitcher />);
      
      // Click to open dropdown
      fireEvent.click(screen.getByRole('button'));
      
      await waitFor(() => {
        expect(screen.getByText('Agent Dashboard')).toBeInTheDocument();
        expect(screen.getByText('Admin Portal')).toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    it('navigates to dashboard when Agent Dashboard is clicked', async () => {
      mockUsePathname.mockReturnValue('/admin');
      mockAuthClient.useSession.mockReturnValue({
        data: { user: { id: '1' } },
        isPending: false,
      });

      mockTrpc.admin.checkAdminRole.useQuery.mockReturnValue({
        data: { hasAdminAccess: true, role: 'admin' },
        isLoading: false,
        error: null,
      });

      render(<TeamSwitcher />);
      
      // Click to open dropdown
      fireEvent.click(screen.getByRole('button'));
      
      await waitFor(() => {
        const agentDashboardItem = screen.getByText('Agent Dashboard');
        fireEvent.click(agentDashboardItem);
        expect(mockRouter.push).toHaveBeenCalledWith('/dashboard');
      });
    });

    it('navigates to admin when Admin Portal is clicked', async () => {
      mockUsePathname.mockReturnValue('/dashboard');
      mockAuthClient.useSession.mockReturnValue({
        data: { user: { id: '1' } },
        isPending: false,
      });

      mockTrpc.admin.checkAdminRole.useQuery.mockReturnValue({
        data: { hasAdminAccess: true, role: 'admin' },
        isLoading: false,
        error: null,
      });

      render(<TeamSwitcher />);
      
      // Click to open dropdown
      fireEvent.click(screen.getByRole('button'));
      
      await waitFor(() => {
        const adminPortalItem = screen.getByText('Admin Portal');
        fireEvent.click(adminPortalItem);
        expect(mockRouter.push).toHaveBeenCalledWith('/admin');
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      mockAuthClient.useSession.mockReturnValue({
        data: { user: { id: '1' } },
        isPending: false,
      });

      mockTrpc.admin.checkAdminRole.useQuery.mockReturnValue({
        data: { hasAdminAccess: true, role: 'admin' },
        isLoading: false,
        error: null,
      });

      render(<TeamSwitcher />);
      
      const trigger = screen.getByRole('button');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
      expect(trigger).toHaveAttribute('aria-label');
    });

    it('supports keyboard navigation', async () => {
      mockAuthClient.useSession.mockReturnValue({
        data: { user: { id: '1' } },
        isPending: false,
      });

      mockTrpc.admin.checkAdminRole.useQuery.mockReturnValue({
        data: { hasAdminAccess: true, role: 'admin' },
        isLoading: false,
        error: null,
      });

      render(<TeamSwitcher />);
      
      const trigger = screen.getByRole('button');
      
      // Test Enter key
      fireEvent.keyDown(trigger, { key: 'Enter' });
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      
      // Test Escape key
      fireEvent.keyDown(trigger, { key: 'Escape' });
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });
  });
});
