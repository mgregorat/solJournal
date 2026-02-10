import { NextRequest, NextResponse } from "next/server";
import { connect } from "puppeteer-real-browser";
import { Connection, PublicKey } from "@solana/web3.js";

export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 60 * 1000;
const holdingsCache = new Map<string, { ts: number; data: any }>();
const SOL_MINT = "So11111111111111111111111111111111111111112";

function toNum(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function getGmgnConfig() {
  // Use the exact values requested for the holdings endpoint.
  return {
    app_ver: "20260210-10922-984b7db",
    client_id: "gmgn_web_20260210-10922-984b7db",
    device_id: "797ada39-37b1-46c2-8e8a-f813ac27ebad",
    fp_did: "ffaa653dc5d83387b22ee019166ad927",
  };
}

export async function GET(req: NextRequest) {
  let browser: any;
  try {
    const { searchParams } = new URL(req.url);
    const walletAddress = searchParams.get("walletAddress");

    if (!walletAddress) {
      return NextResponse.json({ error: "walletAddress is required" }, { status: 400 });
    }

    const cached = holdingsCache.get(walletAddress);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      const cachedSolBalance = toNum(cached.data?.solBalance);
      const cachedSolUsdValue = toNum(cached.data?.solUsdValue);
      const hasIncompleteSolPricing = cachedSolBalance > 0 && cachedSolUsdValue === 0;
      if (!hasIncompleteSolPricing) {
        return NextResponse.json(cached.data);
      }
    }

    const config = getGmgnConfig();
    const holdingsUrl =
      `https://gmgn.ai/pf/api/v1/wallet/sol/${walletAddress}/holdings` +
      `?device_id=${config.device_id}` +
      `&fp_did=${config.fp_did}` +
      `&client_id=${config.client_id}` +
      `&from_app=gmgn` +
      `&app_ver=${config.app_ver}` +
      `&tz_name=America%2FNew_York` +
      `&tz_offset=-18000` +
      `&app_lang=en-US` +
      `&os=web` +
      `&worker=0` +
      `&limit=50` +
      `&order_by=last_active_timestamp` +
      `&direction=desc` +
      `&hide_airdrop=false` +
      `&hide_abnormal=false` +
      `&hide_closed=true` +
      `&sellout=true` +
      `&showsmall=true`;

    const { page, browser: browserInstance } = await connect({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      turnstile: true,
    });
    browser = browserInstance;

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    );

    // Establish browser session/cookies on GMGN before API fetch.
    await page.goto(`https://gmgn.ai/sol/wallet/${walletAddress}`, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    const gmgnJson = await page.evaluate(async (url) => {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`GMGN holdings fetch failed with status ${res.status}`);
      }
      return await res.json();
    }, holdingsUrl);

    const rawTokens: any[] =
      gmgnJson?.data?.holdings ||
      gmgnJson?.data?.tokens ||
      gmgnJson?.data?.list ||
      gmgnJson?.data?.items ||
      (Array.isArray(gmgnJson?.data) ? gmgnJson.data : []) ||
      [];

    let solBalance = 0;
    let solPriceUsd = 0;
    const holdings = rawTokens.map((token) => {
      const tokenSymbol = token?.token?.symbol || token?.symbol || "UNKNOWN";
      const tokenAddress =
        token?.token?.token_address ||
        token?.token?.address ||
        token?.address ||
        token?.mint ||
        null;
      const balance = toNum(token?.balance ?? token?.amount);
      const priceUsd = toNum(
        token?.price ??
          token?.price_usd ??
          token?.token?.price
      );
      const avgEntryPrice = (() => {
        const direct = toNum(token?.avg_price ?? token?.avg_entry_price);
        if (direct > 0) return direct;
        const accuAmount = toNum(token?.accu_amount);
        const accuCost = toNum(token?.accu_cost);
        if (accuAmount > 0 && accuCost > 0) return accuCost / accuAmount;
        const boughtAmount = toNum(token?.history_bought_amount);
        const boughtCost = toNum(token?.history_bought_cost);
        if (boughtAmount > 0 && boughtCost > 0) return boughtCost / boughtAmount;
        return 0;
      })();
      const valueUsd = toNum(token?.usd_value ?? token?.value_usd ?? balance * priceUsd);

      const isSolLike =
        tokenAddress === SOL_MINT ||
        tokenSymbol === "SOL" ||
        tokenSymbol === "WSOL";

      if (isSolLike) {
        solBalance = Math.max(solBalance, balance);
        if (priceUsd > 0) {
          solPriceUsd = priceUsd;
        }
        if (!solPriceUsd && balance > 0 && valueUsd > 0) {
          solPriceUsd = valueUsd / balance;
        }
      }

      return {
        tokenSymbol,
        tokenAddress,
        balance,
        valueUsd,
        priceUsd,
        avgEntryPrice,
      };
    });

    if (!solBalance) {
      solBalance = toNum(
        gmgnJson?.data?.sol_balance ??
          gmgnJson?.data?.solBalance ??
          gmgnJson?.data?.native_balance ??
          gmgnJson?.data?.native_sol_balance ??
          gmgnJson?.data?.wallet_balance ??
          gmgnJson?.data?.wallet?.sol_balance ??
          gmgnJson?.data?.wallet?.native_balance ??
          gmgnJson?.data?.wallet?.sol ??
          gmgnJson?.data?.wallet?.balance
      );
    }

    if (!solPriceUsd) {
      solPriceUsd = toNum(
        gmgnJson?.data?.price_per_sol ??
          gmgnJson?.data?.sol_price ??
          gmgnJson?.data?.solPrice ??
          gmgnJson?.data?.wallet?.price_per_sol ??
          gmgnJson?.data?.wallet?.sol_price
      );
    }

    if (!solPriceUsd) {
      try {
        const solscanPrice = await page.evaluate(async (wallet) => {
          const url = `https://api-v2.solscan.io/v2/account?address=${wallet}&view_as=account`;
          const res = await fetch(url, {
            headers: { Accept: "application/json, text/plain, */*" },
          });
          if (!res.ok) return 0;
          const data = await res.json();
          return Number(
            data?.metadata?.tokens?.So11111111111111111111111111111111111111112?.price_usdt || 0
          );
        }, walletAddress);
        if (Number.isFinite(solscanPrice) && solscanPrice > 0) {
          solPriceUsd = solscanPrice;
        }
      } catch (priceErr) {
        console.warn("Solscan price fallback failed:", priceErr);
      }
    }

    if (!solPriceUsd) {
      try {
        const cgRes = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd",
          { cache: "no-store" }
        );
        if (cgRes.ok) {
          const cgJson = await cgRes.json();
          const cgPrice = Number(cgJson?.solana?.usd || 0);
          if (Number.isFinite(cgPrice) && cgPrice > 0) {
            solPriceUsd = cgPrice;
          }
        }
      } catch (cgErr) {
        console.warn("CoinGecko price fallback failed:", cgErr);
      }
    }

    if (!solBalance) {
      try {
        const rpcCandidates = [
          process.env.SOLANA_RPC_URL,
          process.env.NEXT_PUBLIC_HELIUS_API_KEY
            ? `https://mainnet.helius-rpc.com/?api-key=${process.env.NEXT_PUBLIC_HELIUS_API_KEY}`
            : null,
          "https://api.mainnet-beta.solana.com",
        ].filter((v): v is string => !!v);

        for (const rpcUrl of rpcCandidates) {
          try {
            const connection = new Connection(rpcUrl, "confirmed");
            const lamports = await connection.getBalance(new PublicKey(walletAddress));
            const rpcSol = lamports / 1_000_000_000;
            if (rpcSol > 0) {
              solBalance = rpcSol;
              break;
            }
          } catch (innerError) {
            console.warn(`SOL RPC fallback failed for ${rpcUrl}:`, innerError);
          }
        }
      } catch (rpcError) {
        console.warn("Failed SOL RPC fallback:", rpcError);
      }
    }

    const solUsdValue = solBalance > 0 && solPriceUsd > 0 ? solBalance * solPriceUsd : 0;

    const responsePayload = {
      walletAddress,
      solBalance,
      solPriceUsd,
      solUsdValue,
      holdings,
      raw: gmgnJson,
    };

    // Avoid caching empty snapshots so transient responses don't get sticky.
    if ((holdings.length > 0 || solBalance > 0) && !(solBalance > 0 && solUsdValue === 0)) {
      holdingsCache.set(walletAddress, { ts: Date.now(), data: responsePayload });
    }
    return NextResponse.json(responsePayload);
  } catch (error: any) {
    console.error("GMGN holdings route error:", error);
    return NextResponse.json(
      { error: "Failed to fetch live holdings", details: error?.message || "Unknown error" },
      { status: 500 }
    );
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
