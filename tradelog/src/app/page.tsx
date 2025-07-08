"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, CandlestickChart, BarChart, BookOpen, Link as LinkIcon, AlertTriangle, Send } from "lucide-react";

export default function LandingPage() {
  const { login, authenticated } = usePrivy();
  const router = useRouter();

  useEffect(() => {
    if (authenticated) {
      router.push("/dashboard");
    }
  }, [authenticated, router]);

  const features = [
    {
      icon: <LinkIcon className="h-8 w-8 text-green-400" />,
      title: "Wallet Integration",
      description: "Seamlessly connect your Solana wallet to automatically sync your trades.",
    },
    {
      icon: <BookOpen className="h-8 w-8 text-green-400" />,
      title: "Trade History Tracking",
      description: "View your complete trade history with detailed transaction information.",
    },
    {
      icon: <BarChart className="h-8 w-8 text-green-400" />,
      title: "Journaling & Performance Insights",
      description: "Add notes to your trades and gain valuable insights into your trading performance.",
    },
    {
      icon: <CandlestickChart className="h-8 w-8 text-gray-500" />,
      title: "PnL Visualization (Coming Soon)",
      description: "Visualize your profit and loss over time with interactive charts.",
    },
    {
        icon: <AlertTriangle className="h-8 w-8 text-gray-500" />,
        title: "Smart Narratives (Coming Soon)",
        description: "Get AI-powered insights and narratives for your trading patterns.",
    },
  ];

  return (
    <div className="bg-[#0B0C10] text-white min-h-screen flex flex-col">
      {/* Header */}
      <header className="p-4 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <CandlestickChart size={32} className="text-green-400" />
          <h1 className="text-2xl font-bold">Tradelog</h1>
        </div>
        <nav className="hidden md:flex items-center space-x-6">
          <Link href="#features" className="hover:text-green-400">Features</Link>
          <Link href="#cta" className="hover:text-green-400">Investors</Link>
        </nav>
        {authenticated ? (
          <Link href="/dashboard">
            <Button>Go to Dashboard</Button>
          </Link>
        ) : (
          <Button onClick={login}>Get Started</Button>
        )}
      </header>

      {/* Hero Section */}
      <main className="flex-grow flex flex-col items-center justify-center text-center p-4">
        <h2 className="text-5xl md:text-7xl font-bold tracking-tight mb-4">
          Your Memecoin Trade Journal, Reinvented
        </h2>
        <p className="text-lg md:text-xl text-gray-400 max-w-2xl mb-8">
          Track your memecoin trades, analyze your performance, and become a smarter degen. All in one place.
        </p>
        {authenticated ? (
          <Link href="/dashboard">
            <Button size="lg" className="bg-green-500 hover:bg-green-600 text-black font-bold">
                Go to Dashboard
            </Button>
          </Link>
        ) : (
          <Button size="lg" className="bg-green-500 hover:bg-green-600 text-black font-bold" onClick={login}>
              Get Started
          </Button>
        )}
      </main>

      {/* Features Section */}
      <section id="features" className="py-20 px-4">
        <div className="container mx-auto">
          <h3 className="text-4xl font-bold text-center mb-12">Core Features</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="bg-[#111315] border-gray-800">
                <CardHeader>
                  <div className="flex items-center space-x-4">
                    {feature.icon}
                    <CardTitle className="text-xl text-white">{feature.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-400">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="cta" className="bg-[#111315] py-20 px-4">
        <div className="container mx-auto text-center">
          <h3 className="text-4xl font-bold mb-4">Backed by data. Built for degens.</h3>
          <p className="text-gray-400 max-w-xl mx-auto mb-8">
            Interested in learning more? Contact us for demo access or partnership opportunities.
          </p>
          <a href="mailto:hello@tradelog.app">
            <Button variant="outline" className="border-green-400 text-green-400 hover:bg-green-400/10 hover:text-green-300">
              <Send className="mr-2 h-4 w-4" /> Contact Us
            </Button>
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="p-4 text-center text-gray-500">
        &copy; {new Date().getFullYear()} Tradelog. All rights reserved.
      </footer>
    </div>
  );
} 