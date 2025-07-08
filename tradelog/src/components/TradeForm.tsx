"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { supabase } from "@/app/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Setup } from "@/lib/types";

export default function TradeForm() {
  const { publicKey } = useWallet();
  const [tokenAddress, setTokenAddress] = useState("");
  const [tradeType, setTradeType] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [price, setPrice] = useState("");
  const [tradeDate, setTradeDate] = useState(new Date().toISOString().slice(0, 16));
  const [notes, setNotes] = useState("");
  const [emotionTags, setEmotionTags] = useState("");
  const [setupId, setSetupId] = useState<number | null>(null);
  const [setups, setSetups] = useState<Setup[]>([]);
  const [message, setMessage] = useState("");

  // useEffect(() => {
  //   const fetchSetups = async () => {
  //     if (!user) return;
  //     const { data, error } = await supabase
  //       .from("setups")
  //       .select("*")
  //       .eq("user_id", user.id);

  //     if (error) {
  //       console.error("Error fetching setups:", error);
  //     } else {
  //       setSetups(data);
  //     }
  //   };
  //   fetchSetups();
  // }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicKey) {
      setMessage("Please connect your wallet.");
      return;
    }

    const totalValue = parseFloat(amount) * parseFloat(price);

    const tradeData = {
      wallet_address: publicKey.toBase58(),
      token_address: tokenAddress,
      token_symbol: "MANUAL", // Or fetch symbol, for now this is fine
      trade_type: tradeType,
      amount: parseFloat(amount),
      price: parseFloat(price),
      total_value: totalValue,
      trade_date: new Date(tradeDate).toISOString(),
      notes,
      emotion_tags: emotionTags.split(',').map(tag => tag.trim()).filter(Boolean),
      setup_id: setupId,
      source: "manual",
    };

    try {
      const response = await fetch('/api/trades', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tradeData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "An unknown error occurred");
      }
      
      setMessage("Trade logged successfully!");
      // Reset form
      setTokenAddress("");
      setAmount("");
      setPrice("");
      setNotes("");
      setEmotionTags("");
      setSetupId(null);

    } catch (error: any) {
      setMessage(`Error logging trade: ${error.message}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="tokenAddress">Token Address</Label>
        <Input
          id="tokenAddress"
          value={tokenAddress}
          onChange={(e) => setTokenAddress(e.target.value)}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="tradeType">Trade Type</Label>
          <Select
            onValueChange={(value: "buy" | "sell") => setTradeType(value)}
            defaultValue={tradeType}
          >
            <SelectTrigger id="tradeType">
              <SelectValue placeholder="Buy or Sell" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="buy">Buy</SelectItem>
              <SelectItem value="sell">Sell</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="amount">Amount</Label>
          <Input
            id="amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="price">Price (in SOL)</Label>
          <Input
            id="price"
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tradeDate">Trade Date</Label>
          <Input
            id="tradeDate"
            type="datetime-local"
            value={tradeDate}
            onChange={(e) => setTradeDate(e.target.value)}
            required
          />
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="setup">Strategy/Setup</Label>
        <Select onValueChange={(value) => setSetupId(Number(value))} disabled>
          <SelectTrigger id="setup">
            <SelectValue placeholder="Select a setup" />
          </SelectTrigger>
          <SelectContent>
            {setups.map((setup) => (
              <SelectItem key={setup.id} value={String(setup.id)}>
                {setup.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="emotionTags">Emotion Tags (comma-separated)</Label>
        <Input
          id="emotionTags"
          value={emotionTags}
          onChange={(e) => setEmotionTags(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Input
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>


      <Button type="submit" className="w-full">
        Log Trade
      </Button>
      {message && <p className="text-sm text-gray-400 text-center">{message}</p>}
    </form>
  );
}