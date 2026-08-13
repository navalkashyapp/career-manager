# Career Manager - Principal Architectural Blueprint

## 1. Project Architecture & Component Design

### 1.1 Folder Structure (Feature-Sliced Design)
To prevent the codebase from becoming a "big ball of mud", we mandate a **Feature-Based Architecture**. Code must be collocated by business domain rather than technical function.

```text
src/
├── app/                  # Application initialization (Router, Global Providers)
├── assets/               # Static assets (images, fonts, global CSS)
├── components/           # Generic, reusable UI components (e.g., Shadcn UI)
├── config/               # Environment variables and core config (Firebase init)
├── features/             # Feature-specific modules (Domain-driven)
│   ├── dashboard/        # e.g., components/, hooks/, api/, types/, utils/
│   ├── kanban/
│   ├── mail/
│   ├── profile/
│   └── resume-studio/
├── hooks/                # Generic, shared hooks (NOT feature-specific)
├── lib/                  # Third-party wrapper configurations (e.g., axios, queryClient)
├── store/                # Global client state (Zustand, if necessary)
├── types/                # Shared global TypeScript definitions
└── utils/                # Pure utility functions (formatters, parsers)
```

### 1.2 Component Design & Separation of Concerns
- **Presentational vs. Container:** UI components must be purely presentational, receiving data via props and emitting events via callbacks. Business logic, data fetching, and state management must be encapsulated within custom hooks or container components.
- **Props & TypeScript:** `any` is strictly prohibited. All component props must be defined via explicit TypeScript `interface` or `type` definitions.
- **Collocation:** If a component, hook, or type is only used within one feature, it **must** live inside that feature's directory, not in the global `/components` or `/types` folder.

---

## 2. Code Quality & Enforcement Automation

### 2.1 Static Analysis (ESLint & Prettier)
- **Prettier:** Must be the single source of truth for code formatting.
- **ESLint:** Must enforce React best practices. Required plugins:
  - `eslint-plugin-react-hooks` (Exhaustive deps rule is treated as an error).
  - `@typescript-eslint/recommended` (Strict typing rules).
  - `eslint-plugin-import` (Enforce import sorting and prevent absolute imports where relative is appropriate).

### 2.2 TypeScript Configuration
TypeScript must run in **Strict Mode**. The following `tsconfig.json` compiler options are mandatory:
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

### 2.3 Automated Enforcement (Husky & lint-staged)
Code quality must be enforced *before* CI/CD. The project requires:
- **Husky** configured for the `pre-commit` hook.
- **lint-staged** configured to run Prettier formatting and ESLint auto-fixing on staged files.
- A `pre-push` hook that runs `tsc --noEmit` and the unit test suite to ensure no broken builds are pushed.

---

## 3. Performance & Data Handling Best Practices

### 3.1 Data Fetching & Caching (TanStack Query)
- **Deprecate Global Context Data Stores:** The current monolithic `useData` context causes massive over-fetching and unnecessary re-renders. 
- **Mandate TanStack Query (React Query):** All asynchronous data fetching, caching, and mutation must go through TanStack Query. This provides granular cache invalidation, out-of-the-box loading/error states, and optimistic UI updates without inflating local state.
- **Firebase Abstraction:** Firebase SDK calls should be abstracted behind API service functions or React Query hooks inside the respective feature's `api/` folder.

### 3.2 Performance & Rendering Optimization
- **Minimize Re-renders:** Use `useMemo` and `useCallback` appropriately for expensive computations (e.g., chart data transformations) and function references passed to memoized child components.
- **Code Splitting:** React Router must be configured to use lazy loading (`React.lazy` or Router DOM's `lazy` route prop) for all major feature routes. Do not bundle the entire application into a single JS chunk.

---

## 4. Testing & Observability Framework

### 4.1 The Testing Pyramid
- **Unit Testing (Vitest + React Testing Library):** Mandatory for all utility functions, custom hooks, and complex presentational components. Business logic should be tested in isolation.
- **Integration Testing:** Test the interaction between Container components and mocked API layers (Firebase/Express).
- **End-to-End (E2E) Testing (Playwright):** Core critical user journeys (e.g., Login, Moving a Kanban card, Generating a Resume) must be covered by Playwright tests running against a staging environment or Firebase Emulator.

### 4.2 Observability & Error Handling
- **Global Error Boundaries:** The application root and each major feature route must be wrapped in a React Error Boundary to prevent full app crashes and present graceful fallback UIs.
- **Telemetry:** Client-side exceptions should be logged to a centralized observability platform (e.g., Sentry, Datadog) to monitor application health in production. Empty catch blocks (`catch (e) {}`) are strictly forbidden.
