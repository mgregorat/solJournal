require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Supabase URL and Service Key are required. Make sure they are in your .env.local file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function inspectJournalData() {
  try {
    const { data: users, error: usersError } = await supabase.from('users').select('id, privy_did, email');
    if (usersError) throw usersError;

    const { data: journalEntries, error: journalError } = await supabase.from('journal_entries').select('user_id, tx_hash, notes');
    if (journalError) throw journalError;

    console.log(`--- Database Inspection ---`);
    console.log(`Found ${users.length} user(s) and ${journalEntries.length} journal entry(s).\n`);

    if (journalEntries.length === 0) {
      console.log("The 'journal_entries' table is empty. No trades have been journaled yet.");
      return;
    }

    const entriesByUser = journalEntries.reduce((acc, entry) => {
      if (!acc[entry.user_id]) {
        acc[entry.user_id] = [];
      }
      acc[entry.user_id].push(entry);
      return acc;
    }, {});

    console.log("--- User Details & Their Journal Entries ---");
    users.forEach(user => {
      const userEntries = entriesByUser[user.id] || [];
      console.log(`\n[User ID: ${user.id}]`);
      console.log(`  - Privy DID: ${user.privy_did}`);
      console.log(`  - Email: ${user.email || 'N/A'}`);
      console.log(`  - Journal Entries: ${userEntries.length}`);
      userEntries.forEach(entry => {
        console.log(`    - TX Hash: ${entry.tx_hash} | Notes: "${entry.notes ? entry.notes.substring(0, 50) + '...' : 'No notes'}"`);
      });
    });

    const unlinkedEntries = Object.keys(entriesByUser).filter(userId => !users.some(u => u.id == userId));
    if (unlinkedEntries.length > 0) {
        console.log("\n--- WARNING: Journal Entries with no matching User ---");
        unlinkedEntries.forEach(userId => {
            console.log(`Entries for a user with ID ${userId} exist, but this user was not found in the 'users' table.`);
        });
    }


  } catch (error) {
    console.error('Error during database inspection:', error.message);
  }
}

inspectJournalData(); 