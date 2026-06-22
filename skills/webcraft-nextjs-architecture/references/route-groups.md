# Route Groups Reference

> Authority: [nextjs.org/docs/app/building-your-application/routing/route-groups](https://nextjs.org/docs/app/building-your-application/routing/route-groups)

Route groups (directories wrapped in parentheses) let you organise routes and share layouts without affecting the URL path.

---

## Route group basics

| Directory | URL path | Notes |
|-----------|----------|-------|
| `app/(chat)/page.tsx` | `/` | Group name invisible in URL |
| `app/(chat)/history/page.tsx` | `/history` | |
| `app/(dashboard)/page.tsx` | `/` | Conflict! Two pages mapping to `/` |
| `app/(dashboard)/metrics/page.tsx` | `/metrics` | |

To avoid conflicts, use distinct paths within groups:

```
app/
├── (chat)/
│   ├── layout.tsx          ← Shared chat layout (nav, session)
│   ├── page.tsx            ← Maps to /
│   └── sessions/
│       └── [id]/
│           └── page.tsx    ← Maps to /sessions/[id]
│
├── (dashboard)/
│   ├── layout.tsx          ← Shared dashboard layout (sidebar, date range)
│   └── dashboard/
│       └── page.tsx        ← Maps to /dashboard
│
└── (app)/
    ├── layout.tsx          ← Shared app layout (generic nav)
    └── settings/
        └── page.tsx        ← Maps to /settings
```

---

## Shared layouts per section

Each route group can have its own `layout.tsx` that wraps only that group's pages. The root `app/layout.tsx` still wraps everything.

```tsx
// app/(chat)/layout.tsx — Server Component
import { NavIsland } from '@/components/NavIsland'

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="chat-layout">
      <NavIsland activeSection="chat" />
      <main>{children}</main>
    </div>
  )
}
```

```tsx
// app/(dashboard)/layout.tsx — Server Component
import { SidebarIsland } from '@/components/SidebarIsland'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dashboard-layout">
      <SidebarIsland />
      <main>{children}</main>
    </div>
  )
}
```

---

## Carbon UI Shell navigation

The Carbon UI Shell provides the top-level navigation structure. It must be a client island because Carbon components require `'use client'`:

```tsx
// app/components/NavIsland.tsx
'use client'
import { usePathname } from 'next/navigation'
import {
  Header,
  HeaderName,
  HeaderNavigation,
  HeaderMenuItem,
  SkipToContent,
} from '@carbon/react'

export function NavIsland({ activeSection }: { activeSection: string }) {
  const pathname = usePathname()

  return (
    <Header aria-label="MyApp">
      <SkipToContent />
      <HeaderName href="/" prefix="IBM">MyApp</HeaderName>
      <HeaderNavigation aria-label="Main navigation">
        <HeaderMenuItem href="/" isCurrentPage={pathname === '/'}>
          Chat
        </HeaderMenuItem>
        <HeaderMenuItem href="/dashboard" isCurrentPage={pathname.startsWith('/dashboard')}>
          Dashboard
        </HeaderMenuItem>
        <HeaderMenuItem href="/settings" isCurrentPage={pathname.startsWith('/settings')}>
          Settings
        </HeaderMenuItem>
      </HeaderNavigation>
    </Header>
  )
}
```

---

## Dynamic routes

```
app/(chat)/sessions/[id]/page.tsx     ← /sessions/abc123
app/(dashboard)/metrics/[period]/page.tsx  ← /metrics/7d
```

Access params in Server Components:

```tsx
// app/(chat)/sessions/[id]/page.tsx
export default async function SessionPage({ params }: { params: { id: string } }) {
  const session = await fetchSession(params.id)
  return <ChatIsland session={session} />
}
```

---

## Parallel routes (advanced)

Use `@slot` directories to render multiple pages simultaneously in the same layout — useful for split-screen dashboards:

```
app/(dashboard)/
├── layout.tsx
├── @metrics/
│   └── page.tsx     ← Renders in {metrics} slot
└── @logs/
    └── page.tsx     ← Renders in {logs} slot
```

```tsx
// app/(dashboard)/layout.tsx
export default function DashboardLayout({
  children,
  metrics,
  logs,
}: {
  children: React.ReactNode
  metrics: React.ReactNode
  logs: React.ReactNode
}) {
  return (
    <div className="dashboard-grid">
      {metrics}
      {logs}
    </div>
  )
}
```
