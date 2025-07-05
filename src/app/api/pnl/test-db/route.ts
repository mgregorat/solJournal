import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Supabase URL and Service Key are required for database operations.');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export async function GET(req: NextRequest) {
  try {
    console.log('Testing database connection and tables...');
    
    // Test basic connection
    const { data: connectionTest, error: connectionError } = await supabase
      .from('trades') // Use existing table to test connection
      .select('*', { count: 'exact', head: true });

    if (connectionError) {
      console.error('Database connection error:', connectionError);
      return NextResponse.json({ 
        error: 'Database connection failed', 
        details: connectionError 
      }, { status: 500 });
    }

    console.log('Database connection successful');

    // Check if P&L tables exist
    const tables = ['daily_snapshots', 'transaction_classifications', 'portfolio_holdings_history'];
    const tableStatus: { [key: string]: any } = {};

    for (const table of tables) {
      try {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });
        
        if (error) {
          console.error(`Table ${table} error:`, error);
          tableStatus[table] = { exists: false, error: error.message };
        } else {
          console.log(`Table ${table} exists and accessible`);
          tableStatus[table] = { exists: true, count: count || 0 };
        }
      } catch (err: any) {
        console.error(`Table ${table} check failed:`, err);
        tableStatus[table] = { exists: false, error: err.message };
      }
    }

    return NextResponse.json({
      message: 'Database test completed',
      connection: 'successful',
      tables: tableStatus,
      environment: {
        supabaseUrl: supabaseUrl ? 'configured' : 'missing',
        supabaseServiceKey: supabaseServiceKey ? 'configured' : 'missing'
      }
    });

  } catch (error: any) {
    console.error('Database test error:', error);
    return NextResponse.json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    console.log('Creating P&L database tables...');
    
    return NextResponse.json({
      message: 'Database table creation must be done manually through Supabase dashboard',
      instructions: [
        '1. Go to your Supabase dashboard',
        '2. Navigate to SQL Editor',
        '3. Run the SQL commands from database-schema.sql',
        '4. Or copy the SQL from the setup guide',
        '5. The tables needed are: daily_snapshots, transaction_classifications, portfolio_holdings_history'
      ],
      sql_location: 'See database-schema.sql or P&L_SETUP.md for the complete SQL'
    });

  } catch (error: any) {
    console.error('Create tables error:', error);
    return NextResponse.json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
} 