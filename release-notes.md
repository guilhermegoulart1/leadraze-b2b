# 📦 Release v8.6.1

New Features

Automatic Default Sector: New accounts now automatically get a "General" sector created. All new users are automatically assigned to this sector upon creation.
Multi-language Support for Sectors: Default sector name adapts to user's language preference (Geral/General).

Improvements

Campaigns that finished collection without finding any leads are now correctly displayed as "Completed" instead of "Review"

Bug Fixes

Fixed sector assignment: Resolved 400 error when assigning users to sectors from the permissions modal.

Fixed permissions display: Admin users now correctly see all permissions checked in the Permissions page.

Fixed multi-tenancy permissions: Permission seeding now properly includes account_id for all accounts.

Auto-initialize permissions: Accounts without configured permissions are now automatically initialized when accessing the permissions page.

UI/UX Improvements

Light mode support: Added full light/dark mode support across Team management pages:
Users page: role badges (Admin, Supervisor, User) and status badges (Active, Inactive)

Sectors page: user count, supervisor count, round-robin, and status badges
Permissions page: full theme support for all elements

Team page tabs: proper styling for both themes
Improved badge readability: All badges now have proper contrast in both light and dark modes with appropriate background colors and borders.