"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    BarChart3,
    Clock,
    DollarSign,
    Filter,
    Package,
    RefreshCw,
    Search,
    TrendingUp,
    Truck
} from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";

interface LoadStats {
  totalOffers: number;
  pendingOffers: number;
  acceptedOffers: number;
  rejectedOffers: number;
  totalBooked: number;
  totalRevenue: number;
  averageOffer: number;
  completedLoads: number;
}

interface EnhancedConsoleProps {
  stats: LoadStats;
  onRefresh: () => void;
  onSearch: (query: string) => void;
  onFilterChange: (filters: any) => void;
  children: React.ReactNode;
}

export function EnhancedConsole({ 
  stats, 
  onRefresh, 
  onSearch, 
  onFilterChange, 
  children 
}: EnhancedConsoleProps) {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Color theme integration
  const getThemeColors = () => {
    const baseColors = {
      light: {
        primary: "from-blue-500/10 to-purple-500/10",
        secondary: "from-gray-50/80 to-white/80",
        accent: "from-blue-500/20 to-purple-500/20",
        glass: "bg-white/70 backdrop-blur-xl",
        border: "border-white/20",
        text: "text-gray-900",
        textSecondary: "text-gray-600"
      },
      dark: {
        primary: "from-blue-600/20 to-purple-600/20",
        secondary: "from-gray-900/80 to-gray-800/80",
        accent: "from-blue-500/30 to-purple-500/30",
        glass: "bg-gray-900/70 backdrop-blur-xl",
        border: "border-gray-700/30",
        text: "text-gray-100",
        textSecondary: "text-gray-400"
      }
    };
    
    return baseColors[theme as keyof typeof baseColors] || baseColors.dark;
  };

  const colors = getThemeColors();

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefresh();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    onSearch(query);
  };

  const StatCard = ({ 
    title, 
    value, 
    subtitle, 
    icon: Icon, 
    trend, 
    color = "blue" 
  }: {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: any;
    trend?: string;
    color?: string;
  }) => {
    const colorClasses = {
      blue: "from-blue-500/20 to-blue-600/20 border-blue-500/30",
      green: "from-green-500/20 to-green-600/20 border-green-500/30",
      purple: "from-purple-500/20 to-purple-600/20 border-purple-500/30",
      orange: "from-orange-500/20 to-orange-600/20 border-orange-500/30",
      red: "from-red-500/20 to-red-600/20 border-red-500/30"
    };

    return (
      <Card className={`${colors.glass} ${colors.border} border-2 rounded-2xl shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-105 group`}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className={`p-3 rounded-xl bg-gradient-to-br ${colorClasses[color as keyof typeof colorClasses]} group-hover:scale-110 transition-transform duration-300`}>
              <Icon className={`h-6 w-6 ${colors.text}`} />
            </div>
            {trend && (
              <Badge variant="outline" className={`${colors.border} ${colors.textSecondary} text-xs`}>
                {trend}
              </Badge>
            )}
          </div>
          <div className="space-y-1">
            <h3 className={`text-2xl font-bold ${colors.text} group-hover:text-blue-500 transition-colors duration-300`}>
              {value}
            </h3>
            <p className={`text-sm font-medium ${colors.textSecondary}`}>
              {title}
            </p>
            {subtitle && (
              <p className={`text-xs ${colors.textSecondary}`}>
                {subtitle}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header Section */}
      <div className={`${colors.glass} ${colors.border} border-b-2 backdrop-blur-xl sticky top-0 z-50`}>
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className={`p-3 rounded-2xl bg-gradient-to-br ${colors.primary} ${colors.border} border-2`}>
                <Truck className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className={`text-3xl font-bold ${colors.text} bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent`}>
                  My Loads Console
                </h1>
                <p className={`${colors.textSecondary} text-sm`}>
                  Manage your offers and booked loads with precision
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <Button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className={`${colors.glass} ${colors.border} border-2 rounded-xl hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl`}
                size="sm"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh Data
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Offers"
            value={stats.totalOffers}
            subtitle={`Avg: $${stats.averageOffer.toFixed(2)}`}
            icon={DollarSign}
            color="blue"
          />
          <StatCard
            title="Active Loads"
            value={stats.totalBooked}
            subtitle={`${stats.completedLoads} completed`}
            icon={Package}
            color="green"
          />
          <StatCard
            title="Pending Offers"
            value={stats.pendingOffers}
            subtitle={`${stats.acceptedOffers} accepted`}
            icon={Clock}
            color="orange"
          />
          <StatCard
            title="Total Revenue"
            value={`$${stats.totalRevenue.toFixed(2)}`}
            subtitle={`From ${stats.totalBooked} loads`}
            icon={TrendingUp}
            color="purple"
          />
        </div>

        {/* Search and Filters */}
        <Card className={`${colors.glass} ${colors.border} border-2 rounded-2xl shadow-2xl mb-8`}>
          <CardHeader className="pb-4">
            <CardTitle className={`flex items-center gap-2 ${colors.text}`}>
              <Filter className="h-5 w-5" />
              Advanced Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <Label htmlFor="search" className={`${colors.textSecondary} text-sm font-medium`}>
                  Search
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="search"
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder="Search by load number, origin, destination, customer..."
                    className={`${colors.glass} ${colors.border} border-2 rounded-xl pl-10 focus:ring-2 focus:ring-blue-500/50 transition-all duration-300`}
                  />
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {['PENDING', 'ACCEPTED', 'REJECTED', 'COUNTERED', 'ASSIGNED', 'PICKED UP', 'IN TRANSIT', 'DELIVERED', 'COMPLETED'].map((status) => (
                  <Button
                    key={status}
                    variant="outline"
                    size="sm"
                    className={`${colors.border} rounded-lg hover:scale-105 transition-all duration-300`}
                  >
                    {status}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <Card className={`${colors.glass} ${colors.border} border-2 rounded-2xl shadow-2xl overflow-hidden`}>
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className={`${colors.secondary} ${colors.border} border-b-2 rounded-none p-0 h-auto`}>
              <TabsTrigger 
                value="overview" 
                className={`px-6 py-4 rounded-none ${colors.text} data-[state=active]:bg-gradient-to-r ${colors.accent} data-[state=active]:${colors.text} transition-all duration-300`}
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                Overview
              </TabsTrigger>
              <TabsTrigger 
                value="offers" 
                className={`px-6 py-4 rounded-none ${colors.text} data-[state=active]:bg-gradient-to-r ${colors.accent} data-[state=active]:${colors.text} transition-all duration-300`}
              >
                <DollarSign className="h-4 w-4 mr-2" />
                My Offers
              </TabsTrigger>
              <TabsTrigger 
                value="booked" 
                className={`px-6 py-4 rounded-none ${colors.text} data-[state=active]:bg-gradient-to-r ${colors.accent} data-[state=active]:${colors.text} transition-all duration-300`}
              >
                <Package className="h-4 w-4 mr-2" />
                Booked Loads
              </TabsTrigger>
              <TabsTrigger 
                value="lifecycle" 
                className={`px-6 py-4 rounded-none ${colors.text} data-[state=active]:bg-gradient-to-r ${colors.accent} data-[state=active]:${colors.text} transition-all duration-300`}
              >
                <Clock className="h-4 w-4 mr-2" />
                Lifecycle
              </TabsTrigger>
              <TabsTrigger 
                value="analytics" 
                className={`px-6 py-4 rounded-none ${colors.text} data-[state=active]:bg-gradient-to-r ${colors.accent} data-[state=active]:${colors.text} transition-all duration-300`}
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                Analytics
              </TabsTrigger>
            </TabsList>
            
            <div className="p-6">
              {children}
            </div>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
