# Database Setup

To set up your Supabase database for TradeLog, follow these steps:

1.  **Create a new Supabase project:** If you haven't already, go to [supabase.com](https://supabase.com) and create a new project.

2.  **Get your database credentials:** In your Supabase project dashboard, navigate to **Project Settings** > **Database** to find your connection string and other credentials.

3.  **Set up environment variables:** Create a `.env.local` file in the `tradelog` directory of your project and add your Supabase credentials:

    ```
    NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
    NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
    SUPABASE_SERVICE_KEY=YOUR_SUPABASE_SERVICE_KEY
    ```

4.  **Run the database schema SQL:** The database schema has been updated to support multi-wallet functionality and remove Privy. Go to the **SQL Editor** in your Supabase dashboard, paste the entire content of the `database-schema.sql` file, and click **Run**. This will create the necessary tables (`wallets`, `trades`, `setups`, `tokens`) and configure them correctly.

5.  **Enable Row Level Security (RLS):** For security, it's crucial to enable RLS on your tables and define policies. The new schema links data to `auth.users(id)`, so you can create policies that allow users to only access their own data. 