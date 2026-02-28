# Product Requirements Document: SplitEase — Expense Splitting Web Application

**Version:** 1.0
**Author:** Ayush
**Date:** February 28, 2026
**Status:** Draft

---

## 1. Executive Summary

SplitEase is a web application that simplifies shared expense management among groups of people — roommates, travel companions, friends, couples, and coworkers. Users can record expenses, split them in various ways, and settle debts with minimal transactions. The application aims to eliminate the awkwardness and complexity of tracking who owes whom, providing a clean, real-time view of balances and a frictionless settlement experience.

---

## 2. Problem Statement

Splitting expenses among groups is a common, recurring need — whether it's rent, group trips, dinners, or shared subscriptions. Currently, people resort to mental math, spreadsheets, or scattered messaging, leading to forgotten debts, disputes, and social friction. Existing solutions like Splitwise have proven market demand, but there is room for a modern, open-source, developer-friendly alternative with better UX, faster performance, and no paywalled features.

---

## 3. Goals & Objectives

**Primary Goals:**

- Allow users to easily log, split, and track shared expenses in real time.
- Minimize the number of transactions needed to settle all debts within a group (debt simplification).
- Provide a clean, intuitive interface that works seamlessly on desktop and mobile browsers.

**Secondary Goals:**

- Support multiple currencies and exchange rate conversion.
- Enable integration with payment gateways for in-app settlements.
- Offer export/reporting capabilities for personal finance tracking.

**Success Metrics:**

| Metric | Target |
|---|---|
| User registration → first expense logged | < 2 minutes |
| Monthly Active Users (MAU) | 10,000 within 6 months of launch |
| Average group size | 3–8 members |
| User retention (30-day) | > 40% |
| App load time (LCP) | < 1.5 seconds |

---

## 4. Target Audience

| Persona | Description |
|---|---|
| **Roommates** | 2–5 people sharing rent, groceries, and utilities monthly. |
| **Travel Groups** | Friends or family splitting trip costs (hotels, transport, food). |
| **Couples** | Partners tracking shared household spending. |
| **Event Organizers** | People coordinating group dinners, parties, or outings. |
| **Coworkers** | Small teams splitting lunch, office supplies, or team outing costs. |

---

## 5. User Stories

### 5.1 Authentication & Onboarding

- As a new user, I want to sign up with email/Google/GitHub so I can get started quickly.
- As a returning user, I want to log in securely and see my dashboard immediately.
- As a user, I want to set my default currency and display name during onboarding.

### 5.2 Groups

- As a user, I want to create a group and invite members via email or shareable link.
- As a user, I want to see all my groups on a dashboard with a quick summary of what I owe or am owed.
- As a group admin, I want to add/remove members and edit group settings.
- As a user, I want to leave a group once my balance is settled.

### 5.3 Expenses

- As a user, I want to add an expense and specify who paid and how it should be split.
- As a user, I want to split an expense equally, by exact amounts, by percentages, or by shares.
- As a user, I want to attach a receipt image or note to an expense for reference.
- As a user, I want to edit or delete an expense I previously added.
- As a user, I want to add a recurring expense (e.g., monthly rent) that auto-logs.
- As a user, I want to categorize expenses (food, transport, rent, entertainment, etc.).

### 5.4 Balances & Settlements

- As a user, I want to see a simplified view of who owes whom in my group (debt simplification).
- As a user, I want to record a payment/settlement between two members.
- As a user, I want to see my total balance across all groups on my dashboard.
- As a user, I want to settle up via UPI / PayPal / bank transfer and mark it as paid.

### 5.5 Notifications & Activity

- As a user, I want to receive notifications when an expense is added to my group.
- As a user, I want to see an activity feed/log of all transactions in a group.
- As a user, I want to receive reminders for unsettled debts.

### 5.6 Reporting & Export

- As a user, I want to filter expenses by date range, category, or member.
- As a user, I want to export my group's expense history as CSV or PDF.
- As a user, I want to see monthly spending charts and category breakdowns.

---

## 6. Feature Breakdown & Prioritization

### Phase 1 — MVP (Weeks 1–8)

| Feature | Priority |
|---|---|
| User authentication (email + OAuth) | P0 |
| Create/join groups with invite links | P0 |
| Add expenses with equal split | P0 |
| Dashboard with group balances | P0 |
| Debt simplification algorithm | P0 |
| Record settlements manually | P0 |
| Activity feed per group | P0 |
| Responsive web UI | P0 |

### Phase 2 — Enhanced Splitting & UX (Weeks 9–14)

| Feature | Priority |
|---|---|
| Split by percentage / exact amounts / shares | P1 |
| Expense categories and tags | P1 |
| Receipt image upload | P1 |
| Email/push notifications | P1 |
| Edit/delete expenses with audit trail | P1 |
| Search and filter expenses | P1 |
| User profile and settings | P1 |

### Phase 3 — Advanced Features (Weeks 15–22)

| Feature | Priority |
|---|---|
| Multi-currency support with FX conversion | P2 |
| Recurring expenses | P2 |
| Export to CSV/PDF | P2 |
| Spending analytics and charts | P2 |
| Payment gateway integration (UPI, PayPal) | P2 |
| Dark mode | P2 |
| PWA support for mobile install | P2 |

---

## 7. Technical Architecture

### 7.1 Tech Stack (Recommended)

| Layer | Technology |
|---|---|
| **Frontend** | Next.js (React) + TypeScript + Tailwind CSS |
| **Backend** | Node.js (Express or tRPC) / alternatively Next.js API routes |
| **Database** | PostgreSQL (relational, strong for financial data) |
| **ORM** | Prisma |
| **Authentication** | NextAuth.js (OAuth + credentials) |
| **File Storage** | AWS S3 / Cloudflare R2 (receipt images) |
| **Real-time** | WebSockets or Server-Sent Events (for live updates) |
| **Hosting** | Vercel (frontend) + Railway/Render (backend + DB) |
| **CI/CD** | GitHub Actions |
| **Monitoring** | Sentry (errors) + PostHog (analytics) |

### 7.2 High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────┐
│                  Client (Browser)                │
│           Next.js + React + Tailwind             │
└──────────────────────┬──────────────────────────┘
                       │ HTTPS / WSS
                       ▼
┌─────────────────────────────────────────────────┐
│              API Layer (Next.js / Express)       │
│         Authentication │ Business Logic          │
│         Debt Engine    │ Notification Service    │
└──────┬──────────┬──────────┬────────────────────┘
       │          │          │
       ▼          ▼          ▼
┌──────────┐ ┌────────┐ ┌──────────────┐
│ PostgreSQL│ │  S3/R2 │ │ Email/Push   │
│ (Primary │ │(Images)│ │ Service      │
│  Store)  │ │        │ │ (SendGrid)   │
└──────────┘ └────────┘ └──────────────┘
```

### 7.3 Core Data Model

```
User
├── id (UUID, PK)
├── name
├── email (unique)
├── avatar_url
├── default_currency
└── created_at

Group
├── id (UUID, PK)
├── name
├── description
├── created_by → User.id
├── invite_code (unique)
└── created_at

GroupMember
├── group_id → Group.id
├── user_id → User.id
├── role (admin | member)
└── joined_at

Expense
├── id (UUID, PK)
├── group_id → Group.id
├── description
├── amount (DECIMAL)
├── currency
├── category
├── paid_by → User.id
├── split_type (equal | exact | percentage | shares)
├── receipt_url
├── is_recurring (BOOLEAN)
├── recurrence_rule (JSONB, nullable)
├── created_by → User.id
└── created_at

ExpenseSplit
├── id (UUID, PK)
├── expense_id → Expense.id
├── user_id → User.id
├── owed_amount (DECIMAL)
└── paid_amount (DECIMAL, default 0)

Settlement
├── id (UUID, PK)
├── group_id → Group.id
├── from_user → User.id
├── to_user → User.id
├── amount (DECIMAL)
├── currency
├── payment_method
├── note
└── created_at
```

### 7.4 Debt Simplification Algorithm

The core algorithm minimizes the number of transactions needed to settle all debts within a group.

**Approach:** Net balance calculation → greedy matching of max creditor with max debtor.

```
1. For each member, calculate net_balance = total_paid - total_owed
2. Separate into creditors (net_balance > 0) and debtors (net_balance < 0)
3. Sort both lists by absolute value (descending)
4. Match the largest debtor with the largest creditor:
   - Transfer min(|debtor_balance|, creditor_balance)
   - Update both balances
   - Remove anyone with balance = 0
5. Repeat until all balances are zero
```

This reduces an O(n²) pairwise debt graph into at most (n-1) transactions.

---

## 8. API Endpoints (RESTful)

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login with credentials |
| GET | `/api/auth/me` | Get current user profile |

### Groups
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/groups` | Create a new group |
| GET | `/api/groups` | List user's groups |
| GET | `/api/groups/:id` | Get group details + balances |
| PUT | `/api/groups/:id` | Update group settings |
| POST | `/api/groups/:id/join` | Join via invite code |
| DELETE | `/api/groups/:id/members/:userId` | Remove member |

### Expenses
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/groups/:id/expenses` | Add expense |
| GET | `/api/groups/:id/expenses` | List expenses (with filters) |
| PUT | `/api/expenses/:id` | Update expense |
| DELETE | `/api/expenses/:id` | Delete expense |

### Settlements
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/groups/:id/settlements` | Record a settlement |
| GET | `/api/groups/:id/settlements` | List settlements |
| GET | `/api/groups/:id/balances` | Get simplified debts |

### Export
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/groups/:id/export?format=csv` | Export as CSV |
| GET | `/api/groups/:id/export?format=pdf` | Export as PDF |

---

## 9. UI/UX Wireframe Overview

### Key Screens

**1. Dashboard**
- Summary cards: total you owe, total owed to you, net balance.
- List of groups with mini balance indicators (green = owed, red = owe).
- Quick-add expense FAB (floating action button).

**2. Group Detail**
- Header: group name, member avatars, settings gear icon.
- Tabs: Expenses | Balances | Activity.
- Expense list with date, description, payer, amount, and split icons.
- "Settle Up" CTA showing simplified debts.

**3. Add Expense Modal/Page**
- Fields: description, amount, paid by (dropdown), split among (multi-select), split type toggle.
- Optional: category picker, receipt upload, notes, date override.

**4. Settle Up Flow**
- Shows simplified debt list (e.g., "You owe Alice ₹500").
- "Record Payment" button → select method → confirm → done.

**5. Analytics Page**
- Monthly spending bar chart.
- Category-wise pie chart.
- Top spenders in group.

---

## 10. Non-Functional Requirements

| Requirement | Specification |
|---|---|
| **Performance** | Page load < 1.5s (LCP), API response < 200ms (p95) |
| **Scalability** | Support 50,000 users, 500 concurrent sessions |
| **Security** | HTTPS everywhere, bcrypt password hashing, JWT tokens with refresh rotation, CSRF protection, input sanitization |
| **Availability** | 99.9% uptime SLA |
| **Data Privacy** | GDPR-compliant, user data export/deletion on request |
| **Accessibility** | WCAG 2.1 AA compliant |
| **Browser Support** | Chrome, Firefox, Safari, Edge (last 2 versions) |
| **Mobile** | Fully responsive; PWA-installable |

---

## 11. Security Considerations

- All financial calculations performed server-side to prevent tampering.
- Rate limiting on authentication and expense creation endpoints.
- Row-level security: users can only access groups they belong to.
- Audit log for all expense edits and deletions (soft delete with history).
- Receipt images scanned for malware before storage.
- Environment secrets managed via encrypted vault (e.g., Doppler, AWS Secrets Manager).

---

## 12. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Floating-point precision errors in financial calculations | Incorrect balances | Use DECIMAL type in DB; integer-based cents in application logic |
| Users dispute an expense | Trust issues, churn | Audit trail + edit history; optional "approve expense" flow in Phase 3 |
| Low adoption due to network effects | Growth stalls | Invite-link onboarding; allow non-registered users to view balances |
| Currency conversion rate fluctuations | Inaccurate cross-currency splits | Lock FX rate at time of expense; use reliable API (Open Exchange Rates) |
| Data loss | User trust destroyed | Daily automated backups; point-in-time recovery enabled |

---

## 13. Future Roadmap (Post-Launch)

- **Mobile Apps:** Native iOS and Android apps (React Native or Flutter).
- **AI Receipt Scanner:** OCR to auto-fill expense details from receipt photos.
- **Smart Suggestions:** ML-based category auto-tagging and spending insights.
- **Group Templates:** Pre-built templates for trips, roommates, events.
- **Expense Approval Workflow:** Optional approval before an expense counts.
- **Integration:** Sync with bank accounts, Google Sheets, or accounting tools.
- **Open API:** Public API for third-party integrations and developer ecosystem.

---

## 14. Timeline Summary

| Phase | Duration | Deliverable |
|---|---|---|
| Phase 1 — MVP | Weeks 1–8 | Core app: auth, groups, expenses, equal split, balances, settlements |
| Phase 2 — Enhanced | Weeks 9–14 | Advanced splits, categories, receipts, notifications, search |
| Phase 3 — Advanced | Weeks 15–22 | Multi-currency, recurring expenses, analytics, payments, PWA |
| Beta Launch | Week 23 | Public beta with feedback collection |
| GA Launch | Week 26 | Production release |

---

## 15. Appendix

### A. Glossary

- **Expense:** A recorded cost paid by one or more group members.
- **Split:** The division of an expense among group members.
- **Settlement:** A payment made to reduce or clear a debt between two users.
- **Debt Simplification:** An algorithm that reduces the total number of transactions needed to settle all debts.
- **Net Balance:** The difference between what a user has paid and what they owe.

### B. References

- Splitwise — prior art and UX inspiration.
- Tricount — European alternative with strong group travel features.
- Settle Up — offline-first approach reference.

---

*This document is a living artifact and will be updated as the product evolves through design reviews, technical spikes, and user feedback.*