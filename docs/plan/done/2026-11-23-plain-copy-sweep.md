# Plain copy sweep — headings and empty states

## Goal

Remove marketing slogans. Every page gets a plain, literal heading. Every empty
state gets plain, factual text. Body paragraphs, navigation, form labels, and
legal copy stay as they are.

## Rules

1. **Delete tagline/eyebrow lines.** Remove every `<p className="eyebrow">…</p>`
   and every `eyebrow="…"` prop passed to `PageHeading`, `JobsBrowser`, or
   `NotificationsPage`. Leave the shared `PageHeading` `eyebrow` API in place;
   it simply stops being used.
2. **Literal page headings.** Replace slogan headings with the page's real name:
   - Home hero: `Find a job in Santa Maria, Bulacan`
   - About: `About PESO Santa Maria`
   - PESO Services: `PESO Services`
   - How It Works: `How It Works`
   - FAQ: `Frequently Asked Questions` (already plain; keep)
   - Public Jobs: `Browse Jobs`
   - Register selector: `Create an Account`
   - Homepage section headings (`CommunitySections.jsx`):
     `How JobLinked works`, `PESO Services`, `About JobLinked`,
     `Frequently Asked Questions`.
   - Portal/admin `PageHeading` titles: keep the existing literal titles,
     just drop the eyebrow.
3. **Plain empty states.** Rewrite EmptyState / empty copy to factual text:
   - No applications: `No applications yet.` /
     `Applications you submit will appear here.`
   - Employer no applicants: `No applicants yet.` /
     `Applicants will appear here after you publish a vacancy.`
   - No matching employers: `No employers match these filters.` /
     `Clear the filters to see all employers.`
   - No announcements: `No announcements match this search.` /
     `Clear the search to see all announcements.`
   - No resume: `No resume added.` /
     `Add a PDF, DOC, or DOCX file up to 5 MB.`
   - Homepage/portal recommendation empty states: `No recommendations yet.` /
     `Add skills and preferences to see matches.` and similar factual copy.
   - Keep filters, actions, and hrefs unchanged.
4. **Do not change** body paragraphs, service descriptions, FAQ answers, nav
   labels, form labels/placeholders, legal text, or validation messages.
5. **Tests.** Update any test that asserts a removed slogan or reworded
   empty-state string.
6. **Verification.** `npm run lint` and `npm test` must pass.

## Files in scope (from repo search)

Public site: `HomeHero.jsx`, `CommunitySections.jsx`, `CommunityStats.jsx`,
`About.jsx`, `PesoServices.jsx`, `HowItWorks.jsx`, `Faq.jsx`, `PublicJobs.jsx`,
`PublicEmployerProfile.jsx`.

Auth/shared: `Register.jsx`, `HelpChat.jsx`, `AccountSettings.jsx`,
`NotificationsPage.jsx`, `JobsBrowser.jsx`, `EmploymentCharts.jsx`,
`design.jsx` (defaults only), `ApplicationTimeline.jsx`, `NotificationBell.jsx`.

Job seeker: `Dashboard.jsx`, `Applications.jsx`, `Employment.jsx`, `Profile.jsx`.

Employer: `Dashboard.jsx`, `Applicants.jsx`, `Employees.jsx`, `JobPosts.jsx`,
`EmployerAccreditation.jsx`, `JobPostFormDialog.jsx`.

Super admin: `Dashboard.jsx`, `Applications.jsx`, `Accreditation.jsx`,
`Broadcast.jsx`, `Employment.jsx`, `JobPosts.jsx`, `Logs.jsx`,
`RoleManagement.jsx`, `UserManagement.jsx`, `Reports.jsx`, `Settings.jsx`.

Also scan for any remaining `eyebrow` or slogan headings not listed here and
apply the same rule.
