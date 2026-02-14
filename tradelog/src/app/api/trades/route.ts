import { supabaseAdmin } from '@/app/lib/supabaseAdmin';
import { NextRequest } from 'next/server';
import { Trade } from '@/lib/types';
import { requireOwnedWallet, requireUser } from '@/app/lib/authorization';
import { throwHttp, withTiming } from '@/app/lib/http';

// This API route uses the admin client to bypass RLS for MVP development.
// When real authentication is added, we will revisit RLS and client usage.

export async function GET(req: NextRequest) {
    return withTiming(req, async () => {
        const { searchParams } = new URL(req.url);
        const walletIdParam = searchParams.get('walletId');
        const walletAddressParam = searchParams.get('walletAddress');
        const dbUser = await requireUser(req);

        let parsedWalletId: number | null = null;
        if (walletIdParam && walletIdParam !== 'all') {
            parsedWalletId = parseInt(walletIdParam, 10);
            if (isNaN(parsedWalletId)) {
                throwHttp("bad_request", "Invalid walletId format", 400);
            }
        }

        let ownedWalletId: number | null = null;
        if (parsedWalletId !== null || walletAddressParam) {
            const ownedWallet = await requireOwnedWallet(
                req,
                dbUser,
                parsedWalletId,
                walletAddressParam
            );
            ownedWalletId = ownedWallet.id;
        }

        let query = supabaseAdmin
            .from('trades')
            .select('id, wallet_id, wallet_address, token_symbol, token_address, trade_type, amount, price, total_value, trade_date, source, transaction_hash')
            .eq('user_id', dbUser.id)
            .order('trade_date', { ascending: false });

        if (ownedWalletId !== null) {
            query = query.eq('wallet_id', ownedWalletId);
        }

        const { data: trades, error } = await query;

        if (error) {
            throwHttp("internal_error", "Failed to fetch trades", 500);
        }

        return trades || [];
    });
}

export async function POST(req: NextRequest) {
    return withTiming(req, async () => {
        const dbUser = await requireUser(req);
        const rawData = await req.json();
        const walletIdFromBody = rawData.walletId;
        const walletAddressFromBody = rawData.walletAddress ?? rawData.wallet_address;
        if (
            (walletIdFromBody === undefined || walletIdFromBody === null || walletIdFromBody === '') &&
            (!walletAddressFromBody || String(walletAddressFromBody).trim().length === 0)
        ) {
            throwHttp("bad_request", "walletId or walletAddress is required", 400);
        }

        const parsedWalletId =
            walletIdFromBody !== undefined && walletIdFromBody !== null && walletIdFromBody !== ''
                ? parseInt(String(walletIdFromBody), 10)
                : null;

        if (walletIdFromBody !== undefined && walletIdFromBody !== null && isNaN(parsedWalletId as number)) {
            throwHttp("bad_request", "Invalid walletId format", 400);
        }

        const ownedWallet = await requireOwnedWallet(
            req,
            dbUser,
            parsedWalletId,
            walletAddressFromBody
        );

        // Basic validation
        const requiredFields = ['token_symbol', 'token_address', 'trade_type', 'amount', 'price', 'total_value', 'trade_date'];
        for (const field of requiredFields) {
            if (!rawData[field]) {
                throwHttp("bad_request", `Missing required field: ${field}`, 400);
            }
        }

        const parsedTradeDate = new Date(rawData.trade_date);
        if (Number.isNaN(parsedTradeDate.getTime())) {
            throwHttp("bad_request", "Invalid trade_date format", 400);
        }
        const normalizedTradeDate = parsedTradeDate.toISOString();
        
        const tradeToInsert: Partial<Trade> & { user_id: number; wallet_id: number } = {
            user_id: dbUser.id,
            wallet_id: ownedWallet.id,
            wallet_address: ownedWallet.wallet_address,
            token_symbol: rawData.token_symbol,
            token_address: rawData.token_address,
            trade_type: rawData.trade_type,
            amount: rawData.amount,
            price: rawData.price,
            total_value: rawData.total_value,
            trade_date: normalizedTradeDate,
            notes: rawData.notes,
            emotion_tags: rawData.emotion_tags,
            source: rawData.source,
        };

        if (rawData.setup_id) {
            tradeToInsert.setup_id = rawData.setup_id;
        }

        const { data, error } = await supabaseAdmin
            .from('trades')
            .insert([tradeToInsert])
            .select()
            .single();

        if (error) {
            throwHttp("internal_error", "Failed to create trade", 500);
        }

        return { data: { trade: data }, init: { status: 201 } };
    });
} 
