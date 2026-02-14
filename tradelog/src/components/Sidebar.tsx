"use client";
import {
  LayoutDashboard,
  Wallet,
  BookOpen,
  Settings,
  CandlestickChart,
  Coins,
  Star,
} from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle"; // Import the new component

const Logo = () => (
  <div className="p-4 flex items-center justify-center">
    <CandlestickChart size={40} className="text-green-400" />
  </div>
);

const NavItem = ({
  icon: Icon,
  label,
  active,
  ...props
}: {
  icon: React.ElementType;
  label: string;
  active?: boolean;
} & React.ComponentProps<typeof Button>) => (
  <Button
    variant="ghost"
    className={cn(
      "flex flex-col items-center justify-center p-4 w-full h-auto rounded-none transition-all duration-200",
      active
        ? "bg-green-400/10 border-r-2 border-green-400 text-green-400 shadow-lg shadow-green-400/10"
        : "text-gray-400 hover:bg-gray-800/50 hover:text-green-400"
    )}
    {...props}
  >
    <Icon size={24} />
    <span className="text-xs mt-1">{label}</span>
  </Button>
);

const UserProfile = () => {
  return (
    <div className="mt-auto p-4 flex flex-col items-center gap-4">
      <ThemeToggle />
    </div>
  );
};

export default function Sidebar({
  activeItem,
  onItemClick,
}: {
  activeItem: string;
  onItemClick: (item: string) => void;
}) {
  return (
    <div className="w-24 bg-card text-white flex flex-col fixed h-full border-r border-border">
      <Logo />
      <nav className="flex flex-col items-center mt-8">
        <NavItem
          icon={LayoutDashboard}
          label="Dashboard"
          active={activeItem === "Dashboard"}
          onClick={() => onItemClick("Dashboard")}
        />
        <NavItem
          icon={Coins}
          label="Holdings"
          active={activeItem === "Holdings"}
          onClick={() => onItemClick("Holdings")}
        />
        <NavItem
          icon={BookOpen}
          label="Journal"
          active={activeItem === "Journal"}
          onClick={() => onItemClick("Journal")}
        />
        <NavItem
          icon={Star}
          label="Watchlist"
          active={activeItem === "Watchlist"}
          onClick={() => onItemClick("Watchlist")}
        />
        <NavItem
          icon={Wallet}
          label="Trades"
          active={activeItem === "Trades"}
          onClick={() => onItemClick("Trades")}
        />
        <NavItem
          icon={Settings}
          label="Settings"
          active={activeItem === "Settings"}
          onClick={() => onItemClick("Settings")}
        />
      </nav>
      <UserProfile />
    </div>
  );
}
