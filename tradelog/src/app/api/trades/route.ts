import { supabaseAdmin } from '@/app/lib/supabaseAdmin';
import { NextRequest } from 'next/server';
import { requireOwnedWallet, requireUser } from '@/app/lib/authorization';
import { throwHttp, withTiming } from '@/app/lib/http';

// This API route uses the admin client to bypass RLS for MVP development.
// When real authentication is added, we will revisit RLS and client usage.

type TradeSortField = 'trade_date' | 'total_value_usd' | 'realized_pnl_usd';
type SortDirection = 'asc' | 'desc';
type TradeTypeFilter = 'buy' | 'sell' | 'all';
type JournaledFilter = 'all' | 'journaled' | 'unjournaled';

type TradeCursor = {
  offset: number;
};

type TradeRow = {
  id: number;
  wallet_id: number | null;
  wallet_address: string;
  token_symbol: string;
  token_address: string;
  trade_type: 'buy' | 'sell';
  amount: number;
  price: number;
  total_value: number;
  trade_date: string;
  source: string;
  transaction_hash: string;
};

type TradeListItem = {
  id: number;
  wallet_id: number | null;
  wallet_address: string;
  token_symbol: string;
  token_address: string;
  trade_type: 'buy' | 'sell';
  amount: number;
  price: number;
  total_value: number;
  total_value_usd: number;
  trade_date: string;
  source: string;
  transaction_hash: string;
  realized_pnl_usd: number | null;
  is_journaled: boolean;
};

function encodeCursor(cursor: TradeCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

function decodeCursor(value: string | null): TradeCursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as TradeCursor;
    if (typeof parsed.offset !== 'number' || parsed.offset < 0) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function parseSortField(value: string | null): TradeSortField {
  if (value === 'total_value_usd' || value === 'realized_pnl_usd' || value === 'trade_date') {
    return value;
  }
  return 'trade_date';
}

function parseSortDirection(value: string | null): SortDirection {
  return value === 'asc' ? 'asc' : 'desc';
}

function parseTradeType(value: string | null): TradeTypeFilter {
  if (value === 'buy' || value === 'sell' || value === 'all') return value;
  return 'all';
}

function parseJournaled(value: string | null): JournaledFilter {
  if (value === 'journaled' || value === 'unjournaled' || value === 'all') return value;
  return 'all';
}

function parseLimit(value: string | null): number {
  if (!value) return 50;
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) return 50;
  return Math.min(parsed, 200);
}

function getSortColumn(field: TradeSortField): 'trade_date' | 'total_value' {
  if (field === 'trade_date') return 'trade_date';
  return 'total_value';
}

function mapTradeRowToListItem(row: TradeRow, isJournaled: boolean): TradeListItem {
  const totalValueUsd = Number(row.total_value || 0);
  return {
    id: row.id,
    wallet_id: row.wallet_id,
    wallet_address: row.wallet_address,
    token_symbol: row.token_symbol,
    token_address: row.token_address,
    trade_type: row.trade_type,
    amount: Number(row.amount || 0),
    price: Number(row.price || 0),
    total_value: totalValueUsd,
    total_value_usd: totalValueUsd,
    trade_date: row.trade_date,
    source: row.source,
    transaction_hash: row.transaction_hash,
    realized_pnl_usd: null,
    is_journaled: isJournaled,
  };
}

export async function GET(req: NextRequest) {
    return withTiming(req, async () => {
        const { searchParams } = new URL(req.url);
        const walletIdParam = searchParams.get('walletId');
        const walletAddressParam = searchParams.get('walletAddress');
        const q = searchParams.get('q')?.trim() || null;
        const type = parseTradeType(searchParams.get('type'));
        const journaled = parseJournaled(searchParams.get('journaled'));
        const dateFrom = searchParams.get('dateFrom');
        const dateTo = searchParams.get('dateTo');
        const sortField = parseSortField(searchParams.get('sort'));
        const sortDirection = parseSortDirection(searchParams.get('dir'));
        const limit = parseLimit(searchParams.get('limit'));
        const cursor = decodeCursor(searchParams.get('cursor'));
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

        if (dateFrom) {
            const parsed = new Date(dateFrom);
            if (Number.isNaN(parsed.getTime())) {
                throwHttp("bad_request", "Invalid dateFrom format", 400);
            }
        }
        if (dateTo) {
            const parsed = new Date(dateTo);
            if (Number.isNaN(parsed.getTime())) {
                throwHttp("bad_request", "Invalid dateTo format", 400);
            }
        }

        const sortColumn = getSortColumn(sortField);
        const ascending = sortDirection === 'asc';
        const pageSize = limit + 1;
        const collectedItems: TradeListItem[] = [];
        let offset = cursor?.offset ?? 0;
        let hasMore = false;
        let safety = 0;

        while (collectedItems.length < limit && safety < 8) {
            safety += 1;
            let query = supabaseAdmin
                .from('trades')
                .select('id, wallet_id, wallet_address, token_symbol, token_address, trade_type, amount, price, total_value, trade_date, source, transaction_hash')
                .eq('user_id', dbUser.id)
                .order(sortColumn, { ascending })
                .order('id', { ascending })
                .range(offset, offset + pageSize - 1);

            if (ownedWalletId !== null) {
                query = query.eq('wallet_id', ownedWalletId);
            }

            if (type !== 'all') {
                query = query.eq('trade_type', type);
            }

            if (q) {
                const escaped = q.replace(/,/g, '').replace(/\*/g, '').replace(/%/g, '');
                query = query.or(`token_symbol.ilike.%${escaped}%,token_address.ilike.%${escaped}%`);
            }

            if (dateFrom) {
                query = query.gte('trade_date', new Date(dateFrom).toISOString());
            }
            if (dateTo) {
                const endOfDay = new Date(dateTo);
                endOfDay.setHours(23, 59, 59, 999);
                query = query.lte('trade_date', endOfDay.toISOString());
            }

            const { data: rows, error } = await query;
            if (error) {
                throwHttp("internal_error", "Failed to fetch trades", 500);
            }

            const trades = (rows || []) as TradeRow[];
            if (trades.length === 0) {
                hasMore = false;
                break;
            }

            hasMore = trades.length > limit;
            const pageRows = hasMore ? trades.slice(0, limit) : trades;
            offset += trades.length;

            const txHashes = pageRows
              .map((trade) => trade.transaction_hash)
              .filter((hash): hash is string => typeof hash === 'string' && hash.length > 0);

            let journaledByTxHash = new Set<string>();
            if (txHashes.length > 0) {
              const { data: journalRows, error: journalError } = await supabaseAdmin
                .from('journal_entries')
                .select('tx_hash, is_journaled')
                .eq('user_id', dbUser.id)
                .in('tx_hash', txHashes);

              if (journalError) {
                throwHttp("internal_error", "Failed to fetch journal status", 500);
              }

              const journalRowsTyped = (journalRows || []) as Array<{ tx_hash: string | null; is_journaled: boolean | null }>;
              journaledByTxHash = new Set(
                journalRowsTyped
                  .filter((row) => Boolean(row.tx_hash) && Boolean(row.is_journaled))
                  .map((row) => row.tx_hash as string)
              );
            }

            const normalized = pageRows
              .map((row) => mapTradeRowToListItem(row, journaledByTxHash.has(row.transaction_hash)))
              .filter((item) => {
                if (journaled === 'journaled') return item.is_journaled;
                if (journaled === 'unjournaled') return !item.is_journaled;
                return true;
              });

            collectedItems.push(...normalized);

            if (!hasMore) {
              break;
            }
        }

        const items = collectedItems.slice(0, limit);
        const nextCursor = hasMore ? encodeCursor({ offset }) : null;

        return {
          items,
          nextCursor,
          hasMore: Boolean(nextCursor),
          limit,
          sort: sortField,
          dir: sortDirection,
        };
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
        
        type TradeInsertRow = {
            user_id: number;
            wallet_id: number;
            wallet_address: string;
            token_symbol: string;
            token_address: string;
            trade_type: string;
            amount: number;
            price: number;
            total_value: number;
            trade_date: string;
            notes?: string;
            emotion_tags?: string[];
            source?: string;
            setup_id?: number;
        };

        const tradeToInsert: TradeInsertRow = {
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
