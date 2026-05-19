# Oracle SQL Runner AI

A modern, web-based Oracle SQL execution environment built with Next.js, React, TailwindCSS, and `node-oracledb`. 

## Features

- **Multiple Connections**: Manage multiple Oracle Database connections securely.
- **Modern SQL Editor**: Features Monaco Editor with syntax highlighting, formatting, and shortcut execution (`Ctrl+Enter`).
- **Dynamic Parameters**: Automatically detects bind variables (`:PARAM`) in your SQL queries and prompts a dynamic modal to enter values with types (Text, Number, Date, Timestamp, Boolean).
- **Data Grid**: View results in a highly interactive TanStack table with column resizing, sorting, filtering, and pagination.
- **Export Options**: Export query results to Excel (`.xlsx`), CSV, JSON, or copy to clipboard.
- **Execution History**: Keeps track of your executed queries locally, including execution time and status.
- **Dark Mode**: Sleek dark mode UI built with TailwindCSS.

## Technologies Used

- **Frontend**: Next.js 14+ (App Router), React, TailwindCSS, Zustand (State Management), Framer Motion, `@tanstack/react-table`, Monaco Editor, SheetJS (`xlsx`).
- **Backend**: Next.js API Routes, `oracledb` (Thin Mode - pure JavaScript driver, no Oracle Client required).
- **Icons**: Lucide React.

## Getting Started

### Prerequisites

- Node.js 18.x or later
- npm or yarn

### Installation

1. Clone the repository and navigate into the project directory:
   ```bash
   cd oracle-sql-runner
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment to Vercel

This project is fully ready to be deployed to Vercel. Because the `oracledb` module uses **Thin Mode** by default (since v6), it does NOT require native Oracle binaries (Instant Client) to be installed on the server. This makes it completely serverless-compatible!

1. Push your code to a GitHub repository.
2. Go to [Vercel](https://vercel.com/) and create a new project.
3. Import your GitHub repository.
4. Leave the default build commands (`npm run build`).
5. Click **Deploy**.

*Note: Since the API connects to an Oracle Database, ensure your database is accessible over the internet from Vercel's IP addresses, or use a secure tunnel / VPC peering if required by your network architecture.*

## Security Considerations

- **Connections**: Database credentials are saved in the browser's local storage (`localStorage`). This is useful for personal tools but keep in mind that they are not heavily encrypted.
- **SQL Execution**: The backend executes exactly what is sent from the frontend. Always use caution when executing DML/DDL statements.
- **Bind Variables**: Always use bind variables (`:PARAM`) for user inputs to prevent SQL Injection. The application handles this automatically.

## License

MIT License
