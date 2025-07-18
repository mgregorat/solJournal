"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function formatTimestamp(timestamp: number) {
    return new Date(timestamp * 1000).toLocaleString();
}

function formatValue(value: number) {
    if (!value) return '$0.00';
    return `$${value.toFixed(2)}`;
}

export function SyncedTradesDisplay({ trades }: { trades: any[] }) {
    if (!trades || trades.length === 0) {
        return null;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Synced Trade History (from gmgn.ai)</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Token</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Value</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {trades.map((trade, index) => (
                            <TableRow key={`${trade.tx_hash}-${index}`}>
                                <TableCell>{formatTimestamp(trade.block_timestamp)}</TableCell>
                                <TableCell className="font-medium">{trade.token_symbol || 'N/A'}</TableCell>
                                <TableCell>
                                    <Badge variant={trade.type === 'buy' ? 'default' : 'destructive'}>
                                        {trade.type}
                                    </Badge>
                                </TableCell>
                                <TableCell>{trade.token_amount.toFixed(4)}</TableCell>
                                <TableCell>{formatValue(trade.usd_value)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
} 