You are tasked with cleaning up the UI by removing unnecessary feedback forms and updating the user dropdown to use real BetterAuth data instead of hardcoded values.

## TASK OVERVIEW:
1. Remove all FeedbackDialog components from Agent and Admin portals
2. Update user-dropdown.tsx to use BetterAuth session data
3. Implement proper logout functionality
4. Remove unwanted menu items (Account settings, Affiliate area)

## PHASE 1: Remove Feedback Forms
Search for and remove ALL instances of:
- Import: `import FeedbackDialog from "@/components/feedback-dialog";`
- Component: `<FeedbackDialog />`

TARGET FILES:
- apps/web/src/app/dashboard/page.tsx
- apps/web/src/app/admin/page.tsx  
- apps/web/src/app/dashboard/settings/page.tsx
- apps/web/src/app/admin/settings/page.tsx
- apps/web/src/app/dashboard/pipeline/page.tsx

## PHASE 2: Update User Dropdown with BetterAuth

FILE: [apps/web/src/components/user-dropdown.tsx](cci:7://file:///c:/Users/USER%201/Desktop/devots-final/steelix-final/apps/web/src/components/user-dropdown.tsx:0:0-0:0)

REFERENCE: Use patterns from [apps/web/src/components/user-menu.tsx](cci:7://file:///c:/Users/USER%201/Desktop/devots-final/steelix-final/apps/web/src/components/user-menu.tsx:0:0-0:0)

REQUIRED CHANGES:

1. **Add imports:**
```typescript
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";


2. Add session management:

const router = useRouter();
const { data: session, isPending } = authClient.useSession();

3. Add loading state:
const router = useRouter();
const { data: session, isPending } = authClient.useSession();

4. Add unauthenticated state:
if (!session) {
  return (
    <Button variant="outline" asChild>
      <Link href="/login">Sign In</Link>
    </Button>
  );
}

5. Extract dynamic user data:
const userName = session.user.name || "User";
const userEmail = session.user.email || "";
const userInitials = userName.split(' ').map(n => n[0]).join('').toUpperCase();

6. Implement logout function:
const handleSignOut = async () => {
  await authClient.signOut({
    fetchOptions: {
      onSuccess: () => {
        router.push("/login");
      },
    },
  });
};

7. Update user display to use dynamic data:
<DropdownMenuLabel className="flex min-w-0 flex-col">
  <span className="truncate font-medium text-foreground text-sm">
    {userName}
  </span>
  <span className="truncate font-normal text-muted-foreground text-xs">
    {userEmail}
  </span>
</DropdownMenuLabel>

8. Update avatar with dynamic data:
<Avatar className="size-8">
  <AvatarImage src={session.user.image} alt="Profile image" />
  <AvatarFallback>{userInitials}</AvatarFallback>
</Avatar>

9. Replace menu items - KEEP ONLY logout:
<DropdownMenuItem onClick={handleSignOut}>
  <RiLogoutBoxLine size={16} className="opacity-60" aria-hidden="true" />
  <span>Sign out</span>
</DropdownMenuItem>

VALIDATION REQUIREMENTS:
 - No more FeedbackDialog imports in any file
 - No more components in any file
 - User dropdown shows real user name and email from BetterAuth
 - Logout button redirects to /login
 - No TypeScript errors
 - Avatar shows user initials when no image available
 - Loading skeleton appears during session fetch
 - Account settings and Affiliate area menu items removed

 SUCCESS CRITERIA:
✅ Clean UI without feedback forms ✅ Dynamic user data from authentication ✅ Working logout functionality ✅ Maintained design consistency ✅ No hardcoded user information

Execute these changes systematically, testing each phase before moving to the next. Maintain existing styling and component structure while implementing the functional improvements.