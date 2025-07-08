import { supabaseAdmin } from '@/app/lib/supabaseAdmin';

export async function getTrades(walletAddress: string) {
    if (!walletAddress) {
        return [];
    }

    try {
        const { data: trades, error } = await supabaseAdmin
            .from('trades')
            .select('*')
            .eq('wallet_address', walletAddress)
            .order('trade_date', { ascending: false });

        if (error) {
            console.error('Error fetching trades:', error);
            throw new Error(error.message);
        }

        return trades || [];
    } catch (error: any) {
        console.error("Caught error in getTrades:", error);
        throw error;
    }
} 